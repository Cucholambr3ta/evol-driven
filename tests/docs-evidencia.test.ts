import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { comprobarEvidencia } from "../src/docs/evidencia.js";
import type { Hoy } from "../src/docs/evidencia.js";
import { tempDir, write } from "./helpers.js";

const HOY: Hoy = { local: "2026-10-25", utc: "2026-10-26" };
const CABECERA =
  "| ID | Fuente | Consultada | Clasificación | Afirma |\n| --- | --- | --- | --- | --- |";
const fila = (
  id: string,
  fecha = "2026-10-20",
  clase = "hecho",
  fuente = "https://example.org",
): string => `| ${id} | ${fuente} | ${fecha} | ${clase} | algo concreto |`;
const indice = (...filas: string[]): string => `# Índice\n\n${[CABECERA, ...filas].join("\n")}\n`;
const auditoria = (...citas: string[]): string =>
  `# Auditoría\n\nCon evidencia ${citas.map((c) => `[${c}]`).join(" ")}.\n`;

function con(archivos: Record<string, string>): string {
  const root = tempDir();
  for (const [ruta, contenido] of Object.entries(archivos)) write(root, ruta, contenido);
  return root;
}
const textos = (root: string, hoy = HOY): string[] =>
  comprobarEvidencia(root, hoy).map((f) => `${f.nivel}|${f.archivo}|${f.mensaje}`);

const BASE = {
  "investigacion/hermes/hermes-evidence-index.md": indice(
    fila("E-1"),
    fila("E-2", "2026-10-20", "supuesto"),
  ),
  "investigacion/hermes/hermes-audit.md": auditoria("E-1", "E-2"),
};

describe("un dossier consistente", () => {
  it("no da ningún hallazgo", () => {
    expect(comprobarEvidencia(con(BASE), HOY)).toEqual([]);
  });

  it("la clasificación y la fecha se aceptan con cualquier mayúscula, tilde o fecha de hoy", () => {
    const root = con({
      ...BASE,
      "investigacion/hermes/hermes-evidence-index.md": indice(
        fila("E-1", "2026-10-26", "HECHO"),
        fila("E-2", "2026-10-25", "Contradicción"),
        fila("e-3", "2026-10-25", " contradiccion "),
      ),
      "investigacion/hermes/hermes-audit.md": auditoria("E-1", "E-2", "E-3"),
    });

    expect(comprobarEvidencia(root, HOY)).toEqual([]);
  });

  it("ignora los archivos sueltos de investigacion/, las carpetas vacías y lo que no es Markdown", () => {
    const root = con({
      ...BASE,
      "investigacion/suelto.md": "[E-99] sin índice",
      "investigacion/hermes/informe.pdf": "[E-98]",
    });
    mkdirSync(join(root, "investigacion/vacio"));

    expect(comprobarEvidencia(root, HOY)).toEqual([]);
  });

  it("varios temas se comprueban cada uno con su índice", () => {
    const root = con({
      ...BASE,
      "investigacion/omarchy/omarchy-evidence-index.md": indice(fila("E-1")),
      "investigacion/omarchy/audit.md": auditoria("E-1", "E-2"),
    });

    const t = textos(root);

    expect(t).toHaveLength(1);
    expect(t[0]).toMatch(/investigacion\/omarchy\/audit\.md.*E-2/);
  });
});

