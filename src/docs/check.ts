import { lstatSync } from "node:fs";
import { join } from "node:path";
import { comprobarEvidencia, CARPETA_EVIDENCIA } from "./evidencia.js";
import { comprobarGranular, CARPETA_GRANULAR } from "./granular.js";
import type { DocFinding } from "./hallazgo.js";
import { comprobarRequisitos, CARPETA_REQUISITOS } from "./requisitos.js";

export type { DocFinding } from "./hallazgo.js";

/** The parts of the documentation a check can look at, each in a folder of its own. */
export const PARTES = ["granular", "requisitos", "evidencia"] as const;
export type Parte = (typeof PARTES)[number];

const PARTE: Record<Parte, { carpeta: string; comprobar: (raiz: string) => DocFinding[] }> = {
  granular: { carpeta: CARPETA_GRANULAR, comprobar: comprobarGranular },
  requisitos: { carpeta: CARPETA_REQUISITOS, comprobar: comprobarRequisitos },
  evidencia: { carpeta: CARPETA_EVIDENCIA, comprobar: (raiz) => comprobarEvidencia(raiz) },
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
  return existe(join(raiz, carpeta)) ? comprobar(raiz) : [];
}

export interface ResultadoDocs {
  /** The parts that had a folder to check. */
  partes: Parte[];
  hallazgos: DocFinding[];
}

export function comprobarDocs(raiz: string, elegidas: readonly Parte[] = PARTES): ResultadoDocs {
  const partes = elegidas.filter((p) => existe(join(raiz, PARTE[p].carpeta)));
  return { partes: [...partes], hallazgos: partes.flatMap((p) => PARTE[p].comprobar(raiz)) };
}
