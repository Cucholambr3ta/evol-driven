import { userInfo } from "node:os";
import { NotInteractiveError, UserError } from "../core/errors.js";
import { appendCycleOpen, ensureKey, readLog, verifyChain } from "../core/gate.js";
import { PHASES } from "../core/phases.js";
import { loadState, saveState } from "../core/state.js";
import { out, requireProject } from "./shared.js";
import { hasTerminal, typingSession } from "./tty.js";

export const USAGE = "Uso: evol ciclo nuevo";

/**
 * Opens a second (or later) pass through the pipeline once the first one finished (criterio 146):
 * resets the phase to «briefing» without touching the signed log of what already happened, and
 * marks the boundary in that same log so a later approval from the closed cycle never counts as
 * valid in the new one. Like `evol approve`, only a person at a real terminal can do this
 * (criterio 147): it fails before touching anything when there is nobody to ask.
 */
export default async function run(argv: string[]): Promise<number> {
  if (argv[0] !== "nuevo") throw new UserError(USAGE);
  if (!hasTerminal()) throw new NotInteractiveError();

  const root = requireProject();
  const state = loadState(root);
  if (state.currentPhase !== "done")
    throw new UserError(
      `El pipeline no ha terminado (fase actual: «${state.currentPhase}»); un ciclo nuevo solo se abre desde «done».`,
    );
  const key = ensureKey(state.projectId);
  const chain = verifyChain(readLog(root), key);
  if (!chain.ok)
    throw new UserError(
      `El registro de aprobaciones no es íntegro (entrada ${chain.seq}): ${chain.reason}.`,
    );

  const nextCiclo = state.ciclo + 1;
  const session = typingSession();
  let approver: string;
  try {
    const answer = (await session.ask(`¿Abrir el ciclo ${nextCiclo}? [s/N] `))
      ?.trim()
      .toLowerCase();
    if (answer !== "s" && answer !== "si" && answer !== "sí")
      throw new UserError("Cancelado: no se abrió un ciclo nuevo.");
    approver = userInfo().username;
  } finally {
    session.close();
  }

  const firstPhase = PHASES[0];
  appendCycleOpen(root, key, { approver, ciclo: nextCiclo, phase: firstPhase });
  saveState(root, {
    ...state,
    currentPhase: firstPhase,
    completed: [],
    ciclo: nextCiclo,
    ciclos: [...state.ciclos, { ciclo: state.ciclo, cerradoEl: new Date().toISOString() }],
  });
  out(`Ciclo ${nextCiclo} abierto. Fase actual: «${firstPhase}».`);
  out(
    "Las aprobaciones del ciclo anterior quedan en el registro firmado, pero ya no cuentan como vigentes.",
  );
  return 0;
}
