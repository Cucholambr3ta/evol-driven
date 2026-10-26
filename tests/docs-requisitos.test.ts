import { describe, expect, it } from "vitest";
import { comprobarRequisitos } from "../src/docs/requisitos.js";
import { tempDir, write } from "./helpers.js";

const CABECERA =
  "| ID | Requisito | Métrica | Umbral | Validación |\n| --- | --- | --- | --- | --- |";
const nfr = (...filas: string[]): string => `# NFR\n\n${[CABECERA, ...filas].join("\n")}\n`;
const lim = (id: string, ...campos: string[]): string => `### ${id} Algo\n\n${campos.join("\n")}\n`;
const restricciones = (...limitaciones: string[]): string =>
  `# Restricciones\n\n## Limitaciones conocidas\n\n${limitaciones.join("\n")}`;

function con(archivos: Record<string, string>): string {
  const root = tempDir();
  for (const [ruta, contenido] of Object.entries(archivos)) write(root, ruta, contenido);
  return root;
}
const textos = (root: string): string[] =>
  comprobarRequisitos(root).map((f) => `${f.nivel}|${f.archivo}|${f.mensaje}`);

describe("requisitos no funcionales", () => {
  it("una tabla completa no da ningún hallazgo", () => {
    const root = con({
      "docs/requisitos/NO_FUNCIONALES.md": nfr(
        "| NFR-01 | Arranque | s | < 5 | `time evol doctor` |",
      ),
    });

    expect(comprobarRequisitos(root)).toEqual([]);
  });

  it("nombra cada requisito por lo que le falta, y solo ese", () => {
    const root = con({
      "docs/requisitos/NO_FUNCIONALES.md": nfr(
        "| NFR-01 | Arranque | s | < 5 | `x` |",
        "| NFR-02 | Memoria | MB |  | `ps` |",
        "| NFR-03 | Latencia | ms | < 200 |  |",
        "| NFR-04 | Disco |  | < 1 | `du` |",
      ),
    });

    const t = textos(root);

    expect(t).toHaveLength(3);
    expect(t.find((x) => x.includes("NFR-02"))).toMatch(/umbral/);
    expect(t.find((x) => x.includes("NFR-03"))).toMatch(/validaci/);
    expect(t.find((x) => x.includes("NFR-04"))).toMatch(/m[eé]trica/);
    expect(t.join("\n")).not.toContain("NFR-01");
  });

  it("un identificador repetido o con mal formato se rechaza sin citarlo", () => {
    const root = con({
      "docs/requisitos/NO_FUNCIONALES.md": nfr(
        "| NFR-01 | A | m | u | v |",
        "| NFR-01 | B | m | u | v |",
        "| \u001b[31mXX | C | m | u | v |",
      ),
    });

    const t = textos(root).join("\n");

    expect(t).toMatch(/NFR-01.*repetido/);
    expect(t).toMatch(/identificador no válido en la línea 7/);
    expect(t).not.toContain("\u001b");
  });

  it("falta la tabla o le faltan columnas: se dice", () => {
    expect(
      textos(con({ "docs/requisitos/NO_FUNCIONALES.md": "# NFR\n\nSolo prosa.\n" })).join("\n"),
    ).toMatch(/tabla de requisitos/);
    const sinUmbral = "# NFR\n\n| ID | Requisito |\n| - | - |\n| NFR-01 | A |\n";
    expect(textos(con({ "docs/requisitos/NO_FUNCIONALES.md": sinUmbral })).join("\n")).toMatch(
      /columnas/,
    );
  });

  it("una tabla dentro de un bloque de código no cuenta", () => {
    const root = con({
      "docs/requisitos/NO_FUNCIONALES.md": `# NFR\n\n\`\`\`\n${CABECERA}\n| NFR-01 | a | m |  |  |\n\`\`\`\n`,
    });

    expect(textos(root).join("\n")).toMatch(/tabla de requisitos/);
  });

  it("la cabecera se reconoce sin tildes ni mayúsculas", () => {
    const md =
      "# N\n\n| id | REQUISITO | metrica | UMBRAL | validacion |\n| - | - | - | - | - |\n| NFR-01 | a | b | c | d |\n";

    expect(comprobarRequisitos(con({ "docs/requisitos/NO_FUNCIONALES.md": md }))).toEqual([]);
  });
});

