import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/core/config.js";
import { changeDisciplines, planChange } from "../src/core/disciplines-change.js";
import type { ConfirmChange } from "../src/core/disciplines-change.js";
import { loadDisciplines } from "../src/core/disciplines.js";
import { NotInteractiveError } from "../src/core/errors.js";
import { appendApproval, ensureKey, findValidApproval, readLog } from "../src/core/gate.js";
import { journalRead } from "../src/core/journal.js";
import type { Phase } from "../src/core/phases.js";
import { currentArtifacts, loadContext } from "../src/core/pipeline.js";
import { BASE_DISCIPLINES, PROFILES, getProfile } from "../src/core/profiles.js";
import { loadState, saveState } from "../src/core/state.js";
import { closestProfile, suggestDisciplines } from "../src/core/suggest.js";
import {
  CLI,
  cli,
  isolateUserConfig,
  legacyProject,
  makeProject,
  tempDir,
  write,
  writeValidArtifacts,
} from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});
const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });

const yes: ConfirmChange = () => Promise.resolve({ approver: "tester" });

/** A project whose pipeline is at `current`, with every earlier phase completed (or adopted). */
function projectAt(
  ids: string[],
  current: Phase | "done",
  adopted: Phase[] = [],
  overrides = {},
): string {
  const root = makeProject(ids, overrides);
  const state = loadState(root);
  const phases: Phase[] = ["briefing", "spec", "plan", "build", "qa", "retro"];
  const until = current === "done" ? phases.length : phases.indexOf(current);
  saveState(root, {
    ...state,
    currentPhase: current,
    completed: phases.slice(0, until).map((phase) => ({
      phase,
      at: "2026-01-01T00:00:00.000Z",
      ...(adopted.includes(phase) ? { adopted: true } : {}),
    })),
  });
  return root;
}

describe("perfiles", () => {
  const registry = loadDisciplines();

  it("todos usan disciplinas que existen y no repiten ninguna", () => {
    for (const [name, profile] of Object.entries(PROFILES)) {
      expect(new Set(profile.disciplinas).size, name).toBe(profile.disciplinas.length);
      for (const id of profile.disciplinas) expect(registry.get(id), `${name}/${id}`).toBeDefined();
    }
  });

  it("base son las 9 disciplinas base y los demás perfiles las contienen o las recortan a propósito", () => {
    expect(getProfile("base").disciplinas).toEqual([...BASE_DISCIPLINES]);
    for (const name of ["api", "web", "erp"]) {
      expect(getProfile(name).disciplinas.slice(0, 9)).toEqual([...BASE_DISCIPLINES]);
    }
  });

  it("un perfil desconocido da un error que lista los válidos", () => {
    expect(() => getProfile("movil")).toThrow(/Perfiles: base, api, web, erp, lib/);
  });
});

