import { advance, loadContext } from "../core/pipeline.js";
import { makeRecorder } from "../memory/events.js";
import { out, requireProject, warn } from "./shared.js";

export default async function run(): Promise<number> {
  const root = requireProject();
  const ctx = loadContext(root);
  ctx.record = makeRecorder(root, ctx.config, warn);
  const from = ctx.state.currentPhase;
  const result = await advance(ctx);
  if (!result.advanced) {
    out(`No se puede avanzar desde «${from}»:`);
    for (const problem of result.problems) out(problem);
    return 1;
  }
  out(`Fase «${from}» completada.`);
  out(result.phase === "done" ? "El pipeline terminó." : `Fase actual: ${result.phase}`);
  return 0;
}