describe("el índice de evidencia", () => {
  it("un tema con documentos pero sin índice se rechaza, nombrando el tema", () => {
    const root = con({ "investigacion/hermes/hermes-audit.md": auditoria("E-1") });

    expect(textos(root)).toEqual([
      expect.stringMatching(
        /^bloqueo\|investigacion\/hermes\|.*(índice de evidencia|evidence-index)/,
      ),
    ]);
  });

  it("un índice con otro nombre no vale: se pide el del tema y se nombra el que hay", () => {
    const root = con({
      "investigacion/hermes/otro-evidence-index.md": indice(fila("E-1")),
      "investigacion/hermes/hermes-audit.md": auditoria("E-1"),
    });

    const t = textos(root);

    expect(t).toHaveLength(1);
    expect(t[0]).toMatch(/hermes-evidence-index\.md/);
    expect(t[0]).toMatch(/otro-evidence-index\.md/);
  });

  it("dos índices en el mismo tema se rechazan", () => {
    const root = con({
      ...BASE,
      "investigacion/hermes/otro-evidence-index.md": indice(fila("E-1")),
    });

    expect(textos(root).join("\n")).toMatch(/más de un índice/);
  });

  it("nombra cada fuente por lo que le falta y no nombra las válidas", () => {
    const root = con({
      "investigacion/hermes/hermes-evidence-index.md": indice(
        fila("E-1"),
        fila("E-2", ""),
        fila("E-3", "2026-10-20", "quizás"),
        fila("E-4", "2026-10-20", ""),
        fila("E-5", "2026-10-20", "hecho", ""),
        fila("E-6", "26-10-20"),
        fila("E-7", "2026-02-30"),
        fila("E-8", "2099-01-01"),
      ),
      "investigacion/hermes/audit.md": auditoria(
        "E-1",
        "E-2",
        "E-3",
        "E-4",
        "E-5",
        "E-6",
        "E-7",
        "E-8",
      ),
    });

    const t = textos(root);

    expect(t).toHaveLength(7);
    expect(t.find((x) => x.includes("E-2"))).toMatch(/falta la fecha/);
    expect(t.find((x) => x.includes("E-3"))).toMatch(/clasificación no válida/);
    expect(t.find((x) => x.includes("E-4"))).toMatch(/falta la clasificación/);
    expect(t.find((x) => x.includes("E-5"))).toMatch(/falta la fuente/);
    expect(t.find((x) => x.includes("E-6"))).toMatch(/fecha.*no válida/);
    expect(t.find((x) => x.includes("E-7"))).toMatch(/fecha.*no válida/);
    expect(t.find((x) => x.includes("E-8"))).toMatch(/futura/);
    expect(t.join("\n")).not.toContain("E-1");
    expect(t.join("\n")).not.toMatch(/E-1[^0-9]/);
  });

  it("una fecha es futura solo si supera a la vez la fecha local y la UTC", () => {
    const fechas = ["2026-10-25", "2026-10-26", "2026-10-27"];
    const root = con({
      "investigacion/t/t-evidence-index.md": indice(...fechas.map((f, i) => fila(`E-${i + 1}`, f))),
      "investigacion/t/a.md": auditoria("E-1", "E-2", "E-3"),
    });

    const t = textos(root);

    expect(t).toHaveLength(1);
    expect(t[0]).toMatch(/E-3.*futura/);
  });

  it("un identificador repetido o con mal formato se rechaza sin citarlo", () => {
    const root = con({
      "investigacion/hermes/hermes-evidence-index.md": indice(
        fila("E-1"),
        fila("E-1"),
        fila("\u001b[31mX9"),
        fila("E-1234567"),
      ),
      "investigacion/hermes/audit.md": auditoria("E-1"),
    });

    const t = textos(root).join("\n");

    expect(t).toMatch(/E-1: repetida/);
    expect(t.match(/identificador no válido en la línea \d+/g)).toHaveLength(2);
    expect(t).not.toContain("\u001b");
  });

  it("falta la tabla o le faltan columnas: se dice", () => {
    const sinTabla = con({ "investigacion/t/t-evidence-index.md": "# I\n\nSolo prosa.\n" });
    const sinColumnas = con({
      "investigacion/t/t-evidence-index.md": "# I\n\n| ID | Fuente |\n| - | - |\n| E-1 | x |\n",
    });

    expect(textos(sinTabla).join("\n")).toMatch(/tabla de fuentes/);
    expect(textos(sinColumnas).join("\n")).toMatch(/columnas/);
  });
});