describe("evol disciplines enable/disable (criterio 34)", () => {
  it("valida ids, módulo y estado actual antes de tocar nada", () => {
    const ctx = loadContext(makeProject(["SDD", "TDD"]));
    const plan = (change: { module?: string; enable?: string[]; disable?: string[] }) =>
      planChange(ctx, { module: "app", enable: [], disable: [], ...change });
    expect(() => plan({ enable: ["NOPE"] })).toThrow(/Disciplina desconocida «NOPE»/);
    expect(() => plan({ enable: ["TDD"] })).toThrow(/ya está activa/);
    expect(() => plan({ disable: ["BDD"] })).toThrow(/no está activa/);
    expect(() => plan({ module: "otro", enable: ["BDD"] })).toThrow(/No existe el módulo/);
    expect(() => plan({})).toThrow(/ninguna disciplina/);
    expect(() => plan({ enable: ["BDD"], disable: ["BDD"] })).toThrow(/a la vez/);
  });

  it("activa una disciplina, lo registra en el diario y valida la configuración", async () => {
    const root = makeProject(["SDD"]);
    const ctx = loadContext(root);
    const summary = await changeDisciplines(
      ctx,
      { module: "app", enable: ["BDD", "TDD"], disable: [] },
      yes,
    );
    expect(summary.enabled).toEqual(["BDD", "TDD"]);
    expect(loadConfig(root, loadDisciplines()).modules[0]?.disciplinas).toEqual([
      "SDD",
      "BDD",
      "TDD",
    ]);
    const event = journalRead(root).find((e) => e.type === "disciplines-changed");
    expect(event).toMatchObject({ module: "app", enabled: ["BDD", "TDD"], approver: "tester" });
  });

  it("al desactivar una disciplina de una fase ya aprobada, vuelve a esa fase y su aprobación deja de valer", async () => {
    const root = projectAt(["SDD", "TDD"], "qa");
    writeValidArtifacts(root, "SDD");
    writeValidArtifacts(root, "TDD");
    const ctx = loadContext(root);
    const key = ensureKey(ctx.state.projectId);
    appendApproval(root, key, {
      phase: "build",
      approver: "tester",
      artifacts: currentArtifacts(ctx, "build"),
    });
    expect(
      findValidApproval(readLog(root), "build", currentArtifacts(ctx, "build")),
    ).not.toBeNull();

    const summary = await changeDisciplines(
      ctx,
      { module: "app", enable: [], disable: ["TDD"] },
      yes,
    );

    expect(summary.affected).toEqual(["build"]);
    expect(summary.rewoundTo).toBe("build");
    const after = loadContext(root);
    expect(after.state.currentPhase).toBe("build");
    expect(after.state.completed.map((c) => c.phase)).toEqual(["briefing", "spec", "plan"]);
    expect(findValidApproval(readLog(root), "build", currentArtifacts(after, "build"))).toBeNull();
    expect(journalRead(root).at(-1)).toMatchObject({ rewoundTo: "build" });
  });

  it("si la disciplina solo aplica a una fase futura, el pipeline no se mueve", async () => {
    const root = projectAt(["SDD"], "spec");
    const summary = await changeDisciplines(
      loadContext(root),
      { module: "app", enable: ["TDD"], disable: [] },
      yes,
    );
    expect(summary.affected).toEqual([]);
    expect(summary.rewoundTo).toBeNull();
    expect(loadState(root).currentPhase).toBe("spec");
  });

  it("si aplica a la fase actual no retrocede: su aprobación queda obsoleta por la configuración", async () => {
    const root = projectAt(["SDD"], "build");
    const summary = await changeDisciplines(
      loadContext(root),
      { module: "app", enable: ["TDD"], disable: [] },
      yes,
    );
    expect(summary.affected).toEqual(["build"]);
    expect(summary.rewoundTo).toBeNull();
  });

  it("no retrocede a fases adoptadas, que nunca tuvieron aprobación", async () => {
    const root = projectAt(["SDD"], "plan", ["briefing", "spec"]);
    const summary = await changeDisciplines(
      loadContext(root),
      { module: "app", enable: ["FDD"], disable: [] },
      yes,
    );
    expect(summary.affected).toEqual(["briefing", "plan"]);
    expect(summary.rewoundTo).toBeNull();
    expect(loadState(root).completed.map((c) => c.phase)).toEqual(["briefing", "spec"]);
  });

  it("sin una persona que confirme no cambia nada", async () => {
    const root = projectAt(["SDD", "TDD"], "qa");
    const before = {
      config: readFileSync(join(root, "evol.config.json"), "utf8"),
      state: readFileSync(join(root, ".evol/state.json"), "utf8"),
    };
    const refuse: ConfirmChange = () => Promise.reject(new NotInteractiveError());
    await expect(
      changeDisciplines(loadContext(root), { module: "app", enable: [], disable: ["TDD"] }, refuse),
    ).rejects.toBeInstanceOf(NotInteractiveError);
    expect(readFileSync(join(root, "evol.config.json"), "utf8")).toBe(before.config);
    expect(readFileSync(join(root, ".evol/state.json"), "utf8")).toBe(before.state);
    expect(journalRead(root).some((e) => e.type === "disciplines-changed")).toBe(false);
  });

  it("al desactivar una disciplina quita sus rutas y comandos para que la configuración siga siendo válida", async () => {
    const root = makeProject(["SDD", "TDD"]);
    const ctx = loadContext(root);
    ctx.config = {
      ...ctx.config,
      modules: [
        {
          name: "app",
          root: ".",
          disciplinas: ["SDD", "TDD"],
          rutas: { "tests/unit/*.test.ts": "src/**/*.test.ts", "docs/specs/SPEC.md": "SPEC.md" },
          comandos: { TDD: "npm test" },
        },
      ],
    };
    await changeDisciplines(ctx, { module: "app", enable: [], disable: ["TDD"] }, yes);
    const module = loadConfig(root, loadDisciplines()).modules[0];
    expect(module?.rutas).toEqual({ "docs/specs/SPEC.md": "SPEC.md" });
    expect(module?.comandos).toBeUndefined();
  });

  it("desde la CLI, sin terminal, falla y no cambia la configuración", () => {
    const root = makeProject(["SDD", "TDD"]);
    const before = readFileSync(join(root, "evol.config.json"), "utf8");
    for (const action of ["enable", "disable"]) {
      const r = cli(["disciplines", action, action === "enable" ? "BDD" : "TDD"], {
        cwd: root,
        env: env(),
      });
      expect(r.status, action).not.toBe(0);
      expect(r.stderr).toContain("terminal interactiva");
    }
    expect(readFileSync(join(root, "evol.config.json"), "utf8")).toBe(before);
  });

  const hasScript = spawnSync("script", ["--version"], { encoding: "utf8" }).status === 0;

  function inTerminal(root: string, args: string, input: string) {
    const command = `${process.execPath} --disable-warning=ExperimentalWarning ${CLI} disciplines ${args}`;
    return spawnSync("script", ["-qec", command, "/dev/null"], {
      cwd: root,
      input,
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, ...env() },
    });
  }

  it.skipIf(!hasScript)("en una terminal real, escribir «confirmar» aplica el cambio", () => {
    const root = makeProject(["SDD"]);
    const r = inTerminal(root, "enable BDD", "confirmar\n");
    expect(r.stdout).toContain("Listo");
    expect(loadConfig(root, loadDisciplines()).modules[0]?.disciplinas).toContain("BDD");
  });

  it.skipIf(!hasScript)("en una terminal real, escribir otra cosa cancela", () => {
    const root = makeProject(["SDD"]);
    const r = inTerminal(root, "enable BDD", "no\n");
    expect(r.stdout + r.stderr).toContain("cancelado");
    expect(loadConfig(root, loadDisciplines()).modules[0]?.disciplinas).toEqual(["SDD"]);
  });
});

