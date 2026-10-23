import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { beforeAll, describe, expect, it } from "vitest";
import { logPath, readKey, readLog, verifyChain } from "../src/core/gate.js";
import {
  interrogationState,
  planHash,
  readMark,
  recordInterrogation,
} from "../src/core/interrogation.js";
import { verification } from "../src/core/orchestration.js";
import { advance, approvePhase, loadContext } from "../src/core/pipeline.js";
import { loadState } from "../src/core/state.js";
import { verdictOfFindings } from "../src/core/verify.js";
import {
  CLI,
  cli,
  interrogatePlan,
  isolateUserConfig,
  makeProject,
  makeProjectAt,
  write,
  writeValidArtifacts,
} from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});
const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });
const yes = () => Promise.resolve({ approver: "ana" });

/** A project in the plan phase with the artifacts of the earlier phases in place. */
function planProject(ids = ["SDD", "FDD"]): string {
  const root = makeProjectAt("plan", ids);
  for (const id of ids) writeValidArtifacts(root, id);
  return root;
}
const DOC =
  "# Plan\n\n## Interrogado\n\n- ¿Cubre cada criterio? Sí.\n- ¿Qué supuestos hay? Ninguno sin comprobar.\n- ¿Qué se recorta primero? Lo opcional.\n";

