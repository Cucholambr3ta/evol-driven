import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig, makeProject } from "../helpers.js";

const env = () => ({ EVOL_CONFIG_DIR: isolateUserConfig() });

describe("escribir con copia, ensayo y vuelta atrás", () => {
  it("CA-132: --dry-run no escribe nada", () => {
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
    expect(existsSync(join(root, "CLAUDE.md"))).toBe(false);

    const result = cli(["agents", "--dry-run"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/CLAUDE\.md/);
    expect(existsSync(join(root, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(root, ".claude", "settings.json"))).toBe(false);
  });

  it("CA-133: deshacer devuelve exactamente lo que había antes de escribir", () => {
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
    cli(["agents"], { cwd: root, env: env() });
    expect(existsSync(join(root, "CLAUDE.md"))).toBe(true);

    const result = cli(["agents", "--deshacer"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    expect(existsSync(join(root, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(root, ".claude", "settings.json"))).toBe(false);
  });

  it("CA-133: deshacer no pisa un archivo que la persona editó después", () => {
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
    cli(["agents"], { cwd: root, env: env() });
    const claudeMd = join(root, "CLAUDE.md");
    const original = readFileSync(claudeMd, "utf8");
    writeFileSync(claudeMd, `${original}\n\n## Mi nota personal, no la toques\n`);
    const editedMtime = statSync(claudeMd).mtimeMs;

    const result = cli(["agents", "--deshacer"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    expect(readFileSync(claudeMd, "utf8")).toContain("Mi nota personal, no la toques");
    expect(statSync(claudeMd).mtimeMs).toBe(editedMtime);
    expect(result.stdout).toMatch(/CLAUDE\.md/);
  });
});
