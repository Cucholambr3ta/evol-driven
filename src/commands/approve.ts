import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { NotInteractiveError, UserError } from "../core/errors.js";
import { approvePhase, loadContext } from "../core/pipeline.js";
import type { Confirm } from "../core/pipeline.js";
import { isPhase } from "../core/phases.js";
import { makeRecorder } from "../memory/events.js";
import { out, requireProject, warn } from "./shared.js";
import { confirmByTyping, hasTerminal } from "./tty.js";

/** Asks the person at the terminal to type the phase name. There is no way to skip it. */
export const ttyConfirm: Confirm = async (phase) => {
  await confirmByTyping(
    `Para aprobar la fase «${phase}» escribe su nombre: `,
    phase,
    "Aprobación cancelada: el nombre no coincide.",
  );
  return { approver: userInfo().username };
};

export default async function run(argv: string[]): Promise<number> {
  // Fail before touching anything when nobody is there to approve.
  if (!hasTerminal()) throw new NotInteractiveError();
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { "sin-interrogar": { type: "string" } },
  });
  const phase = positionals[0];
  if (!phase || !isPhase(phase)) {
    throw new UserError(
      "Uso: evol approve <fase> [--sin-interrogar <motivo>]   (briefing, spec, plan, build, qa, retro)",
    );
  }
  const root = requireProject();
  const ctx = loadContext(root);
  ctx.record = makeRecorder(root, ctx.config, warn);
  const sinInterrogar = values["sin-interrogar"];
  if (sinInterrogar !== undefined && phase !== "plan")
    throw new UserError("--sin-interrogar solo vale para aprobar el plan.");
  const result = await approvePhase(ctx, phase, ttyConfirm, {
    ...(sinInterrogar !== undefined ? { sinInterrogar } : {}),
  });
  out(
    `Fase «${phase}» aprobada (entrada ${result.seq}, ${result.artifacts} artefacto(s) firmados).`,
  );
  if (result.anulacion) out(`Queda registrado en la firma: ${result.anulacion}`);
  out("Ahora puedes ejecutar: evol next");
  return 0;
}
