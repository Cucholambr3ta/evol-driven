import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildExport } from "../src/core/export.js";
import { appendApproval, ensureKey, keyPath } from "../src/core/gate.js";
import { journalAppend } from "../src/core/journal.js";
import { loadContext } from "../src/core/pipeline.js";
import { parseConfig } from "../src/core/config.js";
import { compileDocx, fitFigure, TOC_MARKER } from "../src/report/docx.js";
import { renderMarkdown } from "../src/report/markdown.js";
import type { ReportDoc } from "../src/report/model.js";
import { graphvizVersion } from "../src/diagrams/layout.js";
import { baseConfig, cli, makeProject, tempDir, write } from "./helpers.js";

// tests/setup-env.ts points EVOL_CONFIG_DIR at a temp folder before this file is collected.
const env = (): Record<string, string> => ({
  EVOL_CONFIG_DIR: process.env["EVOL_CONFIG_DIR"] ?? "",
});

const has = (command: string): boolean =>
  spawnSync(command, ["--version"], { encoding: "utf8" }).error === undefined &&
  spawnSync(command, ["--help"], { encoding: "utf8" }).error === undefined;
const hasDot = graphvizVersion() !== null;
const hasWord = has("wordcraft-cli");
const hasPdf = has("pdfcraft-cli");
const hasVector = has("vectorcraft-cli");
const hasUnzip = spawnSync("unzip", ["-v"], { encoding: "utf8" }).error === undefined;
const fullToolchain = hasDot && hasWord && hasPdf && hasVector;

const SPEC =
  "# Spec\n\n## Criterios de aceptación\n\n- CA-1: el usuario inicia sesión\n- CA-2: el usuario cierra sesión\n- CA-3: se registra el acceso\n";
const FEATURE =
  "@CA-1\nFeature: Sesión\n  Como lectora, quiero ver el estado\n\n  @CA-2\n  Scenario: ver el estado\n    Given un proyecto\n";

/** A project with code, criteria, a feature with an actor, two approvals, a lesson and a brand. */
function reportProject(brand?: { name?: string; color?: string }): string {
  const root = makeProject(["SDD", "BDD", "TDD"], {
    ...(brand ? { report: { brand } } : {}),
  });
  write(root, "docs/specs/SPEC.md", SPEC);
  write(root, "tests/features/sesion.feature", FEATURE);
  write(root, "tests/unit/sesion.test.ts", 'it("CA-2: cierra la sesión", () => {});\n');
  write(root, "src/core/util.ts", "export function util(): number {\n  return 1;\n}\n");
  write(
    root,
    "src/core/helper.ts",
    'import { util } from "./util.js";\nexport function help(): number {\n  return util();\n}\n',
  );
  write(
    root,
    "src/app/main.ts",
    'import { help } from "../core/helper.js";\nexport function main(): number {\n  return help() + help();\n}\n',
  );
  write(
    root,
    "lecciones.md",
    "# Lecciones\n\n### Probar migraciones — 2026-10-01\n\ncon datos reales\n",
  );
  write(root, "docs/adr/001-base.md", "# Usar SQLite para el índice\n\nTexto.\n");
  const key = ensureKey(loadContext(root).state.projectId);
  for (const phase of ["briefing", "spec"] as const) {
    appendApproval(root, key, {
      phase,
      approver: "tester",
      artifacts: { "evol.config.json": "00" },
    });
  }
  journalAppend(root, "memory-add", { tipo: "decision", drawer: "x" });
  return root;
}

function pdfText(file: string): string {
  return spawnSync("pdfcraft-cli", ["text", file], { encoding: "utf8" }).stdout.replace(
    /\s+/g,
    " ",
  );
}

describe("ajuste de los diagramas a la página", () => {
  it("un diagrama ancho va en una página horizontal y llena su ancho", () => {
    const fit = fitFigure(4000, 1000);
    expect(fit.orientation).toBe("landscape");
    expect(fit.widthPt).toBeLessThanOrEqual(714);
    expect(fit.widthPt).toBeGreaterThan(600);
  });

  it("un diagrama alto va en vertical y no se amplía por encima de lo razonable", () => {
    expect(fitFigure(800, 2400).orientation).toBe("portrait");
    expect(fitFigure(200, 100).widthPt).toBeLessThanOrEqual(Math.ceil(200 * 0.375 * 1.25));
  });

  it("deja sitio para el título, la fuente y la leyenda", () => {
    const { widthPt } = fitFigure(1200, 1700);
    expect(widthPt * (1700 / 1200)).toBeLessThanOrEqual(698 - 100);
  });
});