describe("la marca de plan interrogado (criterio 71)", () => {
  it("se registra contra el contenido del plan, con el documento y quién la puso", () => {
    const root = planProject();
    write(root, "docs/interrogado.md", DOC);
    const mark = recordInterrogation(
      loadContext(root),
      "docs/interrogado.md",
      "ana",
      new Date("2026-10-23T12:00:00Z"),
    );
    expect(mark).toMatchObject({
      documento: "docs/interrogado.md",
      por: "ana",
      fecha: "2026-10-23T12:00:00.000Z",
    });
    expect(mark.hash).toBe(planHash(loadContext(root)));
    expect(readMark(root)).toEqual(mark);
    expect(interrogationState(loadContext(root)).estado).toBe("vigente");
  });

  it("solo se interroga el plan cuando es la fase actual", () => {
    const root = makeProjectAt("build", ["TDD"]);
    write(root, "docs/interrogado.md", DOC);
    expect(() => recordInterrogation(loadContext(root), "docs/interrogado.md", "ana")).toThrow(
      /Solo se interroga el plan/,
    );
  });

  it("exige un documento dentro del proyecto, con una sección «Interrogado» que diga algo", () => {
    const root = planProject();
    const ctx = loadContext(root);
    expect(() => recordInterrogation(ctx, "../fuera.md", "ana")).toThrow(/dentro del proyecto/);
    expect(() => recordInterrogation(ctx, "/etc/passwd", "ana")).toThrow(/dentro del proyecto/);
    expect(() => recordInterrogation(ctx, "docs/no-existe.md", "ana")).toThrow(/No existe/);
    write(root, "docs/a.md", "# Plan\n\nSin la sección.\n");
    expect(() => recordInterrogation(ctx, "docs/a.md", "ana")).toThrow(
      /no tiene una sección «Interrogado»/,
    );
    write(root, "docs/b.md", "# Plan\n\n## Interrogado\n\n## Otra cosa\n\ntexto\n");
    expect(() => recordInterrogation(ctx, "docs/b.md", "ana")).toThrow(/casi vacía/);
    write(root, "docs/c.md", "# Plan\n\n## Interrogado\n\n- una pregunta\n- una respuesta\n");
    expect(() => recordInterrogation(ctx, "docs/c.md", "ana")).toThrow(/casi vacía \(2 línea/);
    expect(readMark(root)).toBeNull();
  });

  it("deja de valer si el plan cambia, y un archivo roto cuenta como que falta", () => {
    const root = planProject();
    expect(interrogationState(loadContext(root)).estado).toBe("falta");
    interrogatePlan(root);
    expect(interrogationState(loadContext(root)).estado).toBe("vigente");
    write(
      root,
      "docs/specs/SPEC.md",
      "# Spec\n\n## Criterios de aceptación\n\n1. otro criterio distinto\n",
    );
    expect(interrogationState(loadContext(root)).estado).toBe("obsoleta");
    writeFileSync(join(root, ".evol", "plan-interrogado.json"), "{roto");
    expect(interrogationState(loadContext(root)).estado).toBe("falta");
  });
});

describe("aprobar el plan (criterio 71)", () => {
  it("falla si el plan no se interrogó, y dice cómo hacerlo y cómo saltarlo", async () => {
    const root = planProject();
    const error = await approvePhase(loadContext(root), "plan", yes).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("el plan no se interrogó");
    expect((error as Error).message).toContain("interrogar-plan");
    expect((error as Error).message).toContain("evol interrogate");
    expect((error as Error).message).toContain("--sin-interrogar");
    expect(readLog(root)).toHaveLength(0);
  });

  it("con la marca vigente se aprueba, y sin anulación en la firma", async () => {
    const root = planProject();
    interrogatePlan(root);
    const result = await approvePhase(loadContext(root), "plan", yes);
    expect(result.anulacion).toBeUndefined();
    expect(readLog(root)[0]).not.toHaveProperty("anulacion");
  });

  it("si el plan cambió después de interrogarlo, hay que volver a hacerlo", async () => {
    const root = planProject();
    interrogatePlan(root);
    write(
      root,
      "docs/features/FEATURES.md",
      "# Features\n\n## Una feature distinta\n\nPrioridad: alta\n",
    );
    await expect(approvePhase(loadContext(root), "plan", yes)).rejects.toThrow(
      /cambió después de interrogarlo/,
    );
  });

  it("la anulación exige un motivo y queda firmada en el registro", async () => {
    const root = planProject();
    await expect(
      approvePhase(loadContext(root), "plan", yes, { sinInterrogar: "  " }),
    ).rejects.toThrow(/no se interrogó/);
    await expect(
      approvePhase(loadContext(root), "plan", yes, { sinInterrogar: "corto" }),
    ).rejects.toThrow(/demasiado corto/);
    const result = await approvePhase(loadContext(root), "plan", yes, {
      sinInterrogar: "es un prototipo que se tira la semana que viene",
    });
    expect(result.anulacion).toBe(
      "plan aprobado sin interrogar: es un prototipo que se tira la semana que viene",
    );
    const entry = readLog(root)[0];
    expect(entry?.anulacion).toBe(result.anulacion);
    // it is part of what is signed: the chain verifies, and changing the reason breaks it
    const key = readKey(loadState(root).projectId) as Buffer;
    expect(verifyChain(readLog(root), key)).toEqual({ ok: true });
    const file = logPath(root);
    writeFileSync(file, readFileSync(file, "utf8").replace("prototipo", "producto"));
    expect(verifyChain(readLog(root), key)).toMatchObject({
      ok: false,
      reason: "el contenido fue modificado",
    });
  });

  it("las aprobaciones anteriores a este campo siguen verificando, y se mezclan con las nuevas", async () => {
    const root = makeProject(["FDD", "SDD"]);
    writeValidArtifacts(root, "FDD");
    writeValidArtifacts(root, "SDD");
    await approvePhase(loadContext(root), "briefing", yes); // an entry without «anulacion»
    await advance(loadContext(root));
    await approvePhase(loadContext(root), "spec", yes);
    await advance(loadContext(root));
    await approvePhase(loadContext(root), "plan", yes, {
      sinInterrogar: "no hace falta para esta prueba",
    });
    const log = readLog(root);
    expect(log.map((e) => "anulacion" in e)).toEqual([false, false, true]);
    expect(verifyChain(log, readKey(loadState(root).projectId) as Buffer)).toEqual({ ok: true });
  });

  it("la anulación vale solo para el plan: las demás fases no la tienen", async () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    const result = await approvePhase(loadContext(root), "briefing", yes, {
      sinInterrogar: "motivo largo y claro",
    });
    expect(result.anulacion).toBeUndefined();
  });
});