describe("limitaciones conocidas", () => {
  it("nombra la limitación a la que le falta un campo, y solo ese campo", () => {
    const root = con({
      "docs/requisitos/RESTRICCIONES.md": restricciones(
        lim("L01", "Razón: a.", "Impacto: b.", "Roadmap: c."),
        lim("L02", "Razón: a.", "Roadmap: c."),
        lim("L03", "Razón: a.", "Impacto:   ", "Roadmap: c."),
      ),
    });

    const t = textos(root);

    expect(t).toHaveLength(2);
    expect(t.find((x) => x.includes("L02"))).toMatch(/Impacto/);
    expect(t.find((x) => x.includes("L02"))).not.toMatch(/Raz[oó]n|Roadmap/);
    expect(t.find((x) => x.includes("L03"))).toMatch(/Impacto/);
    expect(t.join("\n")).not.toContain("L01");
  });

  it("los campos se reconocen sin tildes ni mayúsculas", () => {
    const root = con({
      "docs/requisitos/RESTRICCIONES.md": restricciones(
        lim("L01", "razon: a.", "IMPACTO: b.", "roadmap: c."),
      ),
    });

    expect(comprobarRequisitos(root)).toEqual([]);
  });

  it("una limitación sin identificador válido o repetida se rechaza", () => {
    const root = con({
      "docs/requisitos/RESTRICCIONES.md": restricciones(
        lim("L01", "Razón: a.", "Impacto: b.", "Roadmap: c."),
        lim("L01", "Razón: a.", "Impacto: b.", "Roadmap: c."),
        "### Sin id\n\nRazón: a.\n",
      ),
    });

    const t = textos(root).join("\n");

    expect(t).toMatch(/L01.*repetida/);
    expect(t).toMatch(/identificador no válido/);
  });

  it("sin la sección «Limitaciones conocidas» se dice, y las que están fuera de ella no cuentan", () => {
    const sin = con({
      "docs/requisitos/RESTRICCIONES.md": "# R\n\n## Otra cosa\n\n### L01 x\n\nRazón: a.\n",
    });

    expect(textos(sin).join("\n")).toMatch(/Limitaciones conocidas/);
  });
});

describe("glosario", () => {
  it("nombra el término repetido, aunque cambien las mayúsculas o las tildes, y no los demás", () => {
    const root = con({
      "docs/requisitos/GLOSARIO.md":
        "# G\n\n### Gate\n\na\n\n### Ciclo\n\nb\n\n### GATE\n\nc\n\n### Aprobación\n\nd\n\n### aprobacion\n\ne\n",
    });

    const t = textos(root);

    expect(t).toHaveLength(2);
    expect(t.join("\n")).toMatch(/Gate/i);
    expect(t.join("\n")).toMatch(/aprobaci/i);
    expect(t.join("\n")).not.toContain("Ciclo");
  });

  it("un glosario sin repeticiones no da ningún hallazgo", () => {
    expect(
      comprobarRequisitos(
        con({ "docs/requisitos/GLOSARIO.md": "# G\n\n### A\n\nx\n\n### B\n\ny\n" }),
      ),
    ).toEqual([]);
  });

  it("un término con caracteres de control sale saneado y truncado", () => {
    const hostil = `Gate\u001b[31m${"x".repeat(200)}\n`;
    const root = con({
      "docs/requisitos/GLOSARIO.md": `# G\n\n### ${hostil.trim()}\n\na\n\n### ${hostil.trim()}\n\nb\n`,
    });

    const t = textos(root).join("\n");

    expect(t).not.toContain("\u001b");
    expect([...t].length).toBeLessThan(260);
  });
});

describe("archivos que faltan", () => {
  it("si ninguno de los tres existe no hay nada que decir (de eso se ocupa el artefacto de la disciplina)", () => {
    expect(comprobarRequisitos(tempDir())).toEqual([]);
  });
});
