export const PHASES = ["briefing", "spec", "plan", "build", "qa", "retro"] as const;
export type Phase = (typeof PHASES)[number];

export function isPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value);
}

export function phaseIndex(phase: Phase): number {
  return PHASES.indexOf(phase);
}

export function nextPhase(phase: Phase): Phase | null {
  return PHASES[phaseIndex(phase) + 1] ?? null;
}
