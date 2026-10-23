import type { DisciplineRegistry } from "./disciplines.js";

/**
 * The six roles. A role is a skill (`skills/<id>/SKILL.md`): what it knows and how it works, written
 * once for every IDE. They are split by competence, not by phase, because a phase needs several
 * competences and a competence serves several phases. A role runs `en-linea` (the orchestrator loads
 * its skill and works in its own session) or as a `subagente` of read-only access and clean context,
 * which is where independence matters: reviewing without the bias of how the work was built.
 */
export const ROLES = [
  { id: "analista", ejecucion: "en-linea" },
  { id: "arquitecto", ejecucion: "en-linea" },
  { id: "constructor", ejecucion: "en-linea" },
  { id: "verificador", ejecucion: "subagente" },
  { id: "seguridad", ejecucion: "subagente" },
  { id: "operaciones", ejecucion: "en-linea" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];
export const ROLE_IDS = ROLES.map((r) => r.id) as [RoleId, ...RoleId[]];

export const executionOf = (role: RoleId): "en-linea" | "subagente" =>
  ROLES.find((r) => r.id === role)?.ejecucion ?? "en-linea";

/** The roles that run as read-only subagents where the IDE has them. */
export const SUBAGENT_ROLES: RoleId[] = ROLES.filter((r) => r.ejecucion === "subagente").map(
  (r) => r.id,
);

/** The disciplines a role applies, from the discipline definitions: the single place the split lives. */
export function disciplinesOfRole(registry: DisciplineRegistry, role: RoleId): string[] {
  return registry
    .all()
    .filter((d) => d.rol === role)
    .map((d) => d.id)
    .sort();
}
