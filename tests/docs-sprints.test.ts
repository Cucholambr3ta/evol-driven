import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analizarSprints, comprobarSprints } from "../src/docs/sprints.js";
import { tempDir, write } from "./helpers.js";

const indice = (...sprints: { id: string; historias: string[] }[]): string =>
  JSON.stringify({ sprints: sprints.map((s) => ({ ...s, titulo: `Sprint ${s.id}` })) });

function historia(root: string, id: string, marcas: string): void {
  for (const n of ["propuesta", "requisitos-escenarios", "escenario-tecnico"])
    write(root, `docs/historias/${id}/${n}.md`, `# ${n}\n`);
  const tareas = [...marcas].map((m, i) => `- [${m}] tarea ${i + 1}`).join("\n");
  write(root, `docs/historias/${id}/checklist-tareas.md`, `# Checklist\n\n${tareas}\n`);
}
const textos = (root: string): string[] =>
  comprobarSprints(root).map((f) => `${f.nivel}|${f.archivo}|${f.mensaje}`);

describe("sprints: el índice", () => {
  it("sin INDEX.json, la carpeta da un bloqueo que lo nombra", () => {
    const root = tempDir();
    mkdirSync(join(root, "docs/sprints"), { recursive: true });

    expect(textos(root)).toEqual([expect.stringContaining("falta el índice")]);
  });

  it.each([
    ["no es JSON", "{"],
    ["tiene una clave de más", JSON.stringify({ sprints: [], extra: 1 })],
    ["un id con barra", indice({ id: "../x", historias: [] })],
    ["un id reservado", indice({ id: "__proto__", historias: [] })],
    ["un id reservado", indice({ id: "constructor", historias: [] })],
    ["una historia mal escrita", indice({ id: "01", historias: ["HU-x"] })],
    ["un id de 41 caracteres", indice({ id: "a".repeat(41), historias: [] })],
  ])("rechaza el índice con %s sin quebrar", (_caso, contenido) => {
    const root = tempDir();
    write(root, "docs/sprints/INDEX.json", contenido);

    const t = textos(root);

    expect(t).toHaveLength(1);
    expect(t[0]).toMatch(/^bloqueo\|docs\/sprints\/INDEX\.json\|/);
  });

  it("rechaza más de 200 sprints", () => {
    const root = tempDir();
    const muchos = Array.from({ length: 201 }, (_, i) => ({ id: `s${i}`, historias: [] }));
    write(root, "docs/sprints/INDEX.json", indice(...muchos));

    expect(textos(root)).toHaveLength(1);
  });

  it("un id repetido, sin distinguir mayúsculas, bloquea", () => {
    const root = tempDir();
    write(
      root,
      "docs/sprints/INDEX.json",
      indice({ id: "A", historias: [] }, { id: "a", historias: [] }),
    );

    expect(textos(root)).toEqual([expect.stringContaining("identificador repetido")]);
  });

  it("no cita el contenido del índice al rechazarlo", () => {
    const root = tempDir();
    write(
      root,
      "docs/sprints/INDEX.json",
      JSON.stringify({ sprints: [{ id: "SECRETO!", titulo: "x", historias: [] }] }),
    );

    expect(textos(root).join("\n")).not.toContain("SECRETO");
  });
});

describe("sprints: historias y estado", () => {
  it("una historia que no existe se nombra, y una a la que le falta un documento también", () => {
    const root = tempDir();
    historia(root, "HU-1", "x");
    write(root, "docs/historias/HU-2/propuesta.md", "# p\n");
    write(
      root,
      "docs/sprints/INDEX.json",
      indice({ id: "01", historias: ["HU-1", "HU-2", "HU-9"] }),
    );

    const t = textos(root);

    expect(t.find((x) => x.includes("HU-9"))).toMatch(/no existe/);
    expect(t.filter((x) => x.includes("HU-2/"))).toHaveLength(3);
    expect(t.some((x) => x.includes("HU-1"))).toBe(false);
  });

  it("cuenta las casillas marcadas con x y X, y deja fuera los bloques de código", () => {
    const root = tempDir();
    historia(root, "HU-1", "xX  ");
    write(
      root,
      "docs/historias/HU-1/checklist-tareas.md",
      "- [x] a\n- [X] b\n- [ ] c\n```\n- [ ] no\n```\n",
    );
    write(root, "docs/sprints/INDEX.json", indice({ id: "01", historias: ["HU-1"] }));

    expect(analizarSprints(root).estados).toEqual([
      { id: "01", titulo: "Sprint 01", hechas: 2, total: 3, cerrado: false },
    ]);
  });

  it("un sprint sin tareas no está cerrado", () => {
    const root = tempDir();
    write(root, "docs/sprints/INDEX.json", indice({ id: "01", historias: [] }));

    expect(analizarSprints(root).estados[0]?.cerrado).toBe(false);
    expect(textos(root)).toEqual([]);
  });

  it("un sprint cerrado pide lecciones y memoria, y nombra solo la que falta", () => {
    const root = tempDir();
    historia(root, "HU-1", "xx");
    write(root, "docs/sprints/INDEX.json", indice({ id: "01", historias: ["HU-1"] }));
    write(root, "docs/sprints/01/lecciones.md", "### algo — 2026-10-20\n");

    const t = textos(root);

    expect(t).toHaveLength(1);
    expect(t[0]).toMatch(/incompleto: falta memoria\.md$/);
  });

  it("un sprint cerrado con ambos documentos no da hallazgos", () => {
    const root = tempDir();
    historia(root, "HU-1", "x");
    write(root, "docs/sprints/INDEX.json", indice({ id: "01", historias: ["HU-1"] }));
    write(root, "docs/sprints/01/lecciones.md", "a\n");
    write(root, "docs/sprints/01/memoria.md", "a\n");

    expect(textos(root)).toEqual([]);
  });

  it("un documento que es un enlace simbólico no se lee", () => {
    const root = tempDir();
    historia(root, "HU-2", "x");
    write(root, "fuera.md", "- [x] a\n");
    rmSync(join(root, "docs/historias/HU-2/checklist-tareas.md"));
    symlinkSync(join(root, "fuera.md"), join(root, "docs/historias/HU-2/checklist-tareas.md"));
    write(root, "docs/sprints/INDEX.json", indice({ id: "01", historias: ["HU-2"] }));

    expect(textos(root)).toEqual([expect.stringContaining("enlace simbólico")]);
  });
});
