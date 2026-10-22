/** The report as a list of blocks: both the Word/PDF and the Markdown writers read the same list. */

export interface Brand {
  /** Shown on the cover and the header. null = neutral report. */
  name: string | null;
  /** RRGGBB, no leading #. */
  color: string;
}

export const NEUTRAL_COLOR = "44546A";

export interface DiagramFigure {
  numero: number;
  titulo: string;
  fuente: string;
  nota: string | null;
  caption: string;
  /** Path of the SVG relative to the report folder, for Markdown. */
  file: string;
  /** Rasterized image and its size in pixels (null in Markdown reports, which embed the SVG). */
  png: { path: string; wPx: number; hPx: number } | null;
  svg: string;
}

export type Block =
  | { t: "cover"; brand: string | null; title: string; subtitle: string; lines: string[] }
  | { t: "toc" }
  | { t: "h1"; text: string }
  | { t: "h2"; text: string }
  | { t: "p"; text: string; muted?: boolean }
  | { t: "bullets"; items: string[] }
  | { t: "table"; columns: string[]; rows: string[][] }
  | { t: "diagram"; figure: DiagramFigure }
  | { t: "pagebreak" };

export interface ReportDoc {
  title: string;
  project: string;
  brand: Brand;
  date: string;
  blocks: Block[];
}

/** Single-line text for a table cell or a list item. */
export function oneLine(text: string, max = 0): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return max > 0 && flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
