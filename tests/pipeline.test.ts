import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { NotInteractiveError, UserError } from "../src/core/errors.js";
import { readLog } from "../src/core/gate.js";
import {
  advance,
  approvePhase,
  currentArtifacts,
  describe as describePhase,
  loadContext,
} from "../src/core/pipeline.js";
import type { Confirm, PipelineContext } from "../src/core/pipeline.js";
import { loadState } from "../src/core/state.js";
import type { CommandRunner, SecurityScanner } from "../src/core/verify.js";
import { isolateUserConfig, makeProject, write, writeValidArtifacts } from "./helpers.js";

beforeAll(() => {
  isolateUserConfig();
});

const yes: Confirm = () => Promise.resolve({ approver: "ana" });
const passing: CommandRunner = () => ({ ok: true, output: "" });

const noBlockers: SecurityScanner = () => [];

function ctxFor(root: string, run: CommandRunner = passing): PipelineContext {
  return loadContext(root, { run, securityScan: noBlockers });
}

describe("approve + next (criterios 2, 4 y 5)", () => {
  it("no avanza si faltan artefactos de la disciplina activa", async () => {
    const root = makeProject(["FDD"]);
    const result = await advance(ctxFor(root));
    expect(result.advanced).toBe(false);
    expect(result.problems.join()).toContain("falta el artefacto «docs/features/FEATURES.md»");
    expect(loadState(root).currentPhase).toBe("briefing");
  });

  it("no se puede aprobar mientras haya problemas", async () => {
    const root = makeProject(["FDD"]);
    await expect(approvePhase(ctxFor(root), "briefing", yes)).rejects.toThrow(
      /No se puede aprobar/,
    );
    expect(readLog(root)).toHaveLength(0);
  });

  it("con artefactos válidos pero sin aprobación, next no avanza", async () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    const result = await advance(ctxFor(root));
    expect(result.advanced).toBe(false);
    expect(result.problems.join()).toContain("No hay una aprobación vigente");
  });

  it("aprobar y luego avanzar funciona, y deja el estado en la fase siguiente", async () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    await approvePhase(ctxFor(root), "briefing", yes);
    const result = await advance(ctxFor(root));
    expect(result).toEqual({ advanced: true, phase: "spec", problems: [] });
    expect(loadState(root).currentPhase).toBe("spec");
    expect(loadState(root).completed.map((c) => c.phase)).toEqual(["briefing"]);
  });

  it("editar un artefacto aprobado hace que next rechace la fase", async () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    await approvePhase(ctxFor(root), "briefing", yes);
    write(root, "docs/features/FEATURES.md", "# Features\n\n## Otra feature distinta\n");
    const result = await advance(ctxFor(root));
    expect(result.advanced).toBe(false);
    expect(result.problems.join()).toContain("No hay una aprobación vigente");
    expect(loadState(root).currentPhase).toBe("briefing");
  });

  it("cambiar evol.config.json también invalida la aprobación", async () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    await approvePhase(ctxFor(root), "briefing", yes);
    const file = join(root, "evol.config.json");
    const config = JSON.parse(readFileSync(file, "utf8")) as {
      modules: { disciplinas: string[] }[];
    };
    (config.modules[0] as { disciplinas: string[] }).disciplinas = [];
    writeFileSync(file, JSON.stringify(config));
    expect((await advance(ctxFor(root))).advanced).toBe(false);
  });

  it("re-aprobar tras editar vuelve a permitir avanzar", async () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    await approvePhase(ctxFor(root), "briefing", yes);
    write(root, "docs/features/FEATURES.md", "# Features\n\n## Cambiada\n");
    await approvePhase(ctxFor(root), "briefing", yes);
    expect((await advance(ctxFor(root))).advanced).toBe(true);
  });

  it("si nadie puede confirmar, no se registra nada", async () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    const nobody: Confirm = () => Promise.reject(new NotInteractiveError());
    await expect(approvePhase(ctxFor(root), "briefing", nobody)).rejects.toThrow(
      NotInteractiveError,
    );
    expect(readLog(root)).toHaveLength(0);
    expect(loadState(root).currentPhase).toBe("briefing");
  });

  it("solo se aprueba la fase actual", async () => {
    const root = makeProject(["FDD"]);
    await expect(approvePhase(ctxFor(root), "build", yes)).rejects.toThrow(UserError);
  });

  it("falla cerrado si el registro de aprobaciones fue manipulado", async () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    await approvePhase(ctxFor(root), "briefing", yes);
    const file = join(root, ".evol", "gate-log.jsonl");
    writeFileSync(file, readFileSync(file, "utf8").replace('"ana"', '"intruso"'));
    const result = await advance(ctxFor(root));
    expect(result.advanced).toBe(false);
    expect(result.problems.join()).toContain("no es íntegro");
  });

  it("los fallos de las disciplinas activas bloquean (criterio 5)", async () => {
    const root = makeProject(["TDD"]);
    writeValidArtifacts(root, "TDD");
    // fase build: hay que llegar hasta ahí
    for (const phase of ["briefing", "spec", "plan"] as const) {
      await approvePhase(ctxFor(root), phase, yes);
      await advance(ctxFor(root));
    }
    expect(loadState(root).currentPhase).toBe("build");
    const failing: CommandRunner = () => ({ ok: false, output: "1 test failed" });
    const result = await advance(ctxFor(root, failing));
    expect(result.advanced).toBe(false);
    expect(result.problems.join()).toContain("falló «npx vitest run tests/unit»");
    await expect(approvePhase(ctxFor(root, failing), "build", yes)).rejects.toThrow(
      /No se puede aprobar/,
    );
  });
});

