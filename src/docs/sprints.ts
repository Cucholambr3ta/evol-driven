import { lstatSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { DocFinding } from "./hallazgo.js";
import { crearLector, nombreSeguro } from "./lectura.js";
import { lineasDeTexto } from "./markdown.js";

export const CARPETA_SPRINTS = "docs/sprints";
export const INDICE_SPRINTS = `${CARPETA_SPRINTS}/INDEX.json`;
export const MAX_SPRINTS = 200;
export const MAX_HISTORIAS = 200;

const DOCUMENTOS_HISTORIA = [
  "propuesta.md",
  "requisitos-escenarios.md",
  "escenario-tecnico.md",
  "checklist-tareas.md",
] as const;
const NOMBRES_RESERVADOS = new Set(["__proto__", "constructor", "prototype"]);

// the ids end up in paths: only a safe segment is accepted, and the names that mean something to
// an object are refused so a hostile index can never reach a prototype
const IdSprint = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,40}$/)
  .refine((id) => !NOMBRES_RESERVADOS.has(id));
const IdHistoria = z.string().regex(/^HU-[0-9]{1,6}$/);

const IndiceSchema = z
  .object({
    sprints: z
      .array(
        z
          .object({
            id: IdSprint,
            titulo: z.string().max(200),
            historias: z.array(IdHistoria).max(MAX_HISTORIAS),
          })
          .strict(),
      )
      .max(MAX_SPRINTS),
  })
  .strict();

export interface EstadoSprint {
  id: string;
  titulo: string;
  hechas: number;
  total: number;
  /** Every task of the sprint is marked, and there is at least one. */
  cerrado: boolean;
}

export interface AnalisisSprints {
  estados: EstadoSprint[];
  hallazgos: DocFinding[];
}

function existe(ruta: string): boolean {
  try {
    lstatSync(ruta);
    return true;
  } catch {
    return false;
  }
}

/** Counts the `- [ ]` and `- [x]` items outside code blocks. */
function contarTareas(texto: string): { hechas: number; total: number } {
  let hechas = 0;
  let total = 0;
  for (const { texto: linea } of lineasDeTexto(texto)) {
    const m = /^ {0,3}- \[([ xX])\]/.exec(linea);
    if (!m) continue;
    total++;
    if (m[1] !== " ") hechas++;
  }
  return { hechas, total };
}

/**
 * The sprints of `docs/sprints/INDEX.json`: each story has to exist with its four documents, the
 * checklists give the progress, and a sprint with every task marked is closed and has to leave its
 * lessons and its memory. An open sprint writes them but does not have to have them yet.
 */
export function analizarSprints(raiz: string): AnalisisSprints {
  const hallazgos: DocFinding[] = [];
  const bloqueo = (archivo: string, mensaje: string): void => {
    hallazgos.push({ archivo: nombreSeguro(archivo), mensaje, nivel: "bloqueo" });
  };
  const leer = crearLector(raiz);
  const lectura = leer(INDICE_SPRINTS);
  if (!lectura.ok) {
    if (existe(join(raiz, INDICE_SPRINTS))) bloqueo(INDICE_SPRINTS, lectura.motivo);
    else bloqueo(CARPETA_SPRINTS, "falta el índice de sprints (INDEX.json)");
    return { estados: [], hallazgos };
  }
  let datos: unknown;
  try {
    datos = JSON.parse(lectura.texto);
  } catch {
    bloqueo(INDICE_SPRINTS, "no es JSON válido");
    return { estados: [], hallazgos };
  }
  const indice = IndiceSchema.safeParse(datos);
  if (!indice.success) {
    const donde = indice.error.issues[0]?.path.join(".") ?? "";
    bloqueo(INDICE_SPRINTS, `no tiene el formato esperado${donde ? ` (en ${donde})` : ""}`);
    return { estados: [], hallazgos };
  }

  // each story is read once however many sprints (or repetitions) name it; null is a story that is not there
  const historias = new Map<string, { hechas: number; total: number } | null>();
  const leerHistoria = (historia: string): { hechas: number; total: number } | null => {
    const carpeta = `docs/historias/${historia}`;
    if (!existe(join(raiz, carpeta))) return null;
    let tareas = { hechas: 0, total: 0 };
    for (const nombre of DOCUMENTOS_HISTORIA) {
      const doc = leer(`${carpeta}/${nombre}`);
      if (!doc.ok) {
        bloqueo(`${carpeta}/${nombre}`, doc.motivo);
        continue;
      }
      if (nombre === "checklist-tareas.md") tareas = contarTareas(doc.texto);
    }
    return tareas;
  };
  const estados: EstadoSprint[] = [];
  const vistos = new Map<string, true>();
  for (const sprint of indice.data.sprints) {
    const clave = sprint.id.toLowerCase();
    if (vistos.has(clave)) {
      bloqueo(INDICE_SPRINTS, `sprint ${sprint.id}: identificador repetido`);
      continue;
    }
    vistos.set(clave, true);
    let hechas = 0;
    let total = 0;
    for (const historia of new Set(sprint.historias)) {
      let t = historias.get(historia);
      if (t === undefined) {
        t = leerHistoria(historia);
        historias.set(historia, t);
      }
      if (t === null) {
        bloqueo(INDICE_SPRINTS, `sprint ${sprint.id}: la historia ${historia} no existe`);
        continue;
      }
      hechas += t.hechas;
      total += t.total;
    }
    const cerrado = total > 0 && hechas === total;
    estados.push({ id: sprint.id, titulo: nombreSeguro(sprint.titulo), hechas, total, cerrado });
    if (!cerrado) continue;
    const faltan = ["lecciones.md", "memoria.md"].filter(
      (n) => !leer(`${CARPETA_SPRINTS}/${sprint.id}/${n}`).ok,
    );
    if (faltan.length > 0)
      bloqueo(
        `${CARPETA_SPRINTS}/${sprint.id}`,
        `sprint ${sprint.id} incompleto: falta ${faltan.join(" y ")}`,
      );
  }
  return { estados, hallazgos };
}

export function comprobarSprints(raiz: string): DocFinding[] {
  return analizarSprints(raiz).hallazgos;
}
