import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_LINEAS, comprobarGranular } from "../src/docs/granular.js";
import { TOPE_ARCHIVO } from "../src/docs/lectura.js";
import { tempDir, write } from "./helpers.js";

const cuerpo = (n: number): string =>
  Array.from({ length: n }, (_, i) => `Línea ${i + 1} del subdominio.`).join("\n");
const documento = (origen = "Origen: docs/specs/SPEC.md", lineas = MIN_LINEAS): string =>
  `# Doc\n\n${origen}\n\n${cuerpo(lineas)}\n`;
const indice = (...rutas: string[]): string =>
  `# Índice\n\n${rutas.map((r) => `- [${r}](${r})`).join("\n")}\n`;

function proyecto(archivos: Record<string, string> = {}): string {
  const root = tempDir();
  write(root, "docs/specs/SPEC.md", "# Spec\n");
  for (const [ruta, contenido] of Object.entries(archivos)) write(root, ruta, contenido);
  return root;
}
const mensajes = (root: string): string[] =>
  comprobarGranular(root).map((f) => `${f.nivel}|${f.archivo}|${f.mensaje}`);

describe("comprobarGranular: un árbol consistente", () => {
  it("no da ningún hallazgo", () => {
    const root = proyecto({
      "docs/proyecto/db/esquemas.md": documento(),
      "docs/proyecto/api/errores.md": documento(),
      "docs/proyecto/INDEX.md": indice("db/esquemas.md", "api/errores.md"),
    });

    expect(comprobarGranular(root)).toEqual([]);
  });

  it("el mínimo de contenido es exactamente MIN_LINEAS líneas", () => {
    const justo = proyecto({
      "docs/proyecto/db/a.md": documento("Origen: docs/specs/SPEC.md", MIN_LINEAS),
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });
    const corto = proyecto({
      "docs/proyecto/db/a.md": documento("Origen: docs/specs/SPEC.md", MIN_LINEAS - 1),
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });

    expect(comprobarGranular(justo)).toEqual([]);
    expect(comprobarGranular(corto)).toEqual([
      expect.objectContaining({ nivel: "aviso", archivo: "docs/proyecto/db/a.md" }),
    ]);
  });

  it("los encabezados, el origen y los bloques de código no cuentan como contenido", () => {
    const relleno = "```\n" + cuerpo(30) + "\n```\n";
    const root = proyecto({
      "docs/proyecto/db/a.md": `# A\n\n## B\n\nOrigen: docs/specs/SPEC.md\n\n${relleno}`,
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });

    expect(comprobarGranular(root).map((f) => f.nivel)).toEqual(["aviso"]);
  });
});

describe("comprobarGranular: trazabilidad en las dos direcciones", () => {
  it("un documento que el índice no enlaza y un enlace a algo que no existe se nombran los dos", () => {
    const root = proyecto({
      "docs/proyecto/api/errores.md": documento(),
      "docs/proyecto/INDEX.md": indice("db/relaciones.md"),
    });

    const m = mensajes(root);

    expect(m.find((x) => x.includes("docs/proyecto/api/errores.md"))).toMatch(/^bloqueo\|/);
    expect(m.find((x) => x.includes("db/relaciones.md"))).toMatch(
      /^bloqueo\|docs\/proyecto\/INDEX\.md\|/,
    );
    expect(m).toHaveLength(2);
  });

  it("falta el índice: se dice una vez, no una por documento", () => {
    const root = proyecto({
      "docs/proyecto/db/a.md": documento(),
      "docs/proyecto/db/b.md": documento(),
    });

    const m = mensajes(root);

    expect(m).toHaveLength(1);
    expect(m[0]).toContain("INDEX.md");
  });

  it("un documento suelto fuera de una carpeta de dominio se rechaza", () => {
    const root = proyecto({
      "docs/proyecto/suelto.md": documento(),
      "docs/proyecto/INDEX.md": indice("suelto.md"),
    });

    expect(mensajes(root).join("\n")).toMatch(/docs\/proyecto\/suelto\.md.*carpeta de dominio/);
  });

  it("un enlace repetido o un enlace a un documento ya enlazado no es un error", () => {
    const root = proyecto({
      "docs/proyecto/db/a.md": documento(),
      "docs/proyecto/INDEX.md": `${indice("db/a.md")}\nOtra vez [aquí](db/a.md).\n`,
    });

    expect(comprobarGranular(root)).toEqual([]);
  });

  it("los enlaces http y mailto se ignoran", () => {
    const root = proyecto({
      "docs/proyecto/db/a.md": documento(),
      "docs/proyecto/INDEX.md": `${indice("db/a.md")}\n[web](https://example.org) [yo](mailto:a@b.c)\n`,
    });

    expect(comprobarGranular(root)).toEqual([]);
  });

  it.each([
    ["../specs/SPEC.md"],
    ["/etc/passwd"],
    ["file:///etc/passwd"],
    ["%2e%2e/specs/SPEC.md"],
  ])("un enlace del índice «%s» que sale de docs/proyecto se rechaza sin leerlo", (destino) => {
    const root = proyecto({
      "docs/proyecto/db/a.md": documento(),
      "docs/proyecto/INDEX.md": `${indice("db/a.md")}\n[x](${destino})\n`,
    });

    const m = mensajes(root);

    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/^bloqueo\|docs\/proyecto\/INDEX\.md\|/);
    expect(m[0]).toMatch(/enlace no válido/);
  });

  it("un enlace del índice a un archivo que existe pero no es un documento de dominio se rechaza", () => {
    const root = proyecto({
      "docs/proyecto/db/a.md": documento(),
      "docs/proyecto/INDEX.md": `${indice("db/a.md")}\n[spec](../specs/SPEC.md)\n`,
    });

    expect(mensajes(root).join("\n")).toMatch(/enlace no válido/);
  });
});