describe("recorrido completo y reglas de cada fase", () => {
  it("recorre las seis fases con aprobación humana en cada una", async () => {
    const root = makeProject([
      "SDD",
      "FDD",
      "DDD",
      "THREAT",
      "BDD",
      "ATDD",
      "TDD",
      "STDD",
      "SecDD",
    ]);
    for (const id of ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"])
      writeValidArtifacts(root, id);
    write(root, "lecciones.md", "# Lecciones\n\n### Una lección — 2026-01-01\n\ntexto\n");
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const phase = loadState(root).currentPhase;
      if (phase === "done") break;
      seen.push(phase);
      await approvePhase(ctxFor(root), phase, yes);
      expect((await advance(ctxFor(root))).advanced).toBe(true);
    }
    expect(seen).toEqual(["briefing", "spec", "plan", "build", "qa", "retro"]);
    expect(loadState(root).currentPhase).toBe("done");
    expect(readLog(root)).toHaveLength(6);
  });

  it("la fase retro exige al menos una lección registrada", async () => {
    const root = makeProject([]);
    for (const phase of ["briefing", "spec", "plan", "build", "qa"] as const) {
      await approvePhase(ctxFor(root), phase, yes);
      await advance(ctxFor(root));
    }
    expect(loadState(root).currentPhase).toBe("retro");
    await expect(approvePhase(ctxFor(root), "retro", yes)).rejects.toThrow(/al menos una lección/);
    write(root, "lecciones.md", "# Lecciones\n\n### Aprendí algo — 2026-01-01\n");
    await approvePhase(ctxFor(root), "retro", yes);
    expect((await advance(ctxFor(root))).phase).toBe("done");
  });

  it("los módulos tienen disciplinas distintas y raíces propias", async () => {
    const root = makeProject([], {
      modules: [
        { name: "ventas", root: "modules/ventas", disciplinas: ["FDD"] },
        { name: "stock", root: "modules/stock", disciplinas: [] },
      ],
    });
    const ctx = ctxFor(root);
    const overview = describePhase(ctx);
    expect(overview.disciplines.map((d) => `${d.module}/${d.id}`)).toEqual(["ventas/FDD"]);
    expect((await advance(ctx)).advanced).toBe(false);
    write(root, "modules/ventas/docs/features/FEATURES.md", "# F\n\n## Una\n");
    await approvePhase(ctxFor(root), "briefing", yes);
    expect(Object.keys(currentArtifacts(ctxFor(root), "briefing")).sort()).toEqual([
      "evol.config.json",
      "modules/ventas/docs/features/FEATURES.md",
    ]);
  });

  it("rechaza una disciplina desconocida en la configuración", () => {
    const root = makeProject(["NOEXISTE"]);
    expect(() => loadContext(root)).toThrow(/disciplina desconocida/);
  });
});
