import { UserError } from "../core/errors.js";
import { findProjectRoot } from "../core/paths.js";
import { loadContext } from "../core/pipeline.js";
import { renderStatus, statusReport } from "../core/status.js";
import { withMemPalace } from "../memory/mempalace.js";
import { out } from "./shared.js";

const MEMORY_TIMEOUT_MS = 20_000;

/**
 * `evol hook session-start`: what Claude Code adds to the context when a session begins.
 * It must never fail the session, so every problem becomes a line of text and the exit code is 0.
 */
export default async function run(argv: string[]): Promise<number> {
  const [event] = argv;
  if (event !== "session-start") throw new UserError("Uso: evol hook session-start");

  const root = findProjectRoot();
  if (!root) return 0;

  let phase = "";
  try {
    const ctx = loadContext(root);
    const report = statusReport(ctx);
    phase = String(report.phase);
    out("[evol] Estado del proyecto");
    for (const line of renderStatus(report)) out(`  ${line}`);
    out(
      "  Aprobar (evol approve) y avanzar (evol next) lo hace siempre una persona, en su terminal.",
    );

    if (ctx.config.memory.enabled) {
      try {
        const hits = await withMemPalace(
          (m) =>
            m.search({
              query: `${ctx.config.name} ${phase} decisiones`,
              wing: ctx.config.memory.wing,
              limit: 3,
            }),
          { timeoutMs: MEMORY_TIMEOUT_MS },
        );
        if (hits.length > 0) {
          out("[evol] Memoria relevante del proyecto");
          for (const hit of hits)
            out(`  - [${hit.room}] ${hit.text.replace(/\s+/g, " ").slice(0, 200)}`);
        }
      } catch {
        out("[evol] (MemPalace no disponible: sin memoria en esta sesión)");
      }
    }
  } catch (error) {
    out(`[evol] No se pudo leer el estado: ${(error as Error).message.split("\n")[0] ?? "error"}`);
  }
  return 0;
}
