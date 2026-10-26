import { describe, expect, it } from "vitest";
import {
  encabezados,
  enlaces,
  lineasDeTexto,
  normalizar,
  secciones,
  tablas,
} from "../src/docs/markdown.js";

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

describe("tablas", () => {
  const md = [
    "# NFR",
    "",
    "| ID | Requisito | Umbral |",
    "| --- | :---: | ---: |",
    "| NFR-01 | Arranque | < 5 s |",
    "| NFR-02 | Memoria |  |",
    "",
    "texto",
  ].join("\n");

  it("devuelve una fila por línea, con las cabeceras normalizadas y la línea de cada fila", () => {
    expect(tablas(md)).toEqual([
      {
        cabeceras: ["id", "requisito", "umbral"],
        filas: [
          { linea: 5, celdas: { id: "NFR-01", requisito: "Arranque", umbral: "< 5 s" } },
          { linea: 6, celdas: { id: "NFR-02", requisito: "Memoria", umbral: "" } },
        ],
      },
    ]);
  });

  it("una celda con una barra escapada o entre comillas inversas no parte la fila", () => {
    const t = tablas("| a | b |\n| - | - |\n| x \\| y | `p | q` |");

    expect(t[0]?.filas[0]?.celdas).toEqual({ a: "x | y", b: "`p | q`" });
  });

  it("ignora una tabla dentro de un bloque de código y un texto con barras que no es tabla", () => {
    expect(tablas("```\n| a |\n| - |\n| 1 |\n```")).toEqual([]);
    expect(tablas("a | b\nc | d")).toEqual([]);
  });

  it("una fila con menos celdas que cabeceras deja las que faltan vacías", () => {
    expect(tablas("| a | b |\n| - | - |\n| solo |")[0]?.filas[0]?.celdas).toEqual({
      a: "solo",
      b: "",
    });
  });
});

describe("enlaces", () => {
  it("devuelve el destino de cada enlace y su línea, sin el título opcional", () => {
    const md = 'ver [uno](db/a.md) y [dos](api/b.md "título")\n\n[tres]( c.md )';

    expect(enlaces(md)).toEqual([
      { destino: "db/a.md", linea: 1 },
      { destino: "api/b.md", linea: 1 },
      { destino: "c.md", linea: 3 },
    ]);
  });

  it("no cuenta los enlaces de un bloque de código ni las imágenes", () => {
    expect(enlaces("```\n[x](a.md)\n```\n![img](b.png)")).toEqual([]);
  });

  it("acepta paréntesis equilibrados dentro del destino", () => {
    expect(enlaces("[x](a_(1).md)")).toEqual([{ destino: "a_(1).md", linea: 1 }]);
  });
});

describe("secciones", () => {
  const md = ["# T", "## Uno", "a", "b", "### Sub", "c", "## Dos", "d"].join("\n");

  it("corta el texto en el siguiente encabezado del mismo nivel o menor", () => {
    expect(secciones(md, 2).map((x) => [x.titulo, x.lineas])).toEqual([
      ["Uno", ["a", "b", "### Sub", "c"]],
      ["Dos", ["d"]],
    ]);
  });

  it("a nivel 3 devuelve solo los encabezados de ese nivel", () => {
    expect(secciones(md, 3).map((x) => x.titulo)).toEqual(["Sub"]);
  });
});
