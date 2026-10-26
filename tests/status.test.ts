import { describe, expect, it } from "vitest";
import { appendApproval, ensureKey } from "../src/core/gate.js";
import { loadContext } from "../src/core/pipeline.js";
import { loadState, saveState } from "../src/core/state.js";
import { renderStatusLine, statusReport } from "../src/core/status.js";
import { isolateUserConfig, makeProjectAt } from "./helpers.js";

describe("renderStatusLine (criterio 140)", () => {
  it("cuenta lo que falta de la fase actual", () => {
    isolateUserConfig();
    const root = makeProjectAt("briefing", ["FDD"]);
    const line = renderStatusLine(statusReport(loadContext(root)));
    expect(line).toBe("Evol · briefing · 1 pendiente");
  });

  it("sin nada pendiente, muestra el estado de la aprobación", () => {
    isolateUserConfig();
    const root = makeProjectAt("briefing", []);
    const line = renderStatusLine(statusReport(loadContext(root)));
    expect(line).toBe("Evol · briefing · pendiente");
  });

  it("en «done», un mensaje fijo", () => {
    isolateUserConfig();
    const root = makeProjectAt("retro", []);
    const state = loadState(root);
    saveState(root, { ...state, currentPhase: "done" });
    const line = renderStatusLine(statusReport(loadContext(root)));
    expect(line).toBe("Evol · listo (done)");
  });
});

describe("el estado de la aprobación al abrir un ciclo nuevo (m-005)", () => {
  function conAprobacionDelCicloUno(): string {
    isolateUserConfig();
    const root = makeProjectAt("briefing", ["FDD"]);
    const state = loadState(root);
    appendApproval(root, ensureKey(state.projectId), { phase: "briefing", artifacts: {} });
    return root;
  }

  it("una aprobación del ciclo anterior no cuenta: la fase está pendiente, no «obsoleta»", () => {
    const root = conAprobacionDelCicloUno();
    saveState(root, { ...loadState(root), ciclo: 2 });

    const report = statusReport(loadContext(root));

    expect(report.approval.state).toBe("pendiente");
  });

  it("en el mismo ciclo, una aprobación cuyos artefactos cambiaron sigue siendo «obsoleta»", () => {
    const root = conAprobacionDelCicloUno();

    const report = statusReport(loadContext(root));

    expect(report.approval.state).toBe("obsoleta");
  });

  it("una aprobación del ciclo en curso cuyos artefactos cambiaron es «obsoleta»", () => {
    const root = conAprobacionDelCicloUno();
    const state = loadState(root);
    saveState(root, { ...state, ciclo: 2 });
    appendApproval(root, ensureKey(state.projectId), {
      phase: "briefing",
      artifacts: {},
      ciclo: 2,
    });

    const report = statusReport(loadContext(root));

    expect(report.approval.state).toBe("obsoleta");
  });
});