describe("PASS, WARN o BLOCK (O4)", () => {
  it("el veredicto sale de los hallazgos: bloquea lo que bloquea, avisa lo que avisa", () => {
    expect(verdictOfFindings([])).toBe("PASS");
    expect(
      verdictOfFindings([{ modulo: "a", disciplina: "X", mensaje: "m", nivel: "aviso" }]),
    ).toBe("WARN");
    expect(verdictOfFindings([{ modulo: "a", disciplina: "X", mensaje: "m" }])).toBe("BLOCK");
    expect(
      verdictOfFindings([
        { modulo: "a", disciplina: "X", mensaje: "m", nivel: "aviso" },
        { modulo: "a", disciplina: "Y", mensaje: "n", nivel: "bloqueo" },
      ]),
    ).toBe("BLOCK");
  });

  it("al final del plan sin interrogar es WARN (no bloquea la verificación, pero la aprobación sí lo exige)", async () => {
    const root = planProject();
    const fin = await verification(loadContext(root), "fin");
    expect(fin).toMatchObject({ fase: "plan", momento: "fin", veredicto: "WARN", listo: true });
    expect(fin.problemas[0]).toMatchObject({ nivel: "aviso", disciplina: "PLAN" });
    expect(fin.problemas[0]?.mensaje).toContain("todavía no se interrogó");
    interrogatePlan(root);
    expect((await verification(loadContext(root), "fin")).veredicto).toBe("PASS");
    write(root, "docs/specs/SPEC.md", "# Spec\n\n## Criterios de aceptación\n\n1. distinto\n");
    expect((await verification(loadContext(root), "fin")).problemas[0]?.mensaje).toContain(
      "cambió después de interrogarlo",
    );
  });

  it("un artefacto que falta es BLOCK, y al inicio de la fase se nombra", async () => {
    const root = makeProjectAt("plan", ["SDD", "DDD"]);
    writeValidArtifacts(root, "SDD"); // DDD's DOMAIN.md is missing
    const inicio = await verification(loadContext(root), "inicio");
    expect(inicio).toMatchObject({ momento: "inicio", veredicto: "BLOCK", listo: false });
    expect(inicio.problemas[0]?.mensaje).toContain("de «spec» falta docs/specs/DOMAIN.md");
    expect(inicio.problemas[0]).toMatchObject({ modulo: "app", disciplina: "DDD" });
  });

  it("un plan aprobado sin interrogar queda como aviso en el inicio de las fases siguientes", async () => {
    const root = planProject();
    await approvePhase(loadContext(root), "plan", yes, {
      sinInterrogar: "prototipo desechable, sin más",
    });
    await advance(loadContext(root));
    const inicio = await verification(loadContext(root), "inicio");
    expect(inicio.veredicto).toBe("WARN");
    expect(inicio.listo).toBe(true);
    expect(inicio.problemas[0]?.mensaje).toContain(
      "plan aprobado sin interrogar: prototipo desechable, sin más (ana,",
    );
  });

  it("un aviso no impide avanzar: solo cuenta lo que bloquea", async () => {
    const root = planProject();
    expect((await verification(loadContext(root))).veredicto).toBe("WARN");
    await approvePhase(loadContext(root), "plan", yes, {
      sinInterrogar: "motivo suficientemente largo",
    });
    expect((await advance(loadContext(root))).advanced).toBe(true);
  });

  it("evol verify: el código de salida es 1 solo con BLOCK, y --json da el veredicto", () => {
    const warn = planProject();
    const w = cli(["verify"], { cwd: warn, env: env() });
    expect(w.status).toBe(0);
    expect(w.stdout).toContain("WARN — fin de «plan»");
    const json = JSON.parse(cli(["verify", "--json"], { cwd: warn, env: env() }).stdout) as {
      veredicto: string;
      listo: boolean;
    };
    expect(json).toMatchObject({ veredicto: "WARN", listo: true });

    const block = makeProjectAt("plan", ["SDD"]);
    const b = cli(["verify", "--inicio"], { cwd: block, env: env() });
    expect(b.status).toBe(1);
    expect(b.stdout).toContain("BLOCK — inicio de «plan»");
    expect(b.stdout).toContain("docs/specs/SPEC.md");
  });

  it("evol_verify del MCP lleva el veredicto y el momento, y conserva lo que ya devolvía", async () => {
    const root = planProject();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--disable-warning=ExperimentalWarning", CLI, "mcp"],
      cwd: root,
      env: { ...(process.env as Record<string, string>), ...env() },
      stderr: "ignore",
    });
    const client = new Client({ name: "test", version: "0" }, { capabilities: {} });
    await client.connect(transport);
    try {
      const call = async (args: Record<string, unknown>) =>
        JSON.parse(
          (
            (await client.callTool({ name: "evol_verify", arguments: args })) as {
              content: { text: string }[];
            }
          ).content[0]?.text ?? "{}",
        ) as Record<string, unknown>;
      expect(await call({})).toMatchObject({
        veredicto: "WARN",
        momento: "fin",
        listo: true,
        fase: "plan",
      });
      expect(await call({ momento: "inicio" })).toMatchObject({
        veredicto: "PASS",
        momento: "inicio",
      });
      expect(Object.keys(await call({}))).toEqual(
        expect.arrayContaining(["problemas", "aprobacion", "nota"]),
      );
    } finally {
      await client.close();
    }
  });
});