describe("las citas", () => {
  it("una cita a una fuente que no existe se rechaza, una sola vez por documento", () => {
    const root = con({
      ...BASE,
      "investigacion/hermes/hermes-audit.md": `${auditoria("E-1", "E-2", "E-9")}\nOtra vez [E-9].\n`,
    });

    const t = textos(root);

    expect(t).toEqual([
      expect.stringMatching(/^bloqueo\|investigacion\/hermes\/hermes-audit\.md\|.*E-9/),
    ]);
  });

  it("una cita con demasiados dígitos es un identificador no válido, no una fuente", () => {
    const root = con({
      ...BASE,
      "investigacion/hermes/hermes-audit.md": `${auditoria("E-1", "E-2")}\nY [E-12345678].\n`,
    });

    expect(textos(root).join("\n")).toMatch(/identificador no válido en la línea \d+/);
  });

  it("una cita dentro de un bloque de código no cuenta", () => {
    const root = con({
      ...BASE,
      "investigacion/hermes/hermes-audit.md": `${auditoria("E-1", "E-2")}\n\`\`\`\n[E-9]\n\`\`\`\n`,
    });

    expect(comprobarEvidencia(root, HOY)).toEqual([]);
  });

  it("una fuente que nadie cita avisa, sin bloquear", () => {
    const root = con({ ...BASE, "investigacion/hermes/hermes-audit.md": auditoria("E-1") });

    expect(textos(root)).toEqual([
      expect.stringMatching(/^aviso\|.*E-2.*(ninguna cita|sin citar)/),
    ]);
  });

  it("las citas de cualquier documento del tema cuentan, no solo las de la auditoría", () => {
    const root = con({
      ...BASE,
      "investigacion/hermes/hermes-audit.md": auditoria("E-1"),
      "investigacion/hermes/hermes-threat-model.md": auditoria("E-2"),
    });

    expect(comprobarEvidencia(root, HOY)).toEqual([]);
  });
});

describe("lo que no debe pasar", () => {
  it("un documento que es un enlace simbólico es un hallazgo y no se lee", () => {
    const fuera = tempDir();
    write(fuera, "ajeno.md", "SECRETO [E-9]");
    const root = con(BASE);
    symlinkSync(join(fuera, "ajeno.md"), join(root, "investigacion/hermes/enlace.md"));

    const salida = textos(root).join("\n");

    expect(salida).toMatch(/enlace simbólico/);
    expect(salida).not.toContain("SECRETO");
    expect(salida).not.toContain("E-9");
  });

  it("un índice o un documento demasiado grande bloquea y no se lee", () => {
    const root = con({
      ...BASE,
      "investigacion/hermes/enorme.md": `[E-9]${"x".repeat(1024 * 1024)}`,
    });

    const t = textos(root);

    expect(t).toEqual([expect.stringMatching(/^bloqueo\|.*enorme\.md\|.*demasiado grande/)]);
  });

  it("no cita el contenido de las celdas ni del texto", () => {
    const root = con({
      "investigacion/hermes/hermes-evidence-index.md": indice(
        fila("E-1", "", "hecho", "CONTENIDO-SECRETO"),
      ),
      "investigacion/hermes/audit.md": `# A\n\nTEXTO-SECRETO [E-1]\n`,
    });

    expect(textos(root).join("\n")).not.toMatch(/SECRETO/);
  });

  it("más de 500 documentos en un tema no se recorren: el tope bloquea", () => {
    const root = con(BASE);
    for (let i = 0; i < 501; i++) write(root, `investigacion/hermes/d${i}.md`, "x");

    expect(textos(root).join("\n")).toMatch(/demasiados documentos/);
  });

  it("un nombre de tema hostil sale saneado", () => {
    const root = con({
      [`investigacion/a\u001b[31m${"x".repeat(200)}/audit.md`]: auditoria("E-1"),
    });

    const salida = textos(root).join("\n");

    expect(salida).not.toContain("\u001b");
    expect(Math.max(...salida.split("\n").map((l) => [...l].length))).toBeLessThan(260);
  });

  it("ningún mensaje usa la palabra «desconocido»", () => {
    const root = con({
      "investigacion/hermes/hermes-evidence-index.md": indice(
        fila("E-1", "x", "quizás"),
        fila("???"),
      ),
      "investigacion/hermes/audit.md": auditoria("E-9"),
    });

    expect(textos(root).join("\n")).not.toMatch(/desconocid/i);
  });
});
