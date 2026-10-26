import { describe, expect, it } from "vitest";
import { cli, makeProject, write } from "../helpers.js";
import { DISC, env, existe, lineaDe, salida } from "./docs-fixtures.js";

const indiceSprints = (...sprints: { id: string; historias: string[] }[]): string =>
  JSON.stringify({ sprints: sprints.map((s) => ({ ...s, titulo: `Sprint ${s.id}` })) }, null, 2);

/** A story folder with its four documents; `marcadas` of `total` checklist tasks are done. */
function historia(root: string, id: string, marcadas: number, total: number): void {
  for (const nombre of ["propuesta", "requisitos-escenarios", "escenario-tecnico"])
    write(root, `docs/historias/${id}/${nombre}.md`, `# ${nombre} de ${id}\n\nContenido.\n`);
  const tareas = Array.from(
    { length: total },
    (_, i) => `- [${i < marcadas ? "x" : " "}] tarea ${i + 1}`,
  );
  write(
    root,
    `docs/historias/${id}/checklist-tareas.md`,
    `# Checklist de ${id}\n\n${tareas.join("\n")}\n`,
  );
}

describe("historias y sprints con su propia evidencia", () => {
  it("CA-167: un sprint que apunta a una historia que no existe se rechaza", () => {
    const root = makeProject(DISC);
    write(root, "docs/sprints/INDEX.json", indiceSprints({ id: "01", historias: ["HU-9"] }));

    const r = cli(["sprint", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(salida(r)).toContain("HU-9");
  });

  it("CA-168: el estado de un sprint cuenta las tareas marcadas", () => {
    const root = makeProject(DISC);
    historia(root, "HU-1", 3, 5);
    write(root, "docs/sprints/INDEX.json", indiceSprints({ id: "01", historias: ["HU-1"] }));

    const r = cli(["sprint", "estado"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status, salida(r)).toBe(0);
    expect(r.stdout).toMatch(/01[^\n]*3\s*(de|\/)\s*5/);
  });

  it("CA-169: un sprint terminado sin memoria ni lecciones está incompleto", () => {
    const root = makeProject(DISC);
    historia(root, "HU-1", 4, 4);
    write(root, "docs/sprints/INDEX.json", indiceSprints({ id: "01", historias: ["HU-1"] }));

    const r = cli(["sprint", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(lineaDe(r, "01")).toMatch(/incompleto/i);
    expect(salida(r)).toContain("lecciones.md");
    expect(salida(r)).toContain("memoria.md");
  });

  it("CA-169: un sprint todavía abierto no exige memoria ni lecciones", () => {
    const root = makeProject(DISC);
    historia(root, "HU-2", 3, 5);
    write(root, "docs/sprints/INDEX.json", indiceSprints({ id: "02", historias: ["HU-2"] }));

    const r = cli(["sprint", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status, salida(r)).toBe(0);
  });

  it("CA-170: la disciplina de historias y sprints la aplica el analista en plan", () => {
    const root = makeProject(DISC);

    const r = cli(["disciplines", "list", "--json"], { cwd: root, env: env() });

    const filas = JSON.parse(r.stdout) as { id: string; rol?: string; fases: string[] }[];
    const sprintdd = filas.find((d) => d.id === "SPRINTDD");
    expect(sprintdd?.rol).toBe("analista");
    expect(sprintdd?.fases).toContain("plan");
  });
});
