import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryHit } from "../memory/mempalace.js";

export interface Lesson {
  titulo: string;
  texto: string;
}

export interface LessonMatch {
  leccion: Lesson;
  /** Similar lessons recorded in other wings, most similar first. */
  repetidas: { wing: string; score: number; texto: string }[];
}

/** Default similarity from which a lesson of another project counts as the same lesson. */
export const DEFAULT_THRESHOLD = 0.7;
const QUERY_LIMIT = 250;
const HITS_PER_LESSON = 10;
const EXCERPT = 240;

/** Lessons written as `### Título — fecha` sections in lecciones.md. */
export function readLessons(root: string): Lesson[] {
  const file = join(root, "lecciones.md");
  if (!existsSync(file)) return [];
  const lessons: Lesson[] = [];
  let current: { titulo: string; lines: string[] } | null = null;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const heading = /^###\s+(.+?)\s*$/.exec(line);
    if (heading?.[1]) {
      if (current) lessons.push({ titulo: current.titulo, texto: current.lines.join("\n").trim() });
      current = { titulo: heading[1].replace(/\s+—\s+\d{4}-\d{2}-\d{2}$/, ""), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) lessons.push({ titulo: current.titulo, texto: current.lines.join("\n").trim() });
  return lessons;
}

export type LessonSearch = (query: string) => Promise<MemoryHit[]>;

/**
 * Looks for each lesson among the lessons of the other wings. `search` must search every wing; the
 * project's own wing is discarded here so a lesson never matches itself.
 */
export async function checkLessons(
  lessons: Lesson[],
  search: LessonSearch,
  options: { ownWing: string; threshold?: number },
): Promise<LessonMatch[]> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const matches: LessonMatch[] = [];
  for (const leccion of lessons) {
    const query = `${leccion.titulo}. ${leccion.texto}`.replace(/\s+/g, " ").slice(0, QUERY_LIMIT);
    const seen = new Set<string>();
    const repetidas = (await search(query))
      .filter((hit) => hit.wing !== options.ownWing && (hit.score ?? 0) >= threshold)
      .filter((hit) => (hit.id === "" ? true : !seen.has(hit.id) && seen.add(hit.id)))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, HITS_PER_LESSON)
      .map((hit) => ({
        wing: hit.wing,
        score: Math.round((hit.score ?? 0) * 1000) / 1000,
        texto: hit.text.replace(/\s+/g, " ").trim().slice(0, EXCERPT),
      }));
    matches.push({ leccion, repetidas });
  }
  return matches;
}

export function renderLessonCheck(matches: LessonMatch[]): string[] {
  if (matches.length === 0) {
    return ["No hay lecciones en lecciones.md (registra una con: evol memory add --tipo leccion)."];
  }
  const lines: string[] = [];
  for (const m of matches) {
    if (m.repetidas.length === 0) {
      lines.push(`✓ ${m.leccion.titulo} — no aparece en otros proyectos`);
      continue;
    }
    lines.push(`✗ ${m.leccion.titulo} — ya registrada en ${m.repetidas.length} lugar(es):`);
    for (const r of m.repetidas) lines.push(`    [${r.wing}] (${r.score.toFixed(3)}) ${r.texto}`);
  }
  const repeated = matches.filter((m) => m.repetidas.length > 0).length;
  lines.push("");
  lines.push(
    repeated === 0
      ? "Ninguna lección se repite en otros proyectos."
      : `${repeated} de ${matches.length} lección(es) ya las aprendió otro proyecto: conviene evitar el error en lugar de volver a registrarlo.`,
  );
  return lines;
}
