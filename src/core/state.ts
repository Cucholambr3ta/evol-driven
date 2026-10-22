import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { PHASES } from "./phases.js";
import type { Phase } from "./phases.js";
import { evolPath } from "./paths.js";
import { UserError } from "./errors.js";

const StateSchema = z.object({
  version: z.literal(1),
  projectId: z.string().min(1),
  currentPhase: z.union([z.enum(PHASES), z.literal("done")]),
  completed: z.array(
    z.object({ phase: z.enum(PHASES), at: z.string(), adopted: z.boolean().optional() }),
  ),
});

export type PipelineState = z.infer<typeof StateSchema>;

export function statePath(root: string): string {
  return evolPath(root, "state.json");
}

/**
 * New pipeline state. `phase` lets an existing project join midway: the earlier phases are marked
 * as adopted (done before evol), not approved.
 */
export function initState(root: string, phase: Phase = PHASES[0]): PipelineState {
  const at = new Date().toISOString();
  const state: PipelineState = {
    version: 1,
    projectId: randomUUID(),
    currentPhase: phase,
    completed: PHASES.slice(0, PHASES.indexOf(phase)).map((p) => ({ phase: p, at, adopted: true })),
  };
  saveState(root, state);
  return state;
}

export function loadState(root: string): PipelineState {
  const file = statePath(root);
  if (!existsSync(file)) {
    throw new UserError(`No hay estado del pipeline en ${file}. ¿Es un proyecto creado con evol?`);
  }
  const parsed = StateSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) throw new UserError(`El estado del pipeline (${file}) no es válido.`);
  return parsed.data;
}

export function saveState(root: string, state: PipelineState): void {
  const file = statePath(root);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

export function markCompleted(
  state: PipelineState,
  phase: Phase,
  next: Phase | null,
): PipelineState {
  return {
    ...state,
    currentPhase: next ?? "done",
    completed: [...state.completed, { phase, at: new Date().toISOString() }],
  };
}