describe("evol disciplines list, profiles y suggest", () => {
  it("list --json incluye las 31 disciplinas y dónde están activas", () => {
    const root = makeProject(["SDD", "TDD"]);
    const r = cli(["disciplines", "list", "--json"], { cwd: root, env: env() });
    expect(r.status).toBe(0);
    const rows = JSON.parse(r.stdout) as { id: string; modulos: string[] }[];
    expect(rows).toHaveLength(31);
    expect(rows.find((d) => d.id === "TDD")?.modulos).toEqual(["app"]);
    expect(rows.find((d) => d.id === "BDD")?.modulos).toEqual([]);
  });

  it("list --json dice el rol que aplica cada disciplina", () => {
    const root = makeProject(["SDD", "TDD"]);
    const r = cli(["disciplines", "list", "--json"], { cwd: root, env: env() });
    const rows = JSON.parse(r.stdout) as { id: string; rol: string }[];
    expect(rows.find((d) => d.id === "TDD")?.rol).toBe("constructor");
    expect(rows.find((d) => d.id === "SDD")?.rol).toBe("arquitecto");
    expect(rows.every((d) => typeof d.rol === "string" && d.rol !== "")).toBe(true);
  });

  it("profiles muestra todos los perfiles", () => {
    const r = cli(["disciplines", "profiles"], { cwd: tempDir(), env: env() });
    expect(r.status).toBe(0);
    for (const name of Object.keys(PROFILES)) expect(r.stdout).toContain(name);
  });

  it("suggest propone disciplinas según las dependencias y archivos, sin las ya activas", () => {
    const root = tempDir("evol-suggest-");
    write(root, "package.json", '{ "dependencies": { "express": "^5", "pg": "^8" } }');
    write(root, "Dockerfile", "FROM node\n");
    const ids = suggestDisciplines(root, new Set(["MDD"])).map((s) => s.id);
    expect(ids).toEqual(["ODD_API", "APIVDD", "PIPELINE"]);
  });

  it("suggest no inventa nada en un proyecto vacío y dice el perfil más cercano", () => {
    const root = tempDir("evol-suggest-");
    expect(suggestDisciplines(root, new Set())).toEqual([]);
    expect(closestProfile(new Set(PROFILES["erp"]?.disciplinas))).toBe("erp");
    expect(closestProfile(new Set(BASE_DISCIPLINES))).toBe("base");
  });

  it("suggest desde la CLI no modifica el proyecto", () => {
    const root = makeProject(["SDD"]);
    write(root, "package.json", '{ "dependencies": { "react": "^19" } }');
    const before = readFileSync(join(root, "evol.config.json"), "utf8");
    const r = cli(["disciplines", "suggest"], { cwd: root, env: env() });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("UXDD");
    expect(r.stdout).toContain("A11yDD");
    expect(readFileSync(join(root, "evol.config.json"), "utf8")).toBe(before);
  });
});

