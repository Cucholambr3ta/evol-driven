import type { Block, ReportDoc } from "./model.js";

const cell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\s+/g, " ");

function table(columns: string[], rows: string[][]): string[] {
  return [
    `| ${columns.map(cell).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
    "",
  ];
}

function render(block: Block, doc: ReportDoc): string[] {
  switch (block.t) {
    case "cover":
      return [
        ...(block.brand ? [`**${block.brand}**`, ""] : []),
        `# ${block.title}`,
        "",
        `## ${block.subtitle}`,
        "",
        ...block.lines.map((l) => `- ${l}`),
        "",
      ];
    case "toc": {
      const titles = doc.blocks.flatMap((b) => (b.t === "h1" ? [b.text] : []));
      return ["## Contenido", "", ...titles.map((t) => `- ${t}`), ""];
    }
    case "pagebreak":
      return [];
    case "h1":
      return [`## ${block.text}`, ""];
    case "h2":
      return [`### ${block.text}`, ""];
    case "p":
      return [block.muted ? `_${block.text}_` : block.text, ""];
    case "bullets":
      return [...block.items.map((i) => `- ${i}`), ""];
    case "table":
      return table(block.columns, block.rows);
    case "diagram": {
      const f = block.figure;
      return [
        `### ${f.numero}. ${f.titulo}`,
        "",
        `_Fuente de datos: ${f.fuente}_`,
        "",
        `![${f.titulo}](${f.file})`,
        "",
        `Figura: ${f.caption}`,
        "",
        ...(f.nota ? [`_Nota: ${f.nota}_`, ""] : []),
      ];
    }
  }
}

/** The same report as Markdown. Diagrams are linked as SVG files next to it. */
export function renderMarkdown(doc: ReportDoc): string {
  return `${doc.blocks
    .flatMap((b) => render(b, doc))
    .join("\n")
    .trimEnd()}\n`;
}
