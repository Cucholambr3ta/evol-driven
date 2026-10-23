export type SourceState = "capturada" | "revisada" | "retirada";

export interface KnowledgeSource {
  id: string;
  nombre: string;
  /** The version of the software the documentation describes. */
  version: string;
  origen: { tipo: "git" | "local"; url: string; commit?: string };
  capturadoEl: string;
  licencia: {
    /** An SPDX expression, or «desconocida». */
    spdx: string;
    /** Where and when it was checked at the source; absent only for an unknown license. */
    comprobada?: { url: string; el: string };
  };
  /** Hash of the captured tree: the path and content of every file, in order. */
  hash: string;
  archivos: number;
  /** An unknown license only gets in when a person accepts it in writing as «uso privado». */
  usoPrivado?: { motivo: string; responsable: string; el: string };
  /** False for «uso privado»: the text is never quoted verbatim in a report. */
  citable: boolean;
  estado: SourceState;
  revision?: { el: string; aceptados: number; rechazados: number; avisos: number };
  retirada?: { el: string; motivo: string };
}

export interface Registry {
  version: 1;
  fuentes: Record<string, KnowledgeSource>;
}
