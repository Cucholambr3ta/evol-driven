import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approvePhase, loadContext } from "../../src/core/pipeline.js";
import type { Confirm } from "../../src/core/pipeline.js";
import { cli, isolateUserConfig, makeProject, writeValidArtifacts } from "../helpers.js";

const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];
const env = () => ({ EVOL_CONFIG_DIR: isolateUserConfig() });
const yes: Confirm = () => Promise.resolve({ approver: "ana" });

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
        expect.stringMatching(/\.config[/\\]evol[/\\]keys/),
      ]),
    );
  });

  it("CA-134: doctor detecta que el estado no concuerda con el registro firmado", async () => {
    // una sola config de usuario para esta prueba: la clave del gate que approvePhase crea aquí
    // tiene que ser la misma que lee el subproceso de «evol doctor» más abajo.
    const config = isolateUserConfig();
    const root = makeProject(DISC);
    // una aprobación real de "briefing": el registro firmado dice que la fase siguiente es "spec"
    for (const id of DISC) writeValidArtifacts(root, id);
    const ctx = loadContext(root, {
      run: () => ({ ok: true, output: "" }),
      securityScan: () => [],
    });
    await approvePhase(ctx, "briefing", yes);

    const statePath = join(root, ".evol", "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8")) as { currentPhase: string };
    state.currentPhase = "qa"; // alterado a mano, sin pasar por el gate firmado (debería ser "spec")
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    const result = cli(["doctor"], { cwd: root, env: { EVOL_CONFIG_DIR: config } });

    expect(result.stdout).toMatch(/no concuerda con.*registro firmado|no coincide con.*aprobaci/i);
  });
});
