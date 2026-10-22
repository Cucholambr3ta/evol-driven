import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { PHASES, phaseIndex } from "./phases.js";
import type { Phase } from "./phases.js";
import { packageRoot } from "./paths.js";

const PhaseSchema = z.enum(PHASES);

export const FORMATS = [
  "md",
  "json",
  "yaml",
  "feature",
  "sql",
  "ts",
  "avsc",
  "puml",
  "tf",
  "texto",
] as const;
export type Format = (typeof FORMATS)[number];

const ArtifactSchema = z.object({
  patron: z.string().min(1),
  formato: z.enum(FORMATS),
  /** Minimum number of files. 0 means optional: validated only if present. */
  min: z.number().int().min(0).default(1),
});

const optionalPhases = { fases: z.array(PhaseSchema).min(1).optional() };

const VerificationSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("contiene"),
    archivo: z.string().min(1),
    patron: z.string().min(1),
    flags: z
      .string()
      .regex(/^[imsu]*$/)
      .optional(),
    mensaje: z.string().min(1),
    ...optionalPhases,
  }),
  z.object({ tipo: z.literal("escenarios"), ...optionalPhases }),
  z.object({ tipo: z.literal("sqlPar"), base: z.string().min(1), ...optionalPhases }),
  z.object({ tipo: z.literal("sinCriticos"), archivo: z.string().min(1), ...optionalPhases }),
  z.object({ tipo: z.literal("comando"), comando: z.string().min(1), ...optionalPhases }),
]);

export const DisciplineSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_]+$/),
  nombre: z.string().min(1),
  tipo: z.enum(["base", "extendida"]),
  fases: z.array(PhaseSchema).min(1),
  /** Transversal disciplines apply from their first phase onwards. */
  transversal: z.boolean().optional(),
  artefactos: z.array(ArtifactSchema).min(1),
  verificaciones: z.array(VerificationSchema),
});

export type Discipline = z.infer<typeof DisciplineSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type Verification = z.infer<typeof VerificationSchema>;

export class DisciplineRegistry {
  private readonly byId: Map<string, Discipline>;

  constructor(disciplines: Discipline[]) {
    this.byId = new Map(disciplines.map((d) => [d.id, d]));
  }

  get(id: string): Discipline | undefined {
    return this.byId.get(id);
  }

  ids(): ReadonlySet<string> {
    return new Set(this.byId.keys());
  }

  all(): Discipline[] {
    return [...this.byId.values()];
  }
}

export function loadDisciplines(
  dir: string = join(packageRoot(), "disciplines"),
): DisciplineRegistry {
  const found: Discipline[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    const raw: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const parsed = DisciplineSchema.safeParse(raw);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Disciplina inválida (${file}): ${detail}`);
    }
    if (parsed.data.id !== file.replace(/\.json$/, "")) {
      throw new Error(
        `Disciplina inválida (${file}): el id debe coincidir con el nombre del archivo`,
      );
    }
    found.push(parsed.data);
  }
  return new DisciplineRegistry(found);
}

export function appliesIn(discipline: Discipline, phase: Phase): boolean {
  if (discipline.transversal) {
    const first = Math.min(...discipline.fases.map(phaseIndex));
    return phaseIndex(phase) >= first;
  }
  return discipline.fases.includes(phase);
}

export function verificationAppliesIn(verification: Verification, phase: Phase): boolean {
  return verification.fases ? verification.fases.includes(phase) : true;
}