describe("compilación del documento", () => {
  const doc: ReportDoc = {
    title: "Informe de proyecto — demo",
    project: "demo",
    brand: { name: "Acme", color: "1F6F5B" },
    date: "2026-10-22",
    blocks: [
      { t: "cover", brand: "Acme", title: "Informe", subtitle: "demo", lines: ["Fase: build"] },
      { t: "pagebreak" },
      { t: "toc" },
      { t: "pagebreak" },
      { t: "h1", text: "1. Uno" },
      { t: "table", columns: ["A", "B"], rows: [["1", "2"]] },
    ],
  };
  const commands = compileDocx(doc);
  const names = commands.map((c) => c.command);

  it("fija A4, los márgenes, el pie «Página X de Y» y el encabezado con la marca", () => {
    expect(commands[0]).toMatchObject({ command: "file.properties", params: { author: "Acme" } });
    expect(commands).toContainEqual({ command: "layout.size", params: { name: "A4" } });
    expect(commands).toContainEqual({
      command: "insert.field",
      params: { instr: "NUMPAGES", result: "1" },
    });
    expect(commands).toContainEqual({ command: "text.insert", params: { text: "Acme · demo" } });
    expect(names).toContain("layout.differentFirstPage");
  });

  it("la portada lleva el color de la marca y la tabla su cabecera sombreada", () => {
    expect(commands).toContainEqual({ command: "format.color", params: { color: "1F6F5B" } });
    expect(commands).toContainEqual({ command: "table.shading", params: { color: "1F6F5B" } });
    expect(names).toContain("table.repeatHeader");
  });

  it("el índice se coloca al final, sustituyendo el marcador", () => {
    const tail = names.slice(-5);
    expect(tail).toEqual([
      "caret.docStart",
      "select.text",
      "text.delete",
      "references.toc",
      "references.updateFields",
    ]);
    const typed = commands.filter(
      (c) => c.command === "text.insert" && c.params?.["text"] === TOC_MARKER,
    );
    expect(typed).toHaveLength(1);
  });

  it("tras dar formato vuelve al final del documento para que el párrafo nuevo no se cuele antes", () => {
    // The header paints inside its own story and must not leave it; every body paint returns.
    const afterPaint = commands
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.command === "select.collapse")
      .map(({ i }) => names[i + 1]);
    expect(afterPaint).toContain("caret.docEnd");
  });
});

describe("informe en Markdown", () => {
  it("convierte los bloques y enlaza los diagramas como SVG", () => {
    const md = renderMarkdown({
      title: "t",
      project: "demo",
      brand: { name: null, color: "44546A" },
      date: "2026-10-22",
      blocks: [
        { t: "cover", brand: null, title: "Informe", subtitle: "demo", lines: ["Fase: build"] },
        { t: "toc" },
        { t: "h1", text: "1. Uno" },
        { t: "table", columns: ["A", "B"], rows: [["x|y", "2"]] },
        {
          t: "diagram",
          figure: {
            numero: 1,
            titulo: "Diagrama de clases",
            fuente: "Índice",
            nota: "una nota",
            caption: "Diagrama de clases",
            file: "diagramas/01-clases.svg",
            png: null,
            svg: "<svg/>",
          },
        },
      ],
    });
    expect(md).toContain("# Informe");
    expect(md).toContain("- 1. Uno");
    expect(md).toContain("| x\\|y | 2 |");
    expect(md).toContain("![Diagrama de clases](diagramas/01-clases.svg)");
    expect(md).toContain("_Nota: una nota_");
  });
});

