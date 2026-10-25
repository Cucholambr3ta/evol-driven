import { describe, expect, it } from "vitest";
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
