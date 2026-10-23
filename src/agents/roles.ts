import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packageRoot } from "../core/paths.js";
import { SUBAGENT_ROLES } from "../core/roles.js";
import type { RoleId } from "../core/roles.js";

/** The `description` of a role's skill: the wrapper reuses it, so what a role is has one author. */
export function roleDescription(role: RoleId): string {
  const text = readFileSync(join(packageRoot(), "skills", role, "SKILL.md"), "utf8");
  const raw = /description:\s*>-\n((?: {2}.*\n)+)/.exec(text)?.[1] ?? "";
  return raw
    .split("\n")
    .map((l) => l.trim())
    .join(" ")
    .trim();
}

/**
 * A subagent for Claude Code that does nothing but load the role's skill. It has no instructions of
 * its own, and it can read but not change or run anything: only the tools that read files, and the
 * mode in which nothing is edited. Where independence matters (reviewing without the bias of how the
 * work was built) the orchestrator delegates to it with the task as its only input.
 */
export function claudeSubagent(role: RoleId, marker: string): string {
  return `---
name: ${role}
description: ${JSON.stringify(roleDescription(role))}
tools: Read, Grep, Glob
permissionMode: plan
---

${marker}

Carga la skill \`${role}\` y haz la tarea que te pasen.
`;
}

export const SUBAGENT_FILES: Record<string, RoleId> = Object.fromEntries(
  SUBAGENT_ROLES.map((r) => [`${r}.md`, r]),
);
