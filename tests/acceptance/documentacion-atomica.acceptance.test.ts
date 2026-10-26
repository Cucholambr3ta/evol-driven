import { describe, expect, it } from "vitest";
import { cli, makeProject, write } from "../helpers.js";
import { DISC, conSpec, doc, env, existe, indice, lineaDe, salida } from "./docs-fixtures.js";

function proyecto(): string {
  const root = makeProject(DISC);
  conSpec(root);
  return root;
}

describe("documentación atómica por dominio", () => {
  it("CA-150: un árbol consistente pasa la comprobación", () => {
    const root = proyecto();
    write(root, "docs/proyecto/db/esquemas.md", doc("Esquemas"));
    write(root, "docs/proyecto/INDEX.md", indice("db/esquemas.md"));

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status, salida(r)).toBe(0);
  });

  it("CA-151: un documento fuera del índice y un enlace roto se nombran los dos", () => {
    const root = proyecto();
    write(root, "docs/proyecto/api/errores.md", doc("Errores"));
    write(root, "docs/proyecto/INDEX.md", indice("db/relaciones.md"));

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(salida(r)).toContain("api/errores.md");
    expect(salida(r)).toContain("db/relaciones.md");
  });

  it("CA-152: un documento que no dice de dónde sale se rechaza", () => {
    const root = proyecto();
    write(root, "docs/proyecto/db/esquemas.md", doc("Esquemas", "Sin línea de origen."));
    write(root, "docs/proyecto/INDEX.md", indice("db/esquemas.md"));

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(lineaDe(r, "db/esquemas.md")).toMatch(/origen/i);
  });

  it("CA-152: un origen que apunta a un archivo que no existe se rechaza", () => {
    const root = proyecto();
    write(root, "docs/proyecto/db/esquemas.md", doc("Esquemas", "Origen: docs/specs/NO-EXISTE.md"));
    write(root, "docs/proyecto/INDEX.md", indice("db/esquemas.md"));

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(salida(r)).toContain("db/esquemas.md");
    expect(salida(r)).toContain("NO-EXISTE.md");
  });

  it("CA-153: la disciplina de documentación atómica la aplica el arquitecto en spec", () => {
    const root = makeProject(DISC);

    const r = cli(["disciplines", "list", "--json"], { cwd: root, env: env() });

    const filas = JSON.parse(r.stdout) as { id: string; rol?: string; fases: string[] }[];
    const granular = filas.find((d) => d.id === "GRANULAR");
    expect(granular?.rol).toBe("arquitecto");
    expect(granular?.fases).toContain("spec");
  });
});
