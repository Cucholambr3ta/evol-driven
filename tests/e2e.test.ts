import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CLI, cli, isolateUserConfig, tempDir } from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });
const hasScript = spawnSync("script", ["--version"], { encoding: "utf8" }).status === 0;

function run(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 280_000,
    env: { ...process.env, ...env() },
  });
}

function replaceMarkers(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) count += replaceMarkers(full);
    else {
      const text = readFileSync(full, "utf8");
      if (text.includes("[[COMPLETAR]]")) {
        writeFileSync(full, text.replaceAll("[[COMPLETAR]]", "completado"));
        count++;
      }
    }
  }
  return count;
}

/** Approves a phase in a real terminal (a pty), the way a person would. */
function approveInTerminal(project: string, phase: string) {
  const command = `${process.execPath} --disable-warning=ExperimentalWarning ${CLI} approve ${phase}`;
  return spawnSync("script", ["-qec", command, "/dev/null"], {
    cwd: project,
    input: `${phase}\n`,
    encoding: "utf8",
    timeout: 280_000,
    env: { ...process.env, ...env() },
  });
}

describe("evol new con instalación real (criterio 1)", () => {
  const parent = tempDir("evol-e2e-");
  const project = join(parent, "demo");

  it("genera un proyecto donde tsc --noEmit y npm test pasan", () => {
    const created = cli(["new", "demo", "--dir", parent, "--no-memory"], {
      cwd: parent,
      env: env(),
    });
    expect(created.status, created.stdout + created.stderr).toBe(0);
    expect(existsSync(join(project, "node_modules", ".bin", "tsc"))).toBe(true);

    const tsc = run("npx", ["tsc", "--noEmit"], project);
    expect(tsc.status, tsc.stdout + tsc.stderr).toBe(0);

    const tests = run("npm", ["test"], project);
    expect(tests.status, tests.stdout + tests.stderr).toBe(0);
    expect(tests.stdout).toMatch(/1 passed/);
  }, 300_000);

  it("el proyecto generado cumple su propio lint, formato y build", () => {
    for (const script of ["lint", "format", "build"]) {
      const r = run("npm", ["run", script], project);
      expect(r.status, `${script}: ${r.stdout}${r.stderr}`).toBe(0);
    }
  }, 300_000);

  it("el indexador funciona sobre el proyecto generado", () => {
    const r = cli(["index"], { cwd: project, env: env() });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("Grafo:");
    const impact = cli(["impact", "add"], { cwd: project, env: env() });
    expect(impact.status, impact.stderr).toBe(0);
    expect(impact.stdout).toContain("tests/unit/index.test.ts");
  }, 120_000);
});

describe.skipIf(!hasScript)("recorrido completo del pipeline sobre un proyecto generado", () => {
  it("la plantilla, una vez completada, pasa las seis fases con aprobación humana en cada una", () => {
    const parent = tempDir("evol-journey-");
    const project = join(parent, "viaje");
    const created = cli(["new", "viaje", "--dir", parent, "--no-memory"], {
      cwd: parent,
      env: env(),
    });
    expect(created.status, created.stderr).toBe(0);

    // Con la plantilla sin completar, el pipeline no avanza.
    expect(cli(["next"], { cwd: project, env: env() }).status).toBe(1);

    expect(replaceMarkers(project)).toBeGreaterThan(5);
    writeFileSync(
      join(project, "lecciones.md"),
      "# Lecciones\n\n### Completar la plantilla antes de aprobar — 2026-01-01\n\nLos marcadores bloquean el gate.\n",
    );

    const visited: string[] = [];
    for (const phase of ["briefing", "spec", "plan", "build", "qa", "retro"]) {
      const status = cli(["status"], { cwd: project, env: env() });
      expect(status.stdout, phase).toContain(`Fase actual: ${phase}`);

      const approved = approveInTerminal(project, phase);
      expect(approved.stdout, `${phase}: ${approved.stdout}`).toContain("aprobada");

      const next = cli(["next"], { cwd: project, env: env() });
      expect(next.status, `${phase}: ${next.stdout}${next.stderr}`).toBe(0);
      visited.push(phase);
    }

    expect(visited).toHaveLength(6);
    const final = cli(["status"], { cwd: project, env: env() });
    expect(final.stdout).toContain("El pipeline terminó");
    const log = readFileSync(join(project, ".evol", "gate-log.jsonl"), "utf8")
      .trim()
      .split("\n");
    expect(log).toHaveLength(6);
    expect(
      cli(["doctor"], {
        cwd: project,
        env: { ...env(), EVOL_MEMPALACE_CMD: "evol-test-no-such-command" },
      }).stdout,
    ).toContain("íntegro");
  }, 600_000);
});
