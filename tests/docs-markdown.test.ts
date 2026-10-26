import { describe, expect, it } from "vitest";
import { encabezados, lineasDeTexto, normalizar } from "../src/docs/markdown.js";

describe("normalizar", () => {
  it.each([
    ["Decisión", "decision"],
    ["  OPCIONES  ", "opciones"],
    ["1. Contexto", "contexto"],
    ["2) Consecuencias:", "consecuencias"],
    ["Razón:", "razon"],
    ["Más   de   un   espacio", "mas de un espacio"],
    ["Ñandú", "nandu"],
  ])("«%s» → «%s»", (entrada, salida) => {
    expect(normalizar(entrada)).toBe(salida);
  });

  it("compara igual con y sin tildes, y sin distinguir mayúsculas", () => {
    expect(normalizar("DECISIÓN")).toBe(normalizar("decision"));
  });
});

describe("lineasDeTexto", () => {
  it("numera las líneas desde 1 y deja fuera los bloques de código", () => {
    const md = ["# Título", "texto", "```", "## dentro del código", "```", "después"].join("\n");

    expect(lineasDeTexto(md)).toEqual([
      { n: 1, texto: "# Título" },
      { n: 2, texto: "texto" },
      { n: 6, texto: "después" },
    ]);
  });

  it("un bloque que no se cierra deja fuera todo lo que sigue", () => {
    expect(lineasDeTexto("antes\n```\nsigue\nsigue")).toEqual([{ n: 1, texto: "antes" }]);
  });

  it("entiende vallas con tildes y con más de tres caracteres", () => {
    const md = "a\n~~~~\nx\n~~~~\nb\n````\ny\n````\nc";

    expect(lineasDeTexto(md).map((l) => l.texto)).toEqual(["a", "b", "c"]);
  });

  it("tolera finales de línea de Windows", () => {
    expect(lineasDeTexto("a\r\nb\r\n").map((l) => l.texto)).toEqual(["a", "b", ""]);
  });
});

describe("encabezados", () => {
  it("devuelve nivel, título y línea de cada encabezado", () => {
    const md = ["# Uno", "texto", "## Dos ##", "### Tres  ", "#sin espacio"].join("\n");

    expect(encabezados(md)).toEqual([
      { nivel: 1, titulo: "Uno", linea: 1 },
      { nivel: 2, titulo: "Dos", linea: 3 },
      { nivel: 3, titulo: "Tres", linea: 4 },
    ]);
  });

  it("no cuenta los encabezados que están dentro de un bloque de código", () => {
    const md = "## Real\n```\n## Falso\n```\n## Otro real";

    expect(encabezados(md).map((h) => h.titulo)).toEqual(["Real", "Otro real"]);
  });

  it("un encabezado de más de seis almohadillas no es un encabezado", () => {
    expect(encabezados("####### siete")).toEqual([]);
  });
});
