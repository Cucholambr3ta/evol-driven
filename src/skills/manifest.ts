import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { UserError } from "../core/errors.js";
import { PHASES } from "../core/phases.js";
import type { Skill } from "./skill.js";

export const MANIFEST_FILE = "manifest.json";

const AuditSchema = z.object({
  estado: z.enum(["aprobada", "con-avisos"]),
  /** The fingerprint that was audited: if the folder no longer has it, the audit no longer counts. */
  huella: z.string().regex(/^[0-9a-f]{64}$/),
  fecha: z.string().min(1),
  informe: z.string().optional(),
  /** Who approved it, at a terminal, and whether they accepted its warnings. */
  aprobadaPor: z.string().optional(),
  avisosAceptados: z.boolean().optional(),
});

const EntrySchema = z.object({
  alcance: z.enum(["paquete", "personal"]),
  /** Where in the pipeline the skill belongs. A skill linked to no phase is flagged by `check`. */
  fases: z.array(z.enum(PHASES)).default([]),
  disciplina: z.string().optional(),
  origen: z.string().optional(),
  auditoria: AuditSchema.optional(),
  /**
   * When an update replaced a skill the person had approved, so the approval went away. It stays
   * until they approve the new bytes: it is how «you had approved this» is still known afterwards.
   */
  aprobacionPerdida: z.string().optional(),
});

export const ManifestSchema = z.object({
  version: z.literal(1),
  skills: z.record(z.string(), EntrySchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestEntry = z.infer<typeof EntrySchema>;

/** What the library says about a skill's audit: only an audit of exactly these bytes counts. */
export type AuditState = "sin-auditar" | "modificada" | "aprobada" | "con-avisos";

/**
 * The entries by skill name, in an object with no prototype. In a plain object `skills["constructor"]`
 * is not «no entry» but Object's own `constructor` function, and a skill is called exactly that: the
 * list crashed on it and the release notes called it «changed» while every other skill was «new».
 */
const entriesOf = (skills: Manifest["skills"]): Manifest["skills"] =>
  Object.assign(Object.create(null) as Manifest["skills"], skills);

export function readManifest(dir: string): Manifest {
  const file = join(dir, MANIFEST_FILE);
  if (!existsSync(file)) return { version: 1, skills: entriesOf({}) };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new UserError(`${file} no es JSON válido: ${(e as Error).message}`);
  }
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new UserError(`${file} es inválido: ${detail}`);
  }
  return { ...parsed.data, skills: entriesOf(parsed.data.skills) };
}

export function auditState(skill: Skill, entry: ManifestEntry | undefined): AuditState {
  const audit = entry?.auditoria;
  if (!audit) return "sin-auditar";
  if (audit.huella !== skill.huella) return "modificada";
  return audit.estado;
}

/** Why a skill is waiting for an approval. */
export type PendingReason = "perdio-aprobacion" | "cambio" | "sin-auditar";

export interface PendingSkill {
  id: string;
  motivo: PendingReason;
  /** For «perdio-aprobacion»: when the update took the approval away. */
  desde?: string;
}

/**
 * Every skill that is not approved, and why: the ones that **had** the person's approval and lost it
 * (the ones that matter after an update), the ones changed after being audited, and the rest.
 */
export function pendingApprovals(skills: Skill[], manifest: Manifest): PendingSkill[] {
  const out: PendingSkill[] = [];
  for (const skill of skills) {
    const entry = manifest.skills[skill.id];
    const state = auditState(skill, entry);
    if (state === "aprobada" || state === "con-avisos") continue;
    if (entry?.aprobacionPerdida && !entry.auditoria)
      out.push({ id: skill.id, motivo: "perdio-aprobacion", desde: entry.aprobacionPerdida });
    else out.push({ id: skill.id, motivo: state === "modificada" ? "cambio" : "sin-auditar" });
  }
  const rank: Record<PendingReason, number> = {
    "perdio-aprobacion": 0,
    cambio: 1,
    "sin-auditar": 2,
  };
  return out.sort((a, b) => rank[a.motivo] - rank[b.motivo] || a.id.localeCompare(b.id));
}

export const AUDIT_LABEL: Record<AuditState, string> = {
  "sin-auditar": "sin auditar",
  modificada: "sin auditar (cambió después de la auditoría)",
  aprobada: "auditada",
  "con-avisos": "auditada con avisos",
};

export function writeManifest(dir: string, manifest: Manifest): void {
  const file = join(dir, MANIFEST_FILE);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(tmp, file);
}
