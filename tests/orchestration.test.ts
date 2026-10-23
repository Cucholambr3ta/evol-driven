import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { orchestratorBody, orchestratorDescription } from "../src/agents/orchestrator.js";
import { writeAgentFiles } from "../src/agents/files.js";
import { TOOL_NAMES } from "../src/commands/mcp.js";
import { lessonsOf, phaseDisciplines, prerequisites } from "../src/core/orchestration.js";
import { loadContext } from "../src/core/pipeline.js";
import {
  CLI,
  cli,
  isolateUserConfig,
  makeProject,
  makeProjectAt,
  REPO,
  tempDir,
  write,
  writeValidArtifacts,
} from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});
const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });

const open: Client[] = [];
afterEach(async () => {
  for (const c of open.splice(0)) await c.close().catch(() => undefined);
});
async function connect(cwd: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--disable-warning=ExperimentalWarning", CLI, "mcp"],
    cwd,
    env: { ...(process.env as Record<string, string>), ...env() },
    stderr: "ignore",
  });
  const client = new Client({ name: "test", version: "0" }, { capabilities: {} });
  await client.connect(transport);
  open.push(client);
  return client;
}
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { text: string }[];
    isError?: boolean;
  };
  return {
    isError: result.isError === true,
    json: () => JSON.parse(result.content[0]?.text ?? "{}"),
  };
}

/** A project in `phase` whose earlier phases have their artifacts (or not, when `without` names one). */
function projectIn(
  phase: Parameters<typeof makeProjectAt>[0],
  ids: string[],
  without: string[] = [],
) {
  const root = makeProjectAt(phase, ids);
  for (const id of ids.filter((i) => !without.includes(i))) writeValidArtifacts(root, id);
  return root;
}

describe("evol_prerequisites: lo que falta de la fase anterior (criterio 70)", () => {
  it("nombra el artefacto que falta, la disciplina y el módulo", () => {
    // in «plan» the specification of «spec» has to exist: SPEC.md and DOMAIN.md
    const root = projectIn("plan", ["SDD", "DDD"], ["DDD"]);
    const report = prerequisites(loadContext(root));
    expect(report).toMatchObject({ fase: "plan", anterior: "spec", listo: false });
    expect(report.faltan).toEqual([
      expect.objectContaining({
        fase: "spec",
        modulo: "app",
        disciplina: "DDD",
        artefacto: "docs/specs/DOMAIN.md",
        problema: "falta",
      }),
    ]);
  });

  it("un artefacto que conserva [[COMPLETAR]] tampoco cuenta", () => {
    const root = projectIn("plan", ["SDD"]);
    write(
      root,
      "docs/specs/SPEC.md",
      "# Spec\n\n## Criterios de aceptación\n\n1. [[COMPLETAR]] algo\n",
    );
    const report = prerequisites(loadContext(root));
    expect(report.listo).toBe(false);
    expect(report.faltan[0]).toMatchObject({
      artefacto: "docs/specs/SPEC.md",
      problema: "sin-completar",
    });
  });

  it("con todo en su sitio está listo, y la primera fase no depende de ninguna", () => {
    const ok = prerequisites(loadContext(projectIn("plan", ["SDD"])));
    expect(ok).toMatchObject({ listo: true, faltan: [], anterior: "spec" });
    expect(prerequisites(loadContext(makeProject(["FDD"])))).toMatchObject({
      fase: "briefing",
      anterior: null,
      listo: true,
    });
  });

  it("se puede preguntar por otra fase, no solo por la actual", () => {
    const root = projectIn("plan", ["SDD", "DDD"], ["DDD"]);
    expect(prerequisites(loadContext(root), "build").anterior).toBe("plan");
    expect(prerequisites(loadContext(root), "spec").anterior).toBe("briefing");
    expect(prerequisites(loadContext(root), "done").listo).toBe(true);
  });

  it("por la línea de comandos sale con 1 y dice qué falta; con --json da el mismo informe", () => {
    const root = projectIn("plan", ["SDD", "DDD"], ["DDD"]);
    const text = cli(["prerequisites"], { cwd: root, env: env() });
    expect(text.status).toBe(1);
    expect(text.stdout).toContain("Faltan cosas de «spec»");
    expect(text.stdout).toContain("[app/DDD] docs/specs/DOMAIN.md");
    const json = cli(["prerequisites", "--json"], { cwd: root, env: env() });
    expect(JSON.parse(json.stdout)).toMatchObject({
      listo: false,
      faltan: [{ disciplina: "DDD" }],
    });
    const ok = cli(["prerequisites"], { cwd: projectIn("plan", ["SDD"]), env: env() });
    expect(ok.status).toBe(0);
    expect(cli(["prerequisites", "--fase", "magia"], { cwd: root, env: env() }).status).toBe(1);
  });
});

