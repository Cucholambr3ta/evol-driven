import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { packageVersion } from "../src/core/paths.js";
import { PLACEHOLDER_TEXT } from "../src/core/verify.js";
import {
  CLI,
  cli,
  isolateUserConfig,
  makeProject,
  tempDir,
  writeValidArtifacts,
} from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });
const NO_MEMPALACE = { EVOL_MEMPALACE_CMD: "evol-test-no-such-command" };

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

describe("evol (ayuda y errores)", () => {
  it("--version imprime la versión de package.json", () => {
    const r = cli(["--version"], { cwd: tempDir(), env: env() });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(packageVersion());
  });

  it("--help lista los comandos de la especificación", () => {
    const r = cli(["--help"], { cwd: tempDir(), env: env() });
    for (const name of [
      "new",
      "status",
      "next",
      "approve",
      "memory",
      "index",
      "impact",
      "trace",
      "doctor",
    ]) {
      expect(r.stdout).toContain(name);
    }
  });

  it("un comando desconocido termina con código 2", () => {
    expect(cli(["nada"], { cwd: tempDir(), env: env() }).status).toBe(2);
  });

  it("fuera de un proyecto, status explica qué pasa", () => {
    const r = cli(["status"], { cwd: tempDir(), env: env() });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("No estás dentro de un proyecto evol");
  });
});

describe("evol new (criterios 1 y 3)", () => {
  it("crea el proyecto con la plantilla, la configuración, el estado y Git", () => {
    const parent = tempDir();
    const r = cli(["new", "demo-app", "--dir", parent, "--no-install", "--no-memory"], {
      cwd: parent,
      env: env(),
    });
    expect(r.status, r.stderr).toBe(0);
    const project = join(parent, "demo-app");
    for (const f of [
      "evol.config.json",
      "package.json",
      "tsconfig.json",
      ".gitignore",
      "src/index.ts",
      "tests/unit/index.test.ts",
      "docs/specs/SPEC.md",
      ".evol/state.json",
      "lecciones.md",
    ]) {
      expect(existsSync(join(project, f)), f).toBe(true);
    }
    expect(existsSync(join(project, ".git"))).toBe(true);
    expect(readFileSync(join(project, "package.json"), "utf8")).toContain('"name": "demo-app"');
    const config = JSON.parse(readFileSync(join(project, "evol.config.json"), "utf8")) as {
      memory: { wing: string; enabled: boolean };
      modules: { disciplinas: string[] }[];
    };
    expect(config.memory).toEqual({ wing: "demo_app", enabled: false });
    expect(config.modules[0]?.disciplinas).toHaveLength(14);
    expect(readFileSync(join(project, "docs/specs/SPEC.md"), "utf8")).not.toContain("{{");
  });

  it("la clave del gate no está dentro del proyecto ni en su Git", () => {
    const parent = tempDir();
    cli(["new", "sin-clave", "--dir", parent, "--no-install", "--no-memory"], {
      cwd: parent,
      env: env(),
    });
    const project = join(parent, "sin-clave");
    const state = JSON.parse(readFileSync(join(project, ".evol/state.json"), "utf8")) as {
      projectId: string;
    };
    const keyFile = join(userConfig, "keys", `${state.projectId}.key`);
    expect(existsSync(keyFile)).toBe(true);
    const keyHex = readFileSync(keyFile, "utf8").trim();
    for (const file of filesUnder(project)) {
      expect(file.endsWith(".key"), file).toBe(false);
      expect(readFileSync(file, "utf8"), file).not.toContain(keyHex);
    }
    const tracked = spawnSync("git", ["ls-files", "-o", "-c", "--exclude-standard"], {
      cwd: project,
      encoding: "utf8",
    });
    expect(tracked.stdout).not.toMatch(/\.key/);
  });

  it("rechaza nombres inválidos y carpetas ocupadas", () => {
    const parent = tempDir();
    expect(cli(["new", "Mal Nombre", "--dir", parent], { cwd: parent, env: env() }).status).toBe(1);
    const first = cli(["new", "ya", "--dir", parent, "--no-install", "--no-memory"], {
      cwd: parent,
      env: env(),
    });
    expect(first.status).toBe(0);
    const again = cli(["new", "ya", "--dir", parent, "--no-install", "--no-memory"], {
      cwd: parent,
      env: env(),
    });
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("ya existe");
  });

  it("una plantilla sin completar no puede aprobarse: lo dice el verificador", () => {
    const parent = tempDir();
    cli(["new", "vacio", "--dir", parent, "--no-install", "--no-memory"], {
      cwd: parent,
      env: env(),
    });
    const r = cli(["next"], { cwd: join(parent, "vacio"), env: env() });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(PLACEHOLDER_TEXT);
  });
});

describe("evol approve (criterio 2)", () => {
  it("sin terminal interactiva falla y no cambia el estado", () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    const before = readFileSync(join(root, ".evol/state.json"), "utf8");
    const r = cli(["approve", "briefing"], { cwd: root, env: env() });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("terminal interactiva");
    expect(existsSync(join(root, ".evol/gate-log.jsonl"))).toBe(false);
    expect(readFileSync(join(root, ".evol/state.json"), "utf8")).toBe(before);
  });

  it("no existe ninguna opción para saltarse la confirmación", () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    for (const flag of ["--yes", "-y", "--force", "--no-confirm"]) {
      const r = cli(["approve", "briefing", flag], { cwd: root, env: env() });
      expect(r.status, flag).not.toBe(0);
    }
    expect(existsSync(join(root, ".evol/gate-log.jsonl"))).toBe(false);
  });
});

