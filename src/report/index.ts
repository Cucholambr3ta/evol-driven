import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PipelineContext } from "../core/pipeline.js";
import { collectInput } from "../diagrams/data.js";
import { diagramFileName, generateFromInput } from "../diagrams/index.js";
import type { DiagramOptions } from "../diagrams/index.js";
import { ToolUnavailableError, graphvizVersion } from "../diagrams/layout.js";
import { rasterize } from "../diagrams/raster.js";
import { buildReport } from "./build.js";
import { compileDocx, runWordcraft, wordcraftAvailable } from "./docx.js";
import { renderMarkdown } from "./markdown.js";
import { NEUTRAL_COLOR } from "./model.js";
import type { Brand, DiagramFigure } from "./model.js";

export type ReportFormat = "docx" | "pdf" | "ambos" | "md";
export const REPORT_FORMATS: ReportFormat[] = ["docx", "pdf", "ambos", "md"];

export interface ReportOptions extends DiagramOptions {
  formato: ReportFormat;
  /** Absolute folder where the report and its diagrams go. */
  salida: string;
  /** YYYY-MM-DD; defaults to today. */
  fecha?: string;
}

export interface ReportResult {
  archivos: string[];
  diagramas: { generados: number; noAplican: number };
  paginas: number | null;
}

export function brandOf(ctx: PipelineContext): Brand {
  const brand = ctx.config.report?.brand;
  return {
    name: brand?.name ?? null,
    color: (brand?.color ?? NEUTRAL_COLOR).replace(/^#/, "").toUpperCase(),
  };
}

/** Width and height in pixels, read from the PNG header. */
function pngSize(path: string): { wPx: number; hPx: number } {
  const head = readFileSync(path).subarray(0, 24);
  return { wPx: head.readUInt32BE(16), hPx: head.readUInt32BE(20) };
}

/**
 * Writes the project report. DOCX and PDF need WordCraft and VectorCraft (ArtCraft); Markdown needs
 * neither. Every format needs Graphviz for the diagrams. It never switches format on its own.
 */
export function generateReport(ctx: PipelineContext, options: ReportOptions): ReportResult {
  const word = options.formato !== "md";
  if (word && !wordcraftAvailable()) {
    throw new ToolUnavailableError(
      "WordCraft (wordcraft-cli, de ArtCraft)",
      "no se encontró el comando; con --formato md el informe no lo necesita",
    );
  }
  if (graphvizVersion() === null) {
    throw new ToolUnavailableError(
      "Graphviz (dot)",
      "instálalo con tu gestor de paquetes, p. ej. `pacman -S graphviz`",
    );
  }

  const input = collectInput(ctx, {
    ...(options.entrada ? { entrada: options.entrada } : {}),
    ...(options.componente ? { componente: options.componente } : {}),
  });
  const diagrams = generateFromInput(input);

  const diagramDir = join(options.salida, "diagramas");
  mkdirSync(diagramDir, { recursive: true });
  const figures = new Map<number, DiagramFigure>();
  for (const d of diagrams) {
    if (!d.svg) continue;
    const name = diagramFileName(d);
    const svgPath = join(diagramDir, name);
    writeFileSync(svgPath, d.svg);
    let png: DiagramFigure["png"] = null;
    if (word) {
      const pngPath = svgPath.replace(/\.svg$/, ".png");
      rasterize(svgPath, pngPath, 2);
      png = { path: pngPath, ...pngSize(pngPath) };
    }
    figures.set(d.numero, {
      numero: d.numero,
      titulo: d.titulo,
      fuente: d.fuente,
      nota: d.nota,
      caption: d.titulo,
      file: `diagramas/${name}`,
      png,
      svg: d.svg,
    });
  }

  const doc = buildReport({
    input,
    diagrams,
    figures,
    date: options.fecha ?? new Date().toISOString().slice(0, 10),
    brand: brandOf(ctx),
  });

  const archivos: string[] = [];
  let paginas: number | null = null;
  if (options.formato === "md") {
    const file = join(options.salida, "informe.md");
    writeFileSync(file, renderMarkdown(doc));
    archivos.push(file);
  } else {
    const outputs = [
      ...(options.formato !== "pdf" ? [join(options.salida, "informe.docx")] : []),
      ...(options.formato !== "docx" ? [join(options.salida, "informe.pdf")] : []),
    ];
    // WordCraft renders the PDF from the same document; the PNGs are only inputs of the build.
    const run = runWordcraft(compileDocx(doc), outputs, options.salida);
    paginas = run.pages;
    archivos.push(...outputs);
    for (const f of figures.values()) if (f.png) rmSync(f.png.path, { force: true });
  }
  return {
    archivos,
    diagramas: {
      generados: diagrams.filter((d) => d.estado === "ok").length,
      noAplican: diagrams.filter((d) => d.estado === "no-aplica").length,
    },
    paginas,
  };
}
