import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packageRoot } from "../core/paths.js";

/**
 * The orchestrator is written once, as the skill `evol` (skills/evol/SKILL.md). Every IDE's entry point
 * (the Claude Code command today, the others as their adapters arrive) is generated from it, so the
 * seven steps and the rules never drift apart between IDEs.
 */
export const ORCHESTRATOR_SKILL = "evol";

function skillText(): string {
  return readFileSync(join(packageRoot(), "skills", ORCHESTRATOR_SKILL, "SKILL.md"), "utf8");
}

/** The orchestrator's instructions, without the skill's frontmatter. */
export function orchestratorBody(): string {
  return skillText()
    .replace(/^---\n[\s\S]*?\n---\n+/, "")
    .trim();
}

/** The orchestrator's `description`, for the IDEs whose entry point has one. */
export function orchestratorDescription(): string {
  const raw = /description:\s*>-\n((?: {2}.*\n)+)/.exec(skillText())?.[1] ?? "";
  return raw
    .split("\n")
    .map((l) => l.trim())
    .join(" ")
    .trim();
}