describe.skipIf(!hasDot)("evol report --formato md (criterios 29 y 30)", () => {
  const root = reportProject({ name: "Acme Labs", color: "#1F6F5B" });
  const run = cli(["report", "--formato", "md", "--salida", "out"], { cwd: root, env: env() });
  const md = existsSync(join(root, "out/informe.md"))
    ? readFileSync(join(root, "out/informe.md"), "utf8")
    : "";

  it("produce Markdown con los 14 diagramas enlazados como SVG, solo con Graphviz", () => {
    expect(run.status, run.stderr).toBe(0);
    expect(md).toContain("# Informe de proyecto");
    expect(
      readdirSync(join(root, "out/diagramas")).filter((f) => f.endsWith(".svg")).length,
    ).toBeGreaterThanOrEqual(10);
    expect(md).toContain("![Diagrama de objetos](diagramas/02-objetos.svg)");
    for (const title of [
      "1. Resumen ejecutivo",
      "2. Pipeline y aprobaciones",
      "3. Disciplinas por módulo y fase",
      "4. Trazabilidad",
      "5. Modelo UML",
      "6. Arquitectura",
      "7. Decisiones y lecciones",
      "8. Anexos",
    ]) {
      expect(md, title).toContain(title);
    }
  });

  it("no contiene la clave del gate, firmas ni el contenido de la memoria (criterio 30)", () => {
    const key = readFileSync(keyPath(loadContext(root).state.projectId), "utf8").trim();
    expect(key.length).toBeGreaterThan(30);
    expect(md).not.toContain(key);
    expect(md).not.toMatch(/signature|nonce|previous_hash/);
    expect(md).toContain("1 de tipo decision");
    expect(md).toContain("no se incluye en este informe");
  });

  it("las cifras coinciden con evol export", () => {
    const data = buildExport(loadContext(root));
    expect(md).toContain(`Aprobaciones registradas: ${data.aprobaciones.entradas.length}`);
    expect(md).toContain(
      `Criterios de aceptación CA-n: ${data.cobertura.criterios.length}; sin escenario: ${data.cobertura.sinEscenario.length}; sin prueba: ${data.cobertura.sinPrueba.length}`,
    );
    for (const a of data.aprobaciones.entradas) expect(md).toContain(`${a.huella.slice(0, 16)}…`);
  });

  it("incluye la lección, el ADR y los criterios", () => {
    expect(md).toContain("Probar migraciones");
    expect(md).toContain("Usar SQLite para el índice");
    expect(md).toContain("CA-3");
  });

  it("la marca configurada aparece en la portada", () => {
    expect(md.split("\n").slice(0, 3).join("\n")).toContain("Acme Labs");
  });
});