describe("evol_disciplines: las disciplinas activas de la fase", () => {
  it("dice qué skill aplica cada una, qué espera y cómo se verifica", () => {
    const root = makeProjectAt("spec", ["SDD", "DDD", "TDD"]);
    const report = phaseDisciplines(loadContext(root));
    expect(report.fase).toBe("spec");
    expect(report.disciplinas.map((d) => [d.id, d.skill])).toEqual([
      ["SDD", "sdd"],
      ["DDD", "ddd"],
    ]);
    const ddd = report.disciplinas.find((d) => d.id === "DDD");
    expect(ddd?.artefactos).toEqual([{ patron: "docs/specs/DOMAIN.md", formato: "md", min: 1 }]);
    expect(ddd?.verificaciones).toContain("DOMAIN.md debe tener una sección «Entidades»");
    expect(phaseDisciplines(loadContext(root), "build").disciplinas.map((d) => d.id)).toEqual([
      "SDD",
      "TDD",
    ]);
  });

  it("por la línea de comandos, con --fase y con --json", () => {
    const root = makeProjectAt("spec", ["SDD", "TDD"]);
    const json = JSON.parse(
      cli(["disciplines", "active", "--fase", "build", "--json"], { cwd: root, env: env() }).stdout,
    ) as {
      fase: string;
      disciplinas: { id: string }[];
    };
    expect(json.fase).toBe("build");
    expect(json.disciplinas.map((d) => d.id)).toEqual(["SDD", "TDD"]);
    expect(cli(["disciplines", "active"], { cwd: root, env: env() }).stdout).toContain(
      "(skill: sdd)",
    );
  });
});

describe("evol_lessons: las lecciones del proyecto", () => {
  const LECCIONES =
    "# Lecciones\n\n### Fijar las versiones — 2026-03-01\n\nUna dependencia sin versión fija rompió el despliegue.\n\n### Probar antes de refactorizar — 2026-04-10\n\nSin pruebas, el refactor cambió el comportamiento.\n";

  it("lee título, fecha y texto, y filtra por palabras", () => {
    const root = makeProject(["FDD"]);
    write(root, "lecciones.md", LECCIONES);
    const all = lessonsOf(root);
    expect(all.total).toBe(2);
    expect(all.lecciones[0]).toMatchObject({ titulo: "Fijar las versiones", fecha: "2026-03-01" });
    expect(lessonsOf(root, "refactor pruebas").lecciones.map((l) => l.titulo)).toEqual([
      "Probar antes de refactorizar",
    ]);
    expect(lessonsOf(root, "nada de esto").lecciones).toEqual([]);
    expect(lessonsOf(root, "nada de esto").total).toBe(2);
  });

  it("sin lecciones no falla", () => {
    expect(lessonsOf(makeProject(["FDD"]))).toEqual({ total: 0, lecciones: [] });
  });

  it("por la línea de comandos, y sin MemPalace", () => {
    const root = makeProject(["FDD"]);
    write(root, "lecciones.md", LECCIONES);
    expect(cli(["lessons", "list"], { cwd: root, env: env() }).stdout).toContain(
      "- Fijar las versiones (2026-03-01)",
    );
    const json = JSON.parse(
      cli(["lessons", "list", "--buscar", "refactor", "--json"], { cwd: root, env: env() }).stdout,
    ) as {
      lecciones: unknown[];
    };
    expect(json.lecciones).toHaveLength(1);
  });
});

describe("las herramientas nuevas del MCP son de solo lectura (criterios 22 y 66)", () => {
  it("están en la lista y devuelven lo mismo que la línea de comandos", async () => {
    expect(TOOL_NAMES).toEqual(
      expect.arrayContaining(["evol_prerequisites", "evol_disciplines", "evol_lessons"]),
    );
    const root = projectIn("plan", ["SDD", "DDD"], ["DDD"]);
    write(root, "lecciones.md", "# L\n\n### Una — 2026-01-01\n\ntexto\n");
    const client = await connect(root);
    const missing = (await call(client, "evol_prerequisites")).json() as {
      listo: boolean;
      faltan: { disciplina: string }[];
    };
    expect(missing.listo).toBe(false);
    expect(missing.faltan[0]?.disciplina).toBe("DDD");
    const disciplines = (await call(client, "evol_disciplines", { fase: "build" })).json() as {
      fase: string;
    };
    expect(disciplines.fase).toBe("build");
    const lessons = (await call(client, "evol_lessons", { buscar: "texto" })).json() as {
      total: number;
    };
    expect(lessons.total).toBe(1);
    expect((await call(client, "evol_prerequisites", { fase: "inventada" })).isError).toBe(true);
  });

  it("consultarlas no cambia nada: ni el estado, ni el registro de aprobaciones, ni los archivos", async () => {
    const root = projectIn("plan", ["SDD", "DDD"], ["DDD"]);
    const stateFile = join(root, ".evol", "state.json");
    const before = existsSync(stateFile) ? readFileSync(stateFile, "utf8") : null;
    const mtime = existsSync(stateFile) ? statSync(stateFile).mtimeMs : 0;
    const client = await connect(root);
    for (const tool of ["evol_status", "evol_prerequisites", "evol_disciplines", "evol_lessons"])
      await call(client, tool);
    cli(["status", "--json"], { cwd: root, env: env() });
    cli(["prerequisites"], { cwd: root, env: env() });
    expect(existsSync(stateFile) ? readFileSync(stateFile, "utf8") : null).toBe(before);
    expect(existsSync(stateFile) ? statSync(stateFile).mtimeMs : 0).toBe(mtime);
    expect(existsSync(join(root, ".evol", "gate-log.jsonl"))).toBe(false);
  });
});

