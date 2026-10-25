import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig, makeProject, write } from "../helpers.js";

const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];
const env = () => ({ EVOL_CONFIG_DIR: isolateUserConfig() });

describe("instrucciones correctas según el repositorio", () => {
  it("CA-148: en el repositorio de evol-driven, invita a editar el framework", () => {
    const root = makeProject(DISC);
    write(root, "package.json", JSON.stringify({ name: "evol-driven", version: "0.0.0" }));
    write(root, ".git/HEAD", "ref: refs/heads/main\n"); // suficiente para que se detecte como repo git

    const result = cli(["agents"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    const agentsMd = readFileSync(join(root, "AGENTS.md"), "utf8");
    expect(agentsMd).not.toMatch(/No modifiques el framework evol desde este proyecto/);
    expect(agentsMd).toMatch(/este repositorio es el origen del framework/i);
  });

  it("CA-148: en cualquier otro proyecto, sigue prohibiendo tocar el framework", () => {
    const root = makeProject(DISC);
    write(root, "package.json", JSON.stringify({ name: "@acme/tienda", version: "1.0.0" }));

    const result = cli(["agents"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    const agentsMd = readFileSync(join(root, "AGENTS.md"), "utf8");
    expect(agentsMd).toMatch(/No modifiques el framework evol desde este proyecto/);
  });
});
