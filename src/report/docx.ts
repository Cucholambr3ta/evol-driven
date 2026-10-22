import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserError } from "../core/errors.js";
import { ToolUnavailableError } from "../diagrams/layout.js";
import type { Block, DiagramFigure, ReportDoc } from "./model.js";

export interface WordCommand {
  command: string;
  params?: Record<string, unknown>;
}

type Orientation = "portrait" | "landscape";

const A4 = { w: 595.28, h: 841.89 };
const MARGINS = { top: 72, bottom: 72, left: 64, right: 64 };
/** A diagram page also holds a heading, the source line, the caption and a note. */
const PAGE_RESERVE = 125;
/** Diagram PNGs are rendered at 2 pixels per SVG unit, and one SVG unit is 0.75 pt. */
const PT_PER_PIXEL = 0.375;
const MAX_UPSCALE = 1.25;
export const TOC_MARKER = "@@TOC@@";

function usable(o: Orientation): { w: number; h: number } {
  const [w, h] = o === "portrait" ? [A4.w, A4.h] : [A4.h, A4.w];
  return { w: w - MARGINS.left - MARGINS.right, h: h - MARGINS.top - MARGINS.bottom };
}

/** The page orientation that shows a diagram the largest, and the width to give it in points. */
export function fitFigure(wPx: number, hPx: number): { orientation: Orientation; widthPt: number } {
  const [natW, natH] = [wPx * PT_PER_PIXEL, hPx * PT_PER_PIXEL];
  const scaleIn = (o: Orientation): number => {
    const u = usable(o);
    return Math.min(u.w / natW, (u.h - PAGE_RESERVE) / natH, MAX_UPSCALE);
  };
  const [portrait, landscape] = [scaleIn("portrait"), scaleIn("landscape")];
  const orientation: Orientation = landscape > portrait ? "landscape" : "portrait";
  return { orientation, widthPt: Math.floor(natW * Math.max(portrait, landscape)) };
}

class Compiler {
  readonly commands: WordCommand[] = [];
  private orientation: Orientation = "portrait";

  constructor(private readonly doc: ReportDoc) {}

  private add(command: string, params?: Record<string, unknown>): void {
    this.commands.push(params ? { command, params } : { command });
  }

  /** Every block starts at the end of the document: the caret never has to be tracked. */
  private end(): void {
    this.add("caret.docEnd");
  }

  private style(name: string): void {
    this.add("para.style", { style: name });
    this.add("para.reset");
    // A new paragraph keeps the character formatting of the one before (italic notes, white text).
    this.add("format.resetChar");
  }

  /** Colour, weight or size of what was just typed in the current paragraph. */
  private paint(
    options: { color?: string; bold?: boolean; italic?: boolean; size?: number },
    inBody = true,
  ): void {
    this.add("select.paragraph");
    if (options.color) this.add("format.color", { color: options.color });
    if (options.bold) this.add("format.bold", { value: true });
    if (options.italic) this.add("format.italic", { value: true });
    if (options.size) this.add("format.size", { size: options.size });
    // Collapsing keeps the caret at the start of the text, and a new paragraph would land before it.
    this.add("select.collapse");
    if (inBody) this.end();
  }

  private line(style: string, text: string, paint?: Parameters<Compiler["paint"]>[0]): void {
    this.style(style);
    this.add("text.insert", { text });
    if (paint) this.paint(paint);
    this.add("text.newParagraph");
  }

  private portrait(): void {
    if (this.orientation === "portrait") return;
    this.end();
    this.add("layout.break", { kind: "nextPage" });
    this.add("layout.orientation", { value: "portrait" });
    this.orientation = "portrait";
  }

  preamble(): void {
    const { brand, project, title } = this.doc;
    this.add("file.properties", {
      title,
      subject: project,
      author: brand.name ?? "evol-driven",
    });
    this.add("layout.size", { name: "A4" });
    this.add("layout.margins", MARGINS);
    this.add("insert.createFooter");
    this.add("para.align", { value: "center" });
    this.add("text.insert", { text: "Página " });
    this.add("insert.field", { instr: "PAGE", result: "1" });
    this.add("text.insert", { text: " de " });
    this.add("insert.field", { instr: "NUMPAGES", result: "1" });
    this.add("insert.closeHeader");
    this.add("insert.createHeader");
    this.add("para.align", { value: "right" });
    this.add("text.insert", { text: brand.name ? `${brand.name} · ${project}` : project });
    this.paint({ color: brand.color, size: 9 }, false);
    this.add("insert.closeHeader");
    this.add("layout.differentFirstPage");
  }

  block(block: Block): void {
    this.end();
    switch (block.t) {
      case "cover": {
        if (block.brand)
          this.line("Normal", block.brand, { color: this.doc.brand.color, bold: true, size: 14 });
        this.style("Title");
        this.add("para.spacing", { before: block.brand ? 90 : 130, after: 10 });
        this.add("text.insert", { text: block.title });
        this.paint({ color: this.doc.brand.color });
        this.add("text.newParagraph");
        // The Subtitle style capitalizes the first letter, and a project name is not a sentence.
        this.line("Normal", block.subtitle, { bold: true, size: 16, color: "5B6675" });
        for (const text of block.lines) this.line("Normal", text);
        break;
      }
      case "pagebreak":
        // A section break (back to portrait) is already a page break.
        if (this.orientation === "portrait") this.add("text.pageBreak");
        break;
      case "toc":
        this.line("Normal", TOC_MARKER);
        break;
      case "h1":
        this.portrait();
        this.line("Heading 1", block.text);
        break;
      case "h2":
        this.portrait();
        this.line("Heading 2", block.text);
        break;
      case "p":
        this.portrait();
        this.line(
          "Normal",
          block.text,
          block.muted ? { color: "5B6675", italic: true } : undefined,
        );
        break;
      case "bullets":
        this.portrait();
        this.style("Normal");
        this.add("para.bullets");
        for (const item of block.items) {
          this.add("text.insert", { text: item });
          this.add("text.newParagraph");
        }
        this.add("para.bullets", { off: true });
        this.style("Normal");
        break;
      case "table":
        this.portrait();
        this.table(block.columns, block.rows);
        break;
      case "diagram":
        this.diagram(block.figure);
        break;
    }
  }