describe("evol status --json", () => {
  it("da el mismo informe que la herramienta evol_status", async () => {
    const root = projectIn("plan", ["SDD"]);
    const fromCli = JSON.parse(
      cli(["status", "--json"], { cwd: root, env: env() }).stdout,
    ) as Record<string, unknown>;
    expect(fromCli).toMatchObject({
      fase: "plan",
      disciplinas: [{ id: "SDD" }],
      aprobacion: { estado: "pendiente" },
    });
    const fromMcp = (await call(await connect(root), "evol_status")).json();
    expect(fromMcp).toEqual(fromCli);
  });
});

describe("el contrato del orquestador: una sola fuente (criterios 66 y 69)", () => {
  const body = orchestratorBody();

  it("tiene los siete pasos, en orden", () => {
    const steps = [...body.matchAll(/^(\d)\. \*\*(\w+)\.\*\*/gm)].map((m) => `${m[1]}:${m[2]}`);
    expect(steps).toEqual([
      "1:Arrancar",
      "2:Clasificar",
      "3:Comprobar",
      "4:Dividir",
      "5:Repartir",
      "6:Verificar",
      "7:Parar",
    ]);
  });

  it("sin argumentos solo muestra el estado y propone, sin modificar nada", () => {
    expect(body).toMatch(
      /escribe `\/evol` sin más, \*\*solo muestras el estado y propones el siguiente paso, sin modificar nada\*\*/,
    );
  });

  it("se detiene si falta un artefacto de la fase anterior y lo nombra", () => {
    expect(body).toContain("te detienes y lo nombras");
  });

  it("nunca aprueba ni avanza de fase, y ni siquiera nombra esos comandos (una skill no puede pedirlo)", () => {
    expect(body).not.toMatch(/\bevol\s+(approve|next)\b/i);
    expect(body).toMatch(/No apruebas una fase ni la avanzas/);
    expect(body).toMatch(/La aprobación y el avance de fase los hace una persona, en su terminal/);
  });

  it("todo lo que menciona existe: las herramientas del MCP y los comandos de la CLI", async () => {
    const tools = [...new Set([...body.matchAll(/`(evol_\w+)`/g)].map((m) => m[1]))];
    expect(tools.length).toBeGreaterThanOrEqual(5);
    for (const t of tools) expect(TOOL_NAMES, t).toContain(t);
    // every `evol <command>` it names is a real command of the CLI
    const help = spawnSync(process.execPath, [CLI, "--help"], { encoding: "utf8" }).stdout;
    const commands = [...new Set([...body.matchAll(/`evol ([a-z]+)/g)].map((m) => m[1]))];
    for (const c of commands) expect(help, c).toMatch(new RegExp(`^  ${c}\\s`, "m"));
    // and the subcommands it relies on answer
    const root = projectIn("plan", ["SDD"]);
    for (const args of [
      ["status", "--json"],
      ["lessons", "list", "--json"],
      ["prerequisites", "--json"],
      ["disciplines", "active", "--json"],
    ])
      expect(cli(args, { cwd: root, env: env() }).status, args.join(" ")).toBe(0);
  });

  it("el comando /evol de Claude Code se genera de esa misma fuente, y no pisa el de la persona", () => {
    const root = tempDir();
    writeAgentFiles(root);
    const command = readFileSync(join(root, ".claude/commands/evol.md"), "utf8");
    expect(command).toContain(body);
    expect(command).toContain("<!-- evol:generated -->");
    expect(command).toContain("$ARGUMENTS");
    expect(command).not.toMatch(/\bevol\s+(approve|next)\b/i);

    const mine = tempDir();
    write(mine, ".claude/commands/evol.md", "mi propio comando\n");
    const report = writeAgentFiles(mine);
    expect(readFileSync(join(mine, ".claude/commands/evol.md"), "utf8")).toBe(
      "mi propio comando\n",
    );
    expect(report.skipped.some((s) => s.file.endsWith("evol.md"))).toBe(true);
  });

  it("la descripción de la skill sale del archivo, y el paquete incluye las skills", () => {
    expect(orchestratorDescription()).toContain("Orquesta el trabajo de un proyecto");
    const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as { files: string[] };
    expect(pkg.files).toContain("skills");
    expect(pkg.files).toContain("!skills/*/evals");
  });
});
