import { describe, expect, it } from "vitest";
import { comprobarDocs } from "../src/docs/check.js";
import { analizarSprints } from "../src/docs/sprints.js";
import { TOPE_ARCHIVO, TOPE_DOCUMENTOS } from "../src/docs/lectura.js";
import { tempDir, write } from "./helpers.js";

const TOPE_MS = 3000;

describe("los comprobadores de documentación acotan lo que leen (CA-150, CA-157, CA-167)", () => {
  it("más de 500 documentos en un árbol es un bloqueo, no una lectura sin fin", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "# Spec\n");
    write(root, "docs/proyecto/INDEX.md", "# Índice\n");
    for (let i = 0; i <= TOPE_DOCUMENTOS; i++) write(root, `docs/proyecto/d/${i}.md`, "x\n");
    for (let i = 0; i <= TOPE_DOCUMENTOS; i++) write(root, `investigacion/t/${i}.md`, "x\n");

    const t0 = Date.now();
    const r = comprobarDocs(root);

    expect(Date.now() - t0).toBeLessThan(TOPE_MS * 3);
    expect(r.hallazgos.some((h) => h.nivel === "bloqueo" && /demasiados/.test(h.mensaje))).toBe(
      true,
    );
  });

  it("un documento de más de 1 MiB no se lee y se nombra como demasiado grande", () => {
    const root = tempDir();
    write(root, "docs/requisitos/NO_FUNCIONALES.md", "x".repeat(TOPE_ARCHIVO + 1));
    write(root, "docs/sprints/INDEX.json", " ".repeat(TOPE_ARCHIVO + 1));

    const r = comprobarDocs(root);

    expect(r.hallazgos.filter((h) => /demasiado grande/.test(h.mensaje))).toHaveLength(2);
  });

  it.each([
    ["barras de tabla", "|".repeat(200_000)],
    ["corchetes de enlace", "[".repeat(200_000)],
    ["paréntesis de enlace", "[a](".repeat(40_000)],
    ["comillas inversas", "`".repeat(200_000)],
    ["almohadillas", "#".repeat(200_000)],
    ["una tabla con cien mil celdas", `${"| a ".repeat(100_000)}|`],
  ])("una línea patológica de %s se analiza en tiempo acotado", (_nombre, patologica) => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "# Spec\n");
    write(root, "docs/proyecto/d/uno.md", `# Uno\n\nOrigen: docs/specs/SPEC.md\n\n${patologica}\n`);
    write(root, "docs/proyecto/INDEX.md", `# Índice\n\n${patologica}\n- [uno](d/uno.md)\n`);
    write(
      root,
      "docs/requisitos/NO_FUNCIONALES.md",
      `${patologica}\n| ID | Requisito |\n| - | - |\n`,
    );
    write(root, "docs/requisitos/RESTRICCIONES.md", `${patologica}\n`);
    write(root, "docs/requisitos/GLOSARIO.md", `${patologica}\n`);
    write(root, "investigacion/t/t-evidence-index.md", `${patologica}\n`);
    write(root, "investigacion/t/audit.md", `${patologica}\n`);

    const t0 = Date.now();
    comprobarDocs(root);

    expect(Date.now() - t0).toBeLessThan(TOPE_MS);
  });
});

describe("límites que los revisores independientes pidieron (CA-150, CA-157, CA-161, CA-167)", () => {
  it("una tabla de decenas de miles de columnas o de filas se descarta sin agotar la memoria", () => {
    const root = tempDir();
    write(
      root,
      "docs/requisitos/NO_FUNCIONALES.md",
      `|${" a |".repeat(20_000)}\n|${" - |".repeat(20_000)}\n${"|\n".repeat(200_000)}`,
    );

    const t0 = Date.now();
    const r = comprobarDocs(root);

    expect(Date.now() - t0).toBeLessThan(TOPE_MS);
    expect(r.hallazgos.some((h) => /tabla/.test(h.mensaje))).toBe(true);
  });

  it("una línea de cien mil espacios no hace cuadrática la búsqueda de la tabla", () => {
    const root = tempDir();
    write(root, "docs/requisitos/NO_FUNCIONALES.md", `|\n${" ".repeat(100_000)}x\n`);

    const t0 = Date.now();
    comprobarDocs(root);

    expect(Date.now() - t0).toBeLessThan(TOPE_MS);
  });

  it("lo que se lee en una parte se acota a 5 MiB en total", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "# Spec\n");
    write(root, "docs/proyecto/INDEX.md", "# Índice\n");
    const casi = `Origen: docs/specs/SPEC.md\n${"x".repeat(TOPE_ARCHIVO - 100)}\n`;
    for (let i = 0; i < 8; i++) write(root, `docs/proyecto/d/${i}.md`, casi);

    const r = comprobarDocs(root);

    expect(r.hallazgos.some((h) => /tope de \d+ bytes/.test(h.mensaje))).toBe(true);
  });

  it("una historia nombrada cien veces se lee una sola vez y cuenta una sola vez", () => {
    const root = tempDir();
    for (const n of ["propuesta", "requisitos-escenarios", "escenario-tecnico"])
      write(root, `docs/historias/HU-1/${n}.md`, "# x\n");
    write(root, "docs/historias/HU-1/checklist-tareas.md", "- [x] a\n- [ ] b\n");
    const sprint = { id: "01", titulo: "x", historias: Array(100).fill("HU-1") as string[] };
    write(root, "docs/sprints/INDEX.json", JSON.stringify({ sprints: [sprint] }));

    const estado = analizarSprints(root).estados[0];

    expect(estado).toMatchObject({ hechas: 1, total: 2 });
  });

  it("más de 200 hallazgos se recortan con una línea de «y N más»", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "# Spec\n");
    write(root, "docs/proyecto/INDEX.md", "# Índice\n");
    for (let i = 0; i < 300; i++) write(root, `docs/proyecto/d/${i}.md`, "# x\n");

    const r = comprobarDocs(root);

    expect(r.hallazgos.length).toBe(201);
    expect(r.hallazgos.at(-1)?.mensaje).toMatch(/hallazgos más/);
  });

  it("solo cuentan como tarea las casillas con «- » y hasta tres espacios de sangría", () => {
    const root = tempDir();
    for (const n of ["propuesta", "requisitos-escenarios", "escenario-tecnico"])
      write(root, `docs/historias/HU-1/${n}.md`, "# x\n");
    write(
      root,
      "docs/historias/HU-1/checklist-tareas.md",
      "- [x] a\n   - [ ] b\n    - [ ] sangrada\n* [ ] otra\n+ [x] más\n",
    );
    write(
      root,
      "docs/sprints/INDEX.json",
      JSON.stringify({ sprints: [{ id: "01", titulo: "x", historias: ["HU-1"] }] }),
    );

    expect(analizarSprints(root).estados[0]).toMatchObject({ hechas: 1, total: 2 });
  });
});
