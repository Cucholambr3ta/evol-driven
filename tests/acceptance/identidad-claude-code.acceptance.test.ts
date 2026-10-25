import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig, makeProject } from "../helpers.js";

const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];
const env = () => ({ EVOL_CONFIG_DIR: isolateUserConfig() });

describe("identidad propia en Claude Code", () => {
  it("CA-140: el proyecto queda con el estilo Evol y una línea de estado propia", () => {
    const root = makeProject(DISC);

    const result = cli(["agents"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    expect(existsSync(join(root, ".claude", "output-styles", "evol.md"))).toBe(true);
    const settings = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8")) as {
      outputStyle?: string;
      statusLine?: { command?: string };
    };
    expect(settings.outputStyle).toBe("Evol");
    expect(settings.statusLine?.command).toMatch(/evol status/);
  });

  it("CA-141: deshacer retira el estilo y la línea de estado, sin tocar lo demás", () => {
    const root = makeProject(DISC);
    cli(["agents"], { cwd: root, env: env() });

    const result = cli(["agents", "--deshacer"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    expect(existsSync(join(root, ".claude", "settings.json"))).toBe(false);
    expect(existsSync(join(root, ".claude", "output-styles", "evol.md"))).toBe(false);
  });
});
