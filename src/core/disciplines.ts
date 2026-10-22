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
  /** The skill that applies this discipline: its id (folder name) in the skills library. */
  skill: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional(),
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

interface ModuleOverrides {
  rutas?: Record<string, string> | undefined;
  comandos?: Record<string, string> | undefined;
  disciplinas: string[];
}

function insideModule(path: string): boolean {
  return !path.startsWith("/") && !/^[A-Za-z]:/.test(path) && !path.split(/[\\/]/).includes("..");
}

/** Every default artifact path/pattern the given disciplines refer to. */
export function artifactPaths(registry: DisciplineRegistry, ids: string[]): Set<string> {
  const paths = new Set<string>();
  for (const d of ids.flatMap((id) => registry.get(id) ?? [])) {
    for (const a of d.artefactos) paths.add(a.patron);
    for (const v of d.verificaciones) {
      if (v.tipo === "contiene" || v.tipo === "sinCriticos") paths.add(v.archivo);
      if (v.tipo === "sqlPar") paths.add(v.base);
    }
  }
  return paths;
}

/** Everything in a module's `rutas`/`comandos` that does not match its disciplines. */
export function validateModuleOverrides(
  registry: DisciplineRegistry,
  mod: ModuleOverrides,
): string[] {
  const paths = artifactPaths(registry, mod.disciplinas);
  const problems: string[] = [];
  for (const [from, to] of Object.entries(mod.rutas ?? {})) {
    if (!paths.has(from)) {
      problems.push(`rutas: «${from}» no es un artefacto de las disciplinas de este módulo`);
    }
    if (!insideModule(to))
      problems.push(`rutas: «${to}» debe ser una ruta relativa dentro del módulo`);
  }
  for (const id of Object.keys(mod.comandos ?? {})) {
    const d = registry.get(id);
    if (!d || !mod.disciplinas.includes(id)) {
      problems.push(`comandos: «${id}» no es una disciplina de este módulo`);
    } else if (!d.verificaciones.some((v) => v.tipo === "comando")) {
      problems.push(`comandos: «${id}» no ejecuta ningún comando`);
    }
  }
  return problems;
}

/** The discipline as this module sees it: artifacts moved and commands replaced as configured. */
export function resolveDiscipline(d: Discipline, mod: ModuleOverrides): Discipline {
  const move = (path: string): string => mod.rutas?.[path] ?? path;
  const command = mod.comandos?.[d.id];
  return {
    ...d,
    artefactos: d.artefactos.map((a) => ({ ...a, patron: move(a.patron) })),
    verificaciones: d.verificaciones.map((v) => {
      switch (v.tipo) {
        case "contiene":
        case "sinCriticos":
          return { ...v, archivo: move(v.archivo) };
        case "sqlPar":
          return { ...v, base: move(v.base) };
        case "comando":
          return command ? { ...v, comando: command } : v;
        default:
          return v;
      }
    }),
  };
}
