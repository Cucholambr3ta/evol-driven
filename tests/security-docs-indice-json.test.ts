import { describe, expect, it } from "vitest";
import { analizarSprints } from "../src/docs/sprints.js";
import { tempDir, write } from "./helpers.js";

const analizar = (json: string) => {
  const root = tempDir();
  write(root, "docs/sprints/INDEX.json", json);
  return analizarSprints(root);
};

describe("docs/sprints/INDEX.json es un dato hostil (CA-167)", () => {
  it("un __proto__ en el índice no contamina los objetos ni se acepta", () => {
    const r = analizar(
      '{"sprints":[{"id":"01","titulo":"x","historias":[],"__proto__":{"polluted":1}}]}',
    );

    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect(r.hallazgos).toHaveLength(1);
    expect(r.estados).toEqual([]);
  });

  it("un __proto__ en la raíz tampoco", () => {
    const r = analizar('{"__proto__":{"polluted":1},"sprints":[]}');

    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect(r.hallazgos).toHaveLength(1);
  });

  it.each(["__proto__", "constructor", "prototype"])("el id «%s» se rechaza", (id) => {
    const r = analizar(JSON.stringify({ sprints: [{ id, titulo: "x", historias: [] }] }));

    expect(r.estados).toEqual([]);
    expect(r.hallazgos).toHaveLength(1);
  });

  it("una anidación enorme se rechaza sin desbordar la pila", () => {
    const r = analizar(`${"[".repeat(50_000)}${"]".repeat(50_000)}`);

    expect(r.hallazgos).toHaveLength(1);
  });

  it("un id con una barra, un punto o un salto de línea no llega a formar una ruta", () => {
    for (const id of ["../x", "a/b", ".", "a\nb", "a b", ""]) {
      const r = analizar(JSON.stringify({ sprints: [{ id, titulo: "x", historias: [] }] }));
      expect(r.estados, id).toEqual([]);
    }
  });

  it("un título de más de 200 caracteres se rechaza", () => {
    const r = analizar(
      JSON.stringify({ sprints: [{ id: "01", titulo: "x".repeat(201), historias: [] }] }),
    );

    expect(r.hallazgos).toHaveLength(1);
  });
});
