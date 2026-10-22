import { createInterface } from "node:readline/promises";
import { userInfo } from "node:os";
import { NotInteractiveError, UserError } from "../core/errors.js";
import { approvePhase, loadContext } from "../core/pipeline.js";
import type { Confirm } from "../core/pipeline.js";
import { isPhase } from "../core/phases.js";
import { makeRecorder } from "../memory/events.js";
import { out, requireProject, warn } from "./shared.js";

/** Asks the person at the terminal to type the phase name. There is no way to skip it. */
export const ttyConfirm: Confirm = async (phase) => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new NotInteractiveError();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`Para aprobar la fase «${phase}» escribe su nombre: `);
    if (answer.trim() !== phase)
      throw new UserError("Aprobación cancelada: el nombre no coincide.");
  } finally {
    rl.close();
  }
  return { approver: userInfo().username };
};

export default async function run(argv: string[]): Promise<number> {
  // Fail before touching anything when nobody is there to approve.
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new NotInteractiveError();
  const phase = argv[0];
  if (!phase || !isPhase(phase)) {
    throw new UserError("Uso: evol approve <fase>   (briefing, spec, plan, build, qa, retro)");
  }
  const root = requireProject();
  const ctx = loadContext(root);
  ctx.record = makeRecorder(root, ctx.config, warn);
  const result = await approvePhase(ctx, phase, ttyConfirm);
  out(
    `Fase «${phase}» aprobada (entrada ${result.seq}, ${result.artifacts} artefacto(s) firmados).`,
  );
  out("Ahora puedes ejecutar: evol next");
  return 0;
}