describe("--perfil en evol new e init (criterio 34)", () => {
  it("evol new --perfil api crea el módulo con las disciplinas del perfil", () => {
    const parent = tempDir("evol-new-");
    const r = cli(
      [
        "new",
        "mi-api",
        "--perfil",
        "api",
        "--no-install",
        "--no-git",
        "--no-memory",
        "--no-agentes",
      ],
      { cwd: parent, env: env() },
    );
    expect(r.status, r.stderr).toBe(0);
    const config = loadConfig(join(parent, "mi-api"), loadDisciplines());
    expect(config.modules[0]?.disciplinas).toEqual(getProfile("api").disciplinas);
    expect(journalRead(join(parent, "mi-api"))[0]).toMatchObject({ perfil: "api" });
  });

  it("evol init --perfil erp adopta con ese conjunto", () => {
    const root = legacyProject();
    const r = cli(["init", "--perfil", "erp", "--no-memory", "--no-agentes"], {
      cwd: root,
      env: env(),
    });
    expect(r.status, r.stderr).toBe(0);
    const config = loadConfig(root, loadDisciplines());
    expect(config.modules[0]?.disciplinas).toEqual(getProfile("erp").disciplinas);
  });

  it("un perfil desconocido falla sin crear nada, y --perfil con --disciplinas es un error", () => {
    const root = legacyProject();
    const unknown = cli(["init", "--perfil", "movil"], { cwd: root, env: env() });
    expect(unknown.status).not.toBe(0);
    expect(unknown.stderr).toContain("Perfil desconocido");
    const both = cli(["init", "--perfil", "api", "--disciplinas", "SDD"], {
      cwd: root,
      env: env(),
    });
    expect(both.status).not.toBe(0);
    expect(both.stderr).toContain("--perfil o --disciplinas");
    expect(readFileSync(join(root, "SPEC.md"), "utf8")).toContain("Spec");
    expect(() => loadConfig(root, loadDisciplines())).toThrow();
  });
});