describe("comprobarGranular: el origen", () => {
  it("un documento sin línea de origen se rechaza", () => {
    const root = proyecto({
      "docs/proyecto/db/a.md": documento("Sin línea de origen."),
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });

    expect(mensajes(root)).toEqual([
      expect.stringMatching(/^bloqueo\|docs\/proyecto\/db\/a\.md\|.*Origen/),
    ]);
  });

  it("un origen que apunta a un archivo que no existe se rechaza y dice cuál", () => {
    const root = proyecto({
      "docs/proyecto/db/a.md": documento("Origen: docs/specs/NO-EXISTE.md"),
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });

    const m = mensajes(root);

    expect(m).toHaveLength(1);
    expect(m[0]).toContain("docs/specs/NO-EXISTE.md");
    expect(m[0]).toMatch(/no existe/);
  });

  it("un origen que sale de la raíz da el mismo mensaje exista o no el destino", () => {
    const fuera = tempDir();
    write(fuera, "secreto.md", "no debe leerse");
    const a = proyecto({
      "docs/proyecto/db/a.md": documento(`Origen: ../../../../../../${fuera}/secreto.md`),
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });
    const b = proyecto({
      "docs/proyecto/db/a.md": documento("Origen: ../../../../../../no/existe.md"),
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });

    const [ma, mb] = [mensajes(a), mensajes(b)];

    expect(ma[0]?.replace(/\|.*\|/, "|")).toBe(mb[0]?.replace(/\|.*\|/, "|"));
    expect(ma.join("\n")).not.toContain("no debe leerse");
    expect(ma.join("\n")).toMatch(/no se puede resolver/);
  });

  it("un origen que es un enlace simbólico a un archivo de fuera se rechaza", () => {
    const fuera = tempDir();
    write(fuera, "ajeno.md", "x");
    const root = proyecto({
      "docs/proyecto/db/a.md": documento("Origen: docs/ajeno.md"),
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });
    symlinkSync(join(fuera, "ajeno.md"), join(root, "docs", "ajeno.md"));

    expect(mensajes(root).join("\n")).toMatch(/no se puede resolver/);
  });

  it("solo cuenta la primera línea de origen y no la que esté dentro de un bloque de código", () => {
    const root = proyecto({
      "docs/proyecto/db/a.md": `# A\n\n\`\`\`\nOrigen: docs/specs/SPEC.md\n\`\`\`\n\n${cuerpo(MIN_LINEAS)}\n`,
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });

    expect(mensajes(root).join("\n")).toMatch(/Origen/);
  });
});

describe("comprobarGranular: lo que no debe pasar", () => {
  it("un documento que es un enlace simbólico es un hallazgo y no se lee", () => {
    const fuera = tempDir();
    write(fuera, "secreto.md", `Origen: docs/specs/SPEC.md\nSECRETO\n${cuerpo(30)}`);
    const root = proyecto({ "docs/proyecto/INDEX.md": indice("db/a.md") });
    mkdirSync(join(root, "docs/proyecto/db"), { recursive: true });
    symlinkSync(join(fuera, "secreto.md"), join(root, "docs/proyecto/db/a.md"));

    const salida = mensajes(root).join("\n");

    expect(salida).toMatch(/enlace simbólico/);
    expect(salida).not.toContain("SECRETO");
  });

  it("un documento demasiado grande bloquea y no se lee", () => {
    const root = proyecto({
      "docs/proyecto/db/a.md": `Origen: docs/specs/SPEC.md\n${"x".repeat(TOPE_ARCHIVO)}`,
      "docs/proyecto/INDEX.md": indice("db/a.md"),
    });

    expect(mensajes(root)).toEqual([expect.stringMatching(/^bloqueo\|.*demasiado grande/)]);
  });

  it("un nombre de archivo hostil sale saneado y truncado", () => {
    const hostil = `a\u001b[31m${"x".repeat(200)}\n.md`;
    const root = proyecto({
      [`docs/proyecto/db/${hostil}`]: documento(),
      "docs/proyecto/INDEX.md": indice("db/otro.md"),
    });

    const salida = comprobarGranular(root)
      .map((f) => `${f.archivo} ${f.mensaje}`)
      .join("\n");

    expect(salida).not.toMatch(/[\u0000-\u0009\u000b-\u001f]/);
    expect(salida).not.toContain("\u001b");
    expect(Math.max(...salida.split("\n").map((l) => [...l].length))).toBeLessThan(260);
  });

  it("más de 500 documentos no se recorren: el tope bloquea", () => {
    const root = proyecto({ "docs/proyecto/INDEX.md": indice() });
    for (let i = 0; i < 501; i++) write(root, `docs/proyecto/db/d${i}.md`, "x");

    expect(mensajes(root).join("\n")).toMatch(/demasiados documentos/);
  });

  it("ningún mensaje usa la palabra «desconocido»", () => {
    const root = proyecto({
      "docs/proyecto/db/a.md": documento("Sin origen", 2),
      "docs/proyecto/INDEX.md": `${indice("db/rota.md")}\n[x](../../etc/passwd)\n`,
    });

    expect(mensajes(root).join("\n")).not.toMatch(/desconocid/i);
  });
});