  private table(columns: string[], rows: string[][]): void {
    const clean = (s: string): string => s.replace(/[\t\r\n]+/g, " ");
    this.style("Normal");
    this.add("insert.table", { rows: rows.length + 1, cols: columns.length });
    this.add("table.style", { style: "Table Grid" });
    columns.forEach((title, i) => {
      this.add("text.insert", { text: clean(title) });
      this.paint({ color: "FFFFFF", bold: true }, false);
      this.add("table.shading", { color: this.doc.brand.color });
      if (i === columns.length - 1) this.add("table.repeatHeader");
      this.add("text.tab");
    });
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell !== "") this.add("text.insert", { text: clean(cell) });
        if (!(r === rows.length - 1 && c === row.length - 1)) this.add("text.tab");
      });
    });
    this.add("table.selectTable");
    this.add("format.size", { size: 9 });
    this.add("table.borders", { kind: "all", width: 0.5, color: "BFC5CD" });
    this.add("table.autofit", { mode: "window" });
    this.end();
    this.add("text.newParagraph");
  }

  private diagram(figure: DiagramFigure): void {
    if (!figure.png) return;
    const { orientation, widthPt } = fitFigure(figure.png.wPx, figure.png.hPx);
    this.end();
    if (orientation !== this.orientation) {
      this.add("layout.break", { kind: "nextPage" });
      this.add("layout.orientation", { value: orientation });
      this.orientation = orientation;
      this.line("Heading 2", `${figure.numero}. ${figure.titulo}`);
    } else {
      this.style("Heading 2");
      this.add("para.pageBreakBefore", { value: true });
      this.add("text.insert", { text: `${figure.numero}. ${figure.titulo}` });
      this.add("text.newParagraph");
    }
    this.line("Normal", `Fuente de datos: ${figure.fuente}`, { color: "5B6675", italic: true });
    if (figure.nota) this.line("Normal", `Nota: ${figure.nota}`, { color: "5B6675", italic: true });
    this.style("Normal");
    this.add("para.align", { value: "center" });
    this.add("insert.picture", {
      path: figure.png.path,
      width: widthPt,
      alt: `${figure.titulo}. Fuente de datos: ${figure.fuente}`,
    });
    // insert.picture clamps to the width of the first section; this sets the real size.
    this.add("picture.size", { width: widthPt, lockAspect: true });
    this.add("text.newParagraph");
    this.add("references.caption", { label: "Figura", text: figure.caption, position: "below" });
    this.end();
    this.add("text.newParagraph");
  }

  finish(): void {
    this.add("caret.docStart");
    this.add("select.text", { text: TOC_MARKER });
    this.add("text.delete");
    this.add("references.toc", { levels: 1, title: "Contenido" });
    this.add("references.updateFields");
  }
}

export function compileDocx(doc: ReportDoc): WordCommand[] {
  const compiler = new Compiler(doc);
  compiler.preamble();
  for (const block of doc.blocks) compiler.block(block);
  compiler.finish();
  return compiler.commands;
}

export function wordcraftAvailable(): boolean {
  return spawnSync("wordcraft-cli", ["--version"], { encoding: "utf8" }).error === undefined;
}

export interface WordRun {
  pages: number | null;
}

/** Builds the document with `wordcraft-cli run` and saves each of `outputs` (.docx or .pdf). */
export function runWordcraft(commands: WordCommand[], outputs: string[], cwd: string): WordRun {
  if (!wordcraftAvailable()) {
    throw new ToolUnavailableError(
      "WordCraft (wordcraft-cli, de ArtCraft)",
      "no se encontró el comando; con --formato md el informe no lo necesita",
    );
  }
  const dir = mkdtempSync(join(tmpdir(), "evol-report-"));
  try {
    const script = join(dir, "informe.json");
    writeFileSync(script, JSON.stringify({ commands, save: outputs }));
    const run = spawnSync("wordcraft-cli", ["run", "--script", script], {
      cwd,
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, WORDCRAFT_REGION: "es-ES" },
    });
    if (run.error || run.status !== 0) {
      const detail = (run.stderr || run.stdout || run.error?.message || "sin detalle").trim();
      throw new UserError(
        `WordCraft no pudo generar el informe:\n${detail.split("\n").slice(-6).join("\n")}`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const docx = outputs.find((o) => o.endsWith(".docx"));
  const info = spawnSync("wordcraft-cli", ["info", docx ?? outputs[0] ?? ""], { encoding: "utf8" });
  try {
    return { pages: (JSON.parse(info.stdout) as { pages?: number }).pages ?? null };
  } catch {
    return { pages: null };
  }
}