describe("el estado dice si el plan se interrogó", () => {
  it("solo mientras el plan es la fase actual, en el texto y en el JSON", () => {
    const root = planProject();
    expect(cli(["status"], { cwd: root, env: env() }).stdout).toContain("Plan interrogado: no");
    expect(JSON.parse(cli(["status", "--json"], { cwd: root, env: env() }).stdout)).toMatchObject({
      planInterrogado: "falta",
    });
    interrogatePlan(root);
    expect(cli(["status"], { cwd: root, env: env() }).stdout).toContain("Plan interrogado: sí");
    expect(JSON.parse(cli(["status", "--json"], { cwd: root, env: env() }).stdout)).toMatchObject({
      planInterrogado: "vigente",
    });
    const other = makeProject(["FDD"]);
    expect(cli(["status"], { cwd: other, env: env() }).stdout).not.toContain("Plan interrogado");
    expect(
      JSON.parse(cli(["status", "--json"], { cwd: other, env: env() }).stdout),
    ).not.toHaveProperty("planInterrogado");
  });
});

const hasScript = spawnSync("script", ["--version"], { encoding: "utf8" }).status === 0;

describe.skipIf(!hasScript)("aprobar el plan en una terminal real", () => {
  const approve = (root: string, ...args: string[]) =>
    spawnSync(
      "script",
      [
        "-qec",
        `${process.execPath} --disable-warning=ExperimentalWarning ${CLI} approve ${args.join(" ")}`,
        "/dev/null",
      ],
      {
        cwd: root,
        input: "plan\n",
        encoding: "utf8",
        timeout: 60_000,
        env: { ...process.env, ...env() },
      },
    );

  it("sin la marca falla; con --sin-interrogar y un motivo se aprueba y lo dice", () => {
    const root = planProject();
    const refused = approve(root, "plan");
    expect(refused.stdout + refused.stderr).toContain("el plan no se interrogó");
    expect(readLog(root)).toHaveLength(0);
    const ok = approve(root, "plan", "--sin-interrogar", '"prototipo que se tira pronto"');
    expect(ok.stdout).toContain("aprobada");
    expect(ok.stdout).toContain(
      "Queda registrado en la firma: plan aprobado sin interrogar: prototipo que se tira pronto",
    );
    expect(readLog(root)[0]?.anulacion).toContain("prototipo que se tira pronto");
  });

  it("--sin-interrogar no sirve para otra fase", () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    const r = approve(root, "briefing", "--sin-interrogar", '"motivo largo y claro"');
    expect(r.stdout + r.stderr).toContain("solo vale para aprobar el plan");
    expect(readLog(root)).toHaveLength(0);
  });

  it("con evol interrogate la aprobación sale sin anulación", () => {
    const root = planProject();
    write(root, "docs/interrogado.md", DOC);
    const marked = cli(["interrogate", "docs/interrogado.md"], { cwd: root, env: env() });
    expect(marked.status, marked.stderr).toBe(0);
    expect(marked.stdout).toContain("Plan interrogado");
    const ok = approve(root, "plan");
    expect(ok.stdout).toContain("aprobada");
    expect(ok.stdout).not.toContain("Queda registrado en la firma");
    expect(readLog(root)[0]).not.toHaveProperty("anulacion");
  });
});
