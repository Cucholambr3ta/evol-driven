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
});

export const ManifestSchema = z.object({
  version: z.literal(1),
  skills: z.record(z.string(), EntrySchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestEntry = z.infer<typeof EntrySchema>;

/** What the library says about a skill's audit: only an audit of exactly these bytes counts. */
export type AuditState = "sin-auditar" | "modificada" | "aprobada" | "con-avisos";

export function readManifest(dir: string): Manifest {
  const file = join(dir, MANIFEST_FILE);
  if (!existsSync(file)) return { version: 1, skills: {} };
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
  return parsed.data;
}

export function auditState(skill: Skill, entry: ManifestEntry | undefined): AuditState {
  const audit = entry?.auditoria;
  if (!audit) return "sin-auditar";
  if (audit.huella !== skill.huella) return "modificada";
  return audit.estado;
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