describe("evol report sin las herramientas (criterio 29)", () => {
  /** A PATH that holds only the listed commands, so everything else is missing. */
  function pathWith(...commands: string[]): string {
    const dir = tempDir("evol-path-");
    for (const c of commands) {
      const found = spawnSync("which", [c], { encoding: "utf8" }).stdout.trim();
      if (found) symlinkSync(found, join(dir, c));
    }
    return dir;
  }

  it("sin WordCraft falla y ofrece --formato md; el Markdown sí sale", () => {
    const root = makeProject(["SDD"]);
    const r = cli(["report"], { cwd: root, env: { ...env(), PATH: pathWith("dot") } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("WordCraft");
    expect(r.stderr).toContain("--formato md");
    expect(existsSync(join(root, "informe"))).toBe(false);
    if (hasDot) {
      const md = cli(["report", "--formato", "md"], {
        cwd: root,
        env: { ...env(), PATH: pathWith("dot") },
      });
      expect(md.status, md.stderr).toBe(0);
      expect(existsSync(join(root, "informe/informe.md"))).toBe(true);
    }
  });

  it("sin Graphviz falla con un mensaje claro, también en Markdown, y no escribe nada", () => {
    const root = makeProject(["SDD"]);
    // stand-ins for the two tools, so the test does not depend on them being installed (a bare container has neither)
    const only = tempDir("evol-path-");
    for (const c of ["wordcraft-cli", "vectorcraft-cli"]) {
      writeFileSync(join(only, c), "#!/bin/sh\nexit 0\n");
      chmodSync(join(only, c), 0o755);
    }
    for (const args of [["report"], ["report", "--formato", "md"]]) {
      const r = cli(args, { cwd: root, env: { ...env(), PATH: only } });
      expect(r.status, args.join(" ")).toBe(1);
      expect(r.stderr).toContain("Graphviz (dot) no está disponible");
    }
    expect(existsSync(join(root, "informe"))).toBe(false);
  });

  it("rechaza un formato desconocido", () => {
    const r = cli(["report", "--formato", "odt"], { cwd: makeProject(["SDD"]), env: env() });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--formato debe ser uno de");
  });
});

describe.skipIf(!fullToolchain)("evol report en DOCX y PDF (criterios 25, 26, 28 y 31)", () => {
  const root = reportProject({ name: "Acme Labs", color: "#1F6F5B" });
  const run = cli(["report", "--salida", "out"], { cwd: root, env: env() });
  const docx = join(root, "out/informe.docx");
  const pdf = join(root, "out/informe.pdf");

  it("genera ambos archivos y WordCraft y PdfCraft los validan (criterio 25)", () => {
    expect(run.status, run.stderr).toBe(0);
    const w = JSON.parse(spawnSync("wordcraft-cli", ["info", docx], { encoding: "utf8" }).stdout);
    expect(w.pages).toBeGreaterThan(8);
    const p = JSON.parse(spawnSync("pdfcraft-cli", ["info", pdf], { encoding: "utf8" }).stdout);
    expect(p.pages).toBe(w.pages);
    expect(p.title).toBe(
      "Informe de proyecto — demo".replace("demo", loadContext(root).config.name),
    );
    const check = spawnSync("pdfcraft-cli", ["check", pdf], { encoding: "utf8" });
    expect(check.status, check.stdout).toBe(0);
    expect(`${check.stdout}${check.stderr}`).toContain('"ok": 1');
  });

  it("tiene las 8 secciones y los 14 tipos de diagrama, cada uno generado o «no aplica» (criterio 26)", () => {
    const text = pdfText(pdf);
    for (const title of [
      "Contenido",
      "1. Resumen ejecutivo",
      "2. Pipeline y aprobaciones",
      "3. Disciplinas por módulo y fase",
      "4. Trazabilidad de criterios de aceptación",
      "5. Modelo UML",
      "6. Arquitectura del código y mapa de riesgo",
      "7. Decisiones y lecciones",
      "8. Anexos",
    ]) {
      expect(text, title).toContain(title);
    }
    for (const tipo of [
      "Clases",
      "Objetos",
      "Componentes",
      "Estructura compuesta",
      "Paquetes",
      "Despliegue",
      "Perfiles",
      "Casos de uso",
      "Actividad",
      "Máquina de estados",
      "Secuencia",
      "Comunicación",
      "Tiempos",
      "Visión de interacción",
    ]) {
      expect(text, tipo).toContain(tipo);
    }
    expect(text).toMatch(/Figura 1/);
  });

  it("las cifras del PDF coinciden con evol export (criterio 28)", () => {
    const text = pdfText(pdf);
    const data = buildExport(loadContext(root));
    expect(text).toContain(`Aprobaciones registradas: ${data.aprobaciones.entradas.length}`);
    expect(text).toContain(
      `Criterios de aceptación CA-n: ${data.cobertura.criterios.length}; sin escenario: ${data.cobertura.sinEscenario.length}; sin prueba: ${data.cobertura.sinPrueba.length}`,
    );
    expect(text).toContain(`Fase: ${data.pipeline.fase}`);
    expect(text).toContain(data.proyecto.nombre);
    for (const a of data.aprobaciones.entradas) expect(text).toContain(a.huella.slice(0, 16));
  });

  it("la marca aparece en la portada y en el encabezado, y la portada no lleva encabezado (criterio 31)", () => {
    const first = spawnSync("pdfcraft-cli", ["text", pdf, "--page", "1"], {
      encoding: "utf8",
    }).stdout;
    const second = spawnSync("pdfcraft-cli", ["text", pdf, "--page", "2"], {
      encoding: "utf8",
    }).stdout;
    expect(first).toContain("Acme Labs");
    expect(first).not.toContain("Acme Labs ·");
    expect(second).toContain("Acme Labs ·");
    expect(second).toContain("Página 2 de");
  });

  it.skipIf(!hasUnzip)("el color de la marca está en la cabecera de las tablas", () => {
    const xml = spawnSync("unzip", ["-p", docx, "word/document.xml"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).stdout;
    expect(xml.toUpperCase()).toContain("1F6F5B");
  });

  it("sin marca el informe es neutro: ni nombre de marca ni color propio", () => {
    const neutral = reportProject();
    const r = cli(["report", "--salida", "out"], { cwd: neutral, env: env() });
    expect(r.status, r.stderr).toBe(0);
    const text = pdfText(join(neutral, "out/informe.pdf"));
    expect(text).not.toContain("Acme");
    const xml = spawnSync("unzip", ["-p", join(neutral, "out/informe.docx"), "word/document.xml"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).stdout;
    if (hasUnzip) {
      expect(xml.toUpperCase()).toContain("44546A");
      expect(xml.toUpperCase()).not.toContain("1F6F5B");
    }
  });

  it("--formato pdf deja solo el PDF y --formato docx solo el DOCX", () => {
    const only = reportProject();
    expect(
      cli(["report", "--formato", "pdf", "--salida", "p"], { cwd: only, env: env() }).status,
    ).toBe(0);
    expect(existsSync(join(only, "p/informe.pdf"))).toBe(true);
    expect(existsSync(join(only, "p/informe.docx"))).toBe(false);
    expect(
      cli(["report", "--formato", "docx", "--salida", "d"], { cwd: only, env: env() }).status,
    ).toBe(0);
    expect(existsSync(join(only, "d/informe.docx"))).toBe(true);
    expect(existsSync(join(only, "d/informe.pdf"))).toBe(false);
  });
});

describe("configuración de la marca", () => {
  it("acepta #RRGGBB y rechaza un color mal escrito", () => {
    const base = baseConfig(["SDD"]);
    expect(
      parseConfig({ ...base, report: { brand: { name: "X", color: "#1F6F5B" } } }).report?.brand
        ?.color,
    ).toBe("#1F6F5B");
    expect(() => parseConfig({ ...base, report: { brand: { color: "verde" } } })).toThrow(/color/);
    expect(parseConfig(base).report).toBeUndefined();
  });
});
