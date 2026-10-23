import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readLessons } from "./lessons.js";
import { activeDisciplines, describePhase } from "./pipeline.js";
import type { PipelineContext } from "./pipeline.js";
import { PHASES } from "./phases.js";
import type { Phase } from "./phases.js";
import { executionOf } from "./roles.js";
import type { RoleId } from "./roles.js";

/**
 * Everything the orchestrator reads before it proposes anything. All of it is read-only: nothing here
 * runs a command, writes a file or moves the pipeline.
 */

export interface MissingArtifact {
  fase: Phase;
  modulo: string;
  disciplina: string;
  artefacto: string;
  problema: "falta" | "sin-completar";
  detalle: string;
}

export interface PrerequisiteReport {
  /** The phase asked about (the current one by default). */
  fase: Phase | "done";
  /** The phase whose artifacts have to exist first; null for the first phase. */
  anterior: Phase | null;
  /** True when nothing of the previous phase is missing. */
  listo: boolean;
  anteriorAprobada: boolean;
  faltan: MissingArtifact[];
}

/**
 * What the previous phase should have left and has not: an artifact that does not exist, or that still
 * carries a `[[COMPLETAR]]` marker. The orchestrator stops at the first thing missing and names it.
 */
export function prerequisites(
  ctx: PipelineContext,
  phase: Phase | "done" = ctx.state.currentPhase,
): PrerequisiteReport {
  if (phase === "done")
    return { fase: phase, anterior: null, listo: true, anteriorAprobada: true, faltan: [] };
  const index = PHASES.indexOf(phase);
  const anterior = index > 0 ? (PHASES[index - 1] ?? null) : null;
  if (anterior === null)
    return { fase: phase, anterior, listo: true, anteriorAprobada: true, faltan: [] };

  const faltan: MissingArtifact[] = [];
  for (const d of describePhase(ctx, anterior)) {
    for (const a of d.artefactos) {
      if (a.encontrados < a.min)
        faltan.push({
          fase: anterior,
          modulo: d.module,
          disciplina: d.id,
          artefacto: a.patron,
          problema: "falta",
          detalle: `se esperaban al menos ${a.min} y hay ${a.encontrados}`,
        });
      else if (a.pendientes > 0)
        faltan.push({
          fase: anterior,
          modulo: d.module,
          disciplina: d.id,
          artefacto: a.patron,
          problema: "sin-completar",
          detalle: `${a.pendientes} archivo(s) conservan el marcador [[COMPLETAR]]`,
        });
    }
  }
  return {
    fase: phase,
    anterior,
    listo: faltan.length === 0,
    anteriorAprobada: ctx.state.completed.some((c) => c.phase === anterior),
    faltan,
  };
}

export interface PhaseDiscipline {
  modulo: string;
  id: string;
  nombre: string;
  /** The skill that applies the discipline, if the discipline names one. */
  skill: string | null;
  /** The role that applies it, and how that role runs (in the session or as a read-only subagent). */
  rol: RoleId;
  ejecucion: "en-linea" | "subagente";
  artefactos: { patron: string; formato: string; min: number }[];
  verificaciones: string[];
}

/** The disciplines active in a phase, with what each one expects and how it is checked. */
export function phaseDisciplines(
  ctx: PipelineContext,
  phase: Phase | "done" = ctx.state.currentPhase,
): { fase: Phase | "done"; disciplinas: PhaseDiscipline[] } {
  if (phase === "done") return { fase: phase, disciplinas: [] };
  return {
    fase: phase,
    disciplinas: activeDisciplines(ctx, phase).map(({ module, discipline }) => ({
      modulo: module.name,
      id: discipline.id,
      nombre: discipline.nombre,
      skill: discipline.skill ?? null,
      rol: discipline.rol,
      ejecucion: executionOf(discipline.rol),
      artefactos: discipline.artefactos.map((a) => ({
        patron: a.patron,
        formato: a.formato,
        min: a.min,
      })),
      verificaciones: discipline.verificaciones.map((v) => {
        switch (v.tipo) {
          case "contiene":
            return v.mensaje;
          case "comando":
            return `comando: ${v.comando}`;
          case "sinCriticos":
            return `sin hallazgos críticos abiertos en ${v.archivo}`;
          case "sqlPar":
            return `cada migración de ${v.base} lleva up.sql y down.sql`;
          case "escenarios":
            return "cada feature tiene al menos un escenario";
          case "escaneoSeguridad":
            return "escaneo de seguridad sin hallazgos CRITICAL ni HIGH abiertos";
        }
      }),
    })),
  };
}

export interface LessonEntry {
  titulo: string;
  fecha: string | null;
  texto: string;
}

/** The lessons the project has written down in `lecciones.md`, optionally only those that mention every word of `query`. */
export function lessonsOf(
  root: string,
  query?: string,
): { total: number; lecciones: LessonEntry[] } {
  const words = (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  // the date is in the heading («### Título — 2026-01-01»), which readLessons strips off the title
  const file = join(root, "lecciones.md");
  const dates = new Map<string, string>();
  if (existsSync(file))
    for (const m of readFileSync(file, "utf8").matchAll(
      /^###\s+(.+?)\s+—\s+(\d{4}-\d{2}-\d{2})\s*$/gm,
    ))
      if (m[1] && m[2]) dates.set(m[1], m[2]);
  const all = readLessons(root).map<LessonEntry>((l) => ({
    titulo: l.titulo,
    fecha: dates.get(l.titulo) ?? null,
    texto: l.texto,
  }));
  const lecciones =
    words.length === 0
      ? all
      : all.filter((l) => words.every((w) => `${l.titulo} ${l.texto}`.toLowerCase().includes(w)));
  return { total: all.length, lecciones };
}
