import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll } from "vitest";
import { saveConfig } from "../src/core/config.js";
import type { EvolConfig } from "../src/core/config.js";
import { loadDisciplines } from "../src/core/disciplines.js";
import { ensureKey } from "../src/core/gate.js";
import type { Phase } from "../src/core/phases.js";
import { initState } from "../src/core/state.js";

export const REPO = join(import.meta.dirname, "..");
const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

export function tempDir(prefix = "evol-test-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

export function write(root: string, rel: string, content: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

export function copyFixture(name: string): string {
  const dir = tempDir(`evol-${name}-`);
  cpSync(join(REPO, "tests", "fixtures", name), dir, { recursive: true });
  return dir;
}

export function git(cwd: string, ...args: string[]): void {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    },
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
}

/** Isolates the gate keys of a test file from the real ~/.config/evol. */
export function isolateUserConfig(): string {
  const dir = tempDir("evol-userconfig-");
  process.env["EVOL_CONFIG_DIR"] = dir;
  return dir;
}

export function baseConfig(disciplinas: string[], overrides: Partial<EvolConfig> = {}): EvolConfig {
  return {
    name: "demo",
    version: 1,
    codeIntel: "native",
    memory: { wing: "demo", enabled: false },
    qa: { requireTestsForChangedSymbols: false, requireCriteriaCoverage: false },
    modules: [{ name: "app", root: ".", disciplinas }],
    ...overrides,
  };
}

/** A bare project (config, state, key) without any template files. */
export function makeProject(disciplinas: string[], overrides: Partial<EvolConfig> = {}): string {
  const root = tempDir("evol-project-");
  saveConfig(root, baseConfig(disciplinas, overrides));
  const state = initState(root);
  ensureKey(state.projectId);
  return root;
}

export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export const CLI = join(REPO, "dist", "cli.js");

/** Runs the compiled CLI with no terminal attached to stdin/stdout. */
export function cli(
  args: string[],
  options: { cwd: string; env?: Record<string, string> },
): CliResult {
  const result = spawnSync(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", CLI, ...args],
    {
      cwd: options.cwd,
      encoding: "utf8",
      env: { ...process.env, ...options.env },
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Builds files that satisfy a discipline definition, so each of the 31 can be exercised. */
export function writeValidArtifacts(root: string, id: string): void {
  const d = loadDisciplines().get(id);
  if (!d) throw new Error(`disciplina desconocida: ${id}`);
  const known: Record<string, string> = {
    "docs/specs/SPEC.md": "# Spec\n\n## Criterios de aceptación\n\n1. algo\n",
    "docs/features/FEATURES.md": "# Features\n\n## Una feature\n",
    "docs/specs/DOMAIN.md": "# Dominio\n\n## Entidades\n\nx\n\n## Reglas\n\ny\n",
    "docs/specs/THREATS.md": "# Amenazas\n\n## Amenazas\n\nx\n\n## Mitigaciones\n\ny\n",
    ".evol/qa/QA_REPORT.md": "# QA\n\n- [x] CRITICAL: resuelto\n",
  };
  for (const a of d.artefactos) {
    const rel = a.patron.replaceAll("**", "x").replaceAll("*", "x");
    const content =
      known[rel] ??
      {
        json: "{}",
        avsc: '{"type":"record","name":"E","fields":[]}',
        yaml: "a: 1\n",
        feature: "Feature: f\n  Scenario: s\n    Given algo\n",
        puml: "@startuml\n@enduml\n",
        md: "# Título\n\ncontenido\n",
        sql: "select 1;\n",
        tf: 'resource "x" "y" {}\n',
        ts: "export {};\n",
        texto: "texto\n",
      }[a.formato];
    write(root, rel, content ?? "x");
  }
}

/** Like makeProject, but joins the pipeline at `phase` (earlier phases count as adopted). */
export function makeProjectAt(
  phase: Phase,
  disciplinas: string[],
  overrides: Partial<EvolConfig> = {},
): string {
  const root = tempDir("evol-project-");
  saveConfig(root, baseConfig(disciplinas, overrides));
  const state = initState(root, phase);
  ensureKey(state.projectId);
  return root;
}

/** A project that predates evol: documents at the root, Jest instead of Vitest, files of its own. */
export function legacyProject(): string {
  const root = tempDir("evol-legacy-");
  write(
    root,
    "package.json",
    '{ "name": "@acme/erp-ventas", "version": "1.2.0", "scripts": { "test": "jest" }, "devDependencies": { "jest": "^29" } }\n',
  );
  write(root, "SPEC.md", "# Spec\n\n## Criterios de aceptación\n\n1. algo\n");
  write(root, "DOMAIN.md", "# Dominio\n\n## Entidades\n\nx\n\n## Reglas\n\ny\n");
  write(root, "FEATURES.md", "# Features\n\n## Ventas\n");
  write(
    root,
    "src/venta.ts",
    "export function total(a: number, b: number): number {\n  return a + b;\n}\n",
  );
  write(root, "CLAUDE.md", "# Reglas del equipo\n\nNo usar any.\n");
  write(root, ".gitignore", "node_modules\n");
  write(
    root,
    ".claude/settings.json",
    '{ "permissions": { "allow": ["Bash(npm test)"] }, "hooks": { "SessionStart": [{ "hooks": [{ "type": "command", "command": "echo hola" }] }] } }\n',
  );
  return root;
}

/**
 * Stand-ins for the security tools that find nothing, so a test that goes through SecDD does not
 * depend on which tools (or which network) the machine has. Pass the result in a command's `env`.
 */
export function cleanSecurityTools(): Record<string, string> {
  const dir = tempDir("evol-clean-tools-");
  const make = (name: string, body: string): string => {
    const file = join(dir, name);
    writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    chmodSync(file, 0o755);
    return file;
  };
  return {
    EVOL_TOOL_GITLEAKS: make(
      "gitleaks",
      `case "$1" in version) echo 8.99.0; exit 0;; esac
while [ $# -gt 0 ]; do if [ "$1" = "--report-path" ]; then shift; echo "[]" > "$1"; fi; shift; done`,
    ),
    EVOL_TOOL_SEMGREP: make(
      "semgrep",
      `case "$1" in --version) echo 1.99.0; exit 0;; esac
echo '{"results":[],"errors":[]}'`,
    ),
    EVOL_TOOL_BANDIT: make(
      "bandit",
      `case "$1" in --version) echo "bandit 1.9.4"; exit 0;; esac
echo '{"errors":[],"results":[]}'`,
    ),
    EVOL_TOOL_SHELLCHECK: make(
      "shellcheck",
      `case "$1" in --version) echo "version: 0.11.0"; exit 0;; esac
echo '[]'`,
    ),
    EVOL_TOOL_OSV_SCANNER: make(
      "osv-scanner",
      `case "$1" in --version) echo "osv-scanner version: 2.7.0"; exit 0;; esac
echo '{"results":[]}'`,
    ),
    EVOL_TOOL_GUARDDOG: "",
  };
}
