import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig, makeProject, write } from "../helpers.js";

const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];
const env = () => ({ EVOL_CONFIG_DIR: isolateUserConfig() });

function readOpencode(root: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, "opencode.json"), "utf8")) as Record<string, unknown>;
}

describe("evol como agente propio en OpenCode", () => {
  it("CA-137: el proyecto queda con «evol» como agente por defecto y su propio agente", () => {
    const root = makeProject(DISC);
    write(root, "opencode.json", JSON.stringify({ $schema: "https://opencode.ai/config.json" }));

    const result = cli(["agents"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    const config = readOpencode(root);
    expect(config["default_agent"]).toBe("evol");
    const agent = (config["agent"] as Record<string, { mode?: string }>)["evol"];
    expect(agent?.mode).toBe("primary");
  });

  it("CA-138: ejecutar evol agents otra vez no cambia opencode.json", () => {
    const root = makeProject(DISC);
    write(root, "opencode.json", JSON.stringify({ $schema: "https://opencode.ai/config.json" }));
    cli(["agents"], { cwd: root, env: env() });
    const first = readFileSync(join(root, "opencode.json"), "utf8");

    cli(["agents"], { cwd: root, env: env() });

    expect(readFileSync(join(root, "opencode.json"), "utf8")).toBe(first);
  });

  it("CA-138: deshacer devuelve el default_agent anterior", () => {
    const root = makeProject(DISC);
    write(
      root,
      "opencode.json",
      JSON.stringify({ $schema: "https://opencode.ai/config.json", default_agent: "otro-agente" }),
    );
    cli(["agents"], { cwd: root, env: env() });
    expect(readOpencode(root)["default_agent"]).toBe("evol");

    const result = cli(["agents", "--deshacer"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    expect(readOpencode(root)["default_agent"]).toBe("otro-agente");
  });

  it("CA-139: el permiso de bash del agente evol deniega evol approve", () => {
    const root = makeProject(DISC);
    write(root, "opencode.json", JSON.stringify({ $schema: "https://opencode.ai/config.json" }));

    cli(["agents"], { cwd: root, env: env() });

    const config = readOpencode(root);
    const agent = (config["agent"] as Record<string, { permission?: Record<string, unknown> }>)[
      "evol"
    ];
    const bash = agent?.permission?.["bash"] as Record<string, string> | undefined;
    const denyRule = Object.entries(bash ?? {}).find(
      ([pattern, effect]) => effect === "deny" && pattern.startsWith("evol approve"),
    );
    expect(denyRule).toBeDefined();
  });
});
