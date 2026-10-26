import { describe, expect, it } from "vitest";
import { cli, makeProjectAt, write, writeValidArtifacts } from "../helpers.js";
import { env, lineaDe, salida } from "./docs-fixtures.js";

/** An ADR with every section, minus the ones named. */
function adr(titulo: string, sinSeccion: string[] = []): string {
  const secciones: [string, string][] = [
    ["Contexto", "Qué fuerzas empujan."],
    ["Opciones", "A (pros y contras) y B (pros y contras)."],
    ["Decisión", "A."],
    ["Consecuencias", "Lo bueno, lo malo y las mitigaciones."],
    ["Referencias", "src/core/gate.ts y tests/gate.test.ts."],
  ];
  const cuerpo = secciones
    .filter(([nombre]) => !sinSeccion.includes(nombre))
    .map(([nombre, texto]) => `## ${nombre}\n\n${texto}\n`);
  return `# ${titulo}\n\nEstado: aceptada\n\n${cuerpo.join("\n")}`;
}

function proyecto(): string {
  const root = makeProjectAt("spec", ["SDD", "ADD"]);
  writeValidArtifacts(root, "SDD");
  return root;
}

describe("decisiones de arquitectura con sus referencias", () => {
  it("CA-165: un ADR sin la sección de referencias se avisa", () => {
    const root = proyecto();
    write(root, "docs/adr/0001-uno.md", adr("ADR 1", ["Referencias"]));

    const r = cli(["verify"], { cwd: root, env: env() });

    expect(r.stdout).toMatch(/^WARN/m);
    const linea = lineaDe(r, "0001-uno.md");
    expect(linea).toContain("Referencias");
    expect(linea).toMatch(/implementaci[oó]n/);
    expect(linea).toMatch(/pruebas/);
  });

  it("CA-166: un ADR sin opciones o sin consecuencias se avisa", () => {
    const root = proyecto();
    write(root, "docs/adr/0002-dos.md", adr("ADR 2", ["Opciones"]));
    write(root, "docs/adr/0003-tres.md", adr("ADR 3", ["Consecuencias"]));
    write(root, "docs/adr/0004-cuatro.md", adr("ADR 4"));

    const r = cli(["verify"], { cwd: root, env: env() });

    expect(r.stdout).toMatch(/^WARN/m);
    expect(lineaDe(r, "0002-dos.md")).toContain("Opciones");
    expect(lineaDe(r, "0002-dos.md")).not.toContain("Consecuencias");
    expect(lineaDe(r, "0003-tres.md")).toContain("Consecuencias");
    expect(lineaDe(r, "0003-tres.md")).not.toContain("Opciones");
    expect(salida(r)).not.toContain("0004-cuatro.md");
  });
});