const hasScript = spawnSync("script", ["--version"], { encoding: "utf8" }).status === 0;

describe.skipIf(!hasScript)("aprobación en una terminal real (pty)", () => {
  function inTerminal(root: string, input: string) {
    const command = `${process.execPath} --disable-warning=ExperimentalWarning ${CLI} approve briefing`;
    return spawnSync("script", ["-qec", command, "/dev/null"], {
      cwd: root,
      input,
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, ...env() },
    });
  }

  it("escribir el nombre de la fase aprueba, y next avanza", () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    const r = inTerminal(root, "briefing\n");
    expect(r.stdout).toContain("aprobada");
    expect(
      readFileSync(join(root, ".evol/gate-log.jsonl"), "utf8").trim().split("\n"),
    ).toHaveLength(1);
    const next = cli(["next"], { cwd: root, env: env() });
    expect(next.status, next.stdout + next.stderr).toBe(0);
    expect(next.stdout).toContain("Fase actual: spec");
    expect(cli(["status"], { cwd: root, env: env() }).stdout).toContain("Fase actual: spec");
  });

  it("escribir otra cosa cancela y no registra nada", () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    const r = inTerminal(root, "si\n");
    expect(r.stdout + r.stderr).toContain("cancelada");
    expect(existsSync(join(root, ".evol/gate-log.jsonl"))).toBe(false);
  });
});

describe("evol doctor y memory sin MemPalace (criterio 9)", () => {
  it("doctor indica que falta MemPalace y termina con error", () => {
    const root = makeProject(["FDD"], { memory: { wing: "demo", enabled: true } });
    const r = cli(["doctor"], { cwd: root, env: { ...env(), ...NO_MEMPALACE } });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("✗ MemPalace");
    expect(r.stdout).toContain("uv tool install mempalace");
  });

  it("memory add y search fallan con un mensaje claro, sin guardar nada local engañoso", () => {
    const root = makeProject(["FDD"]);
    for (const args of [
      ["memory", "add", "--tipo", "decision", "--texto", "algo"],
      ["memory", "search", "algo"],
    ]) {
      const r = cli(args, { cwd: root, env: { ...env(), ...NO_MEMPALACE } });
      expect(r.status, args.join(" ")).toBe(1);
      expect(r.stderr).toContain("No se pudo usar MemPalace");
      expect(r.stderr).toContain("uv tool install mempalace");
    }
  });

  it("memory add valida sus argumentos", () => {
    const root = makeProject(["FDD"]);
    expect(
      cli(["memory", "add", "--tipo", "inventado", "--texto", "x"], { cwd: root, env: env() })
        .status,
    ).toBe(1);
    expect(cli(["memory", "add", "--tipo", "decision"], { cwd: root, env: env() }).status).toBe(1);
    expect(cli(["memory"], { cwd: root, env: env() }).status).toBe(1);
  });

  it("memory add de una lección la deja en lecciones.md aunque MemPalace falle", () => {
    const root = makeProject(["FDD"]);
    cli(
      [
        "memory",
        "add",
        "--tipo",
        "leccion",
        "--titulo",
        "Probar antes",
        "--texto",
        "Siempre probar.",
      ],
      {
        cwd: root,
        env: { ...env(), ...NO_MEMPALACE },
      },
    );
    expect(readFileSync(join(root, "lecciones.md"), "utf8")).toContain("### Probar antes");
  });
});

describe("ayuda y opciones erróneas de cada comando", () => {
  // the command names, as the general help lists them
  const commands = (): string[] =>
    cli(["--help"], { cwd: tempDir(), env: env() })
      .stdout.split("\n")
      .map((l) => /^ {2}([a-z]+) {2,}\S/.exec(l)?.[1])
      .filter((n): n is string => n !== undefined);

  it("todos los comandos responden a --help sin ejecutarse, aunque no haya proyecto", () => {
    const names = commands();
    expect(names.length).toBeGreaterThan(25);
    for (const name of names) {
      const r = cli([name, "--help"], { cwd: tempDir(), env: env() });
      expect(r.status, `${name}: ${r.stderr}`).toBe(0);
      expect(r.stdout, name).toContain(`evol ${name} — `);
      expect(r.stderr, name).toBe("");
    }
  }, 120_000);

  it("-h es lo mismo, y los comandos con uso lo muestran", () => {
    const r = cli(["skills", "-h"], { cwd: tempDir(), env: env() });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Uso: evol skills <list|check|export");
    const security = cli(["security", "--help"], { cwd: tempDir(), env: env() });
    expect(security.stdout).toContain("--solo");
  });

  it("una opción desconocida da un mensaje claro y no una traza", () => {
    const r = cli(["skills", "--noexiste"], { cwd: tempDir(), env: env() });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Opción desconocida «--noexiste»");
    expect(r.stderr).toContain("evol skills --help");
    expect(r.stderr).not.toContain("Error inesperado");
    expect(r.stderr).not.toContain("at ");
    const missing = cli(["knowledge", "search", "--fuente"], { cwd: tempDir(), env: env() });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("Falta el valor de «--fuente»");
  });

  it("después de «--» un --help es parte de la pregunta, no una petición de ayuda", () => {
    const r = cli(["knowledge", "search", "--json", "--", "--help"], {
      cwd: tempDir(),
      env: { ...env(), EVOL_KNOWLEDGE_ENGINE: "/no/existe" },
    });
    expect(r.stdout).not.toContain("evol knowledge — ");
  });
});
