import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig, makeProject } from "../helpers.js";

const env = () => ({ EVOL_CONFIG_DIR: isolateUserConfig() });

describe("rutas sensibles bloqueadas por defecto", () => {
  it("CA-134: el permiso de Claude Code deniega leer ~/.ssh y editar el gate", () => {
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

    const settings = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8")) as {
      permissions: { deny: string[] };
    };
    const deny = settings.permissions.deny;
    expect(deny).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\.ssh/),
        expect.stringMatching(/\.env/),
        expect.stringMatching(/\*\.pem/),
        expect.stringMatching(/\*\.key/),
        expect.stringMatching(/\.aws[/\\]credentials/),
        expect.stringContaining(".evol/state.json"),
        expect.stringContaining(".evol/gate-log.jsonl"),
        expect.stringContaining("evol ciclo"),
      ]),
    );
  });

  it("CA-134: doctor detecta que el estado no concuerda con el registro firmado", () => {
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
    const statePath = join(root, ".evol", "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8")) as { currentPhase: string };
    state.currentPhase = "qa"; // alterado a mano, sin pasar por el gate firmado
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    const result = cli(["doctor"], { cwd: root, env: env() });

    expect(result.stdout).toMatch(/no concuerda con.*registro firmado|no coincide con.*aprobaci/i);
  });
});
