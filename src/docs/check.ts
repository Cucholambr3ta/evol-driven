import { lstatSync } from "node:fs";
import { join } from "node:path";
import { comprobarEvidencia, CARPETA_EVIDENCIA } from "./evidencia.js";
import { comprobarGranular, CARPETA_GRANULAR } from "./granular.js";
import type { DocFinding } from "./hallazgo.js";
import { comprobarRequisitos, CARPETA_REQUISITOS } from "./requisitos.js";
import { comprobarSprints, CARPETA_SPRINTS } from "./sprints.js";

export type { DocFinding } from "./hallazgo.js";

/** The parts of the documentation a check can look at, each in a folder of its own. */
export const PARTES = ["granular", "requisitos", "evidencia", "sprints"] as const;
export type Parte = (typeof PARTES)[number];

const PARTE: Record<Parte, { carpeta: string; comprobar: (raiz: string) => DocFinding[] }> = {
  granular: { carpeta: CARPETA_GRANULAR, comprobar: comprobarGranular },
  requisitos: { carpeta: CARPETA_REQUISITOS, comprobar: comprobarRequisitos },
  evidencia: { carpeta: CARPETA_EVIDENCIA, comprobar: (raiz) => comprobarEvidencia(raiz) },
  sprints: { carpeta: CARPETA_SPRINTS, comprobar: comprobarSprints },
};

function existe(ruta: string): boolean {
  try {
    lstatSync(ruta);
    return true;
  } catch {
    return false;
  }
}

/** Checks one part of the documentation of a module; a part whose folder is not there has nothing to check. */
export function comprobarParte(parte: Parte, raiz: string): DocFinding[] {
  const { carpeta, comprobar } = PARTE[parte];
  return existe(join(raiz, carpeta)) ? acotar(comprobar(raiz)) : [];
}

export interface ResultadoDocs {
  /** The parts that had a folder to check. */
  partes: Parte[];
  hallazgos: DocFinding[];
}

/** The most findings a part reports: a hostile document could otherwise make thousands. */
export const MAX_HALLAZGOS = 200;

function acotar(hallazgos: DocFinding[]): DocFinding[] {
  if (hallazgos.length <= MAX_HALLAZGOS) return hallazgos;
  return [
    ...hallazgos.slice(0, MAX_HALLAZGOS),
    {
      archivo: "-",
      mensaje: `y ${hallazgos.length - MAX_HALLAZGOS} hallazgos más (se muestran los primeros ${MAX_HALLAZGOS})`,
      nivel: "bloqueo",
    },
  ];
}

export function comprobarDocs(raiz: string, elegidas: readonly Parte[] = PARTES): ResultadoDocs {
  const partes = elegidas.filter((p) => existe(join(raiz, PARTE[p].carpeta)));
  return {
    partes: [...partes],
    hallazgos: partes.flatMap((p) => acotar(PARTE[p].comprobar(raiz))),
  };
}
