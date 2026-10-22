import type { EdgeRow, NodeRow } from "../codeintel/native/store.js";
import type { ExportData } from "../core/export.js";
import type { JournalEvent } from "../core/journal.js";
import type { PipelineContext } from "../core/pipeline.js";

export type DiagramKey =
  | "clases"
  | "objetos"
  | "componentes"
  | "estructura-compuesta"
  | "paquetes"
  | "despliegue"
  | "perfiles"
  | "casos-de-uso"
  | "actividad"
  | "maquina-de-estados"
  | "secuencia"
  | "comunicacion"
  | "tiempos"
  | "vision-de-interaccion";

export interface Diagram {
  /** 1-14, the order of the UML specification's diagram list. */
  numero: number;
  clave: DiagramKey;
  tipo: string;
  titulo: string;
  /** Where the data comes from. Always filled, even when the diagram does not apply. */
  fuente: string;
  estado: "ok" | "no-aplica";
  /** Why a diagram does not apply. */
  motivo: string | null;
  /** Something the reader should know, e.g. that only part of the code is shown. */
  nota: string | null;
  svg: string | null;
}

export interface CodeGraph {
  nodes: NodeRow[];
  edges: EdgeRow[];
  byId: Map<string, NodeRow>;
}

export interface DiagramOptions {
  /** Symbol whose calls the sequence and communication diagrams follow. */
  entrada?: string;
  /** Component the composite structure diagram opens. */
  componente?: string;
}

export interface DiagramInput {
  ctx: PipelineContext;
  data: ExportData;
  /** null when the configured provider does not expose a graph (gitnexus). */
  graph: CodeGraph | null;
  journal: JournalEvent[];
  options: DiagramOptions;
}

export const DIAGRAM_ORDER: { clave: DiagramKey; tipo: string }[] = [
  { clave: "clases", tipo: "Clases" },
  { clave: "objetos", tipo: "Objetos" },
  { clave: "componentes", tipo: "Componentes" },
  { clave: "estructura-compuesta", tipo: "Estructura compuesta" },
  { clave: "paquetes", tipo: "Paquetes" },
  { clave: "despliegue", tipo: "Despliegue" },
  { clave: "perfiles", tipo: "Perfiles" },
  { clave: "casos-de-uso", tipo: "Casos de uso" },
  { clave: "actividad", tipo: "Actividad" },
  { clave: "maquina-de-estados", tipo: "Máquina de estados" },
  { clave: "secuencia", tipo: "Secuencia" },
  { clave: "comunicacion", tipo: "Comunicación" },
  { clave: "tiempos", tipo: "Tiempos" },
  { clave: "vision-de-interaccion", tipo: "Visión de interacción" },
];

export function meta(numero: number): { clave: DiagramKey; tipo: string } {
  const entry = DIAGRAM_ORDER[numero - 1];
  if (!entry) throw new Error(`No existe el diagrama ${numero}`);
  return entry;
}

export function ok(
  numero: number,
  titulo: string,
  fuente: string,
  svg: string,
  nota: string | null = null,
): Diagram {
  return { numero, ...meta(numero), titulo, fuente, estado: "ok", motivo: null, nota, svg };
}

/** A diagram without data is reported as such, with the reason: never invented. */
export function notApplicable(
  numero: number,
  titulo: string,
  fuente: string,
  motivo: string,
): Diagram {
  return {
    numero,
    ...meta(numero),
    titulo,
    fuente,
    estado: "no-aplica",
    motivo,
    nota: null,
    svg: null,
  };
}
