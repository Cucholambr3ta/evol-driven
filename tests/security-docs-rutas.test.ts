import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { comprobarDocs } from "../src/docs/check.js";
import { tempDir, write } from "./helpers.js";

const SECRETO = "contenido-fuera-de-la-raiz-9f3a";
const linea = (n: number): string => `Línea ${n} del subdominio.`;
const cuerpo = Array.from({ length: 16 }, (_, i) => linea(i)).join("\n");

/** A module root inside a parent that holds a document the checkers must never reach. */
function conFuera(): { raiz: string; fuera: string } {
  const padre = tempDir();
  const raiz = join(padre, "mod");
  mkdirSync(raiz);
  write(padre, "fuera/secreto.md", `# ${SECRETO}\n\nOrigen: ${SECRETO}\n`);
  return { raiz, fuera: join(padre, "fuera") };
}
const todo = (raiz: string): string =>
  JSON.stringify(comprobarDocs(raiz).hallazgos.map((h) => `${h.archivo}|${h.mensaje}`));

describe("los comprobadores de documentación no leen fuera de la raíz del módulo (CA-150, CA-157, CA-167)", () => {
  it.each(["../fuera/secreto.md", "/etc/passwd", "file:///etc/passwd", "..%2Ffuera%2Fsecreto.md"])(
    "un Origen o un enlace a «%s» se rechaza sin leerlo",
    (destino) => {
      const { raiz } = conFuera();
      write(raiz, "docs/specs/SPEC.md", "# Spec\n");
      write(raiz, "docs/proyecto/d/uno.md", `# Uno\n\nOrigen: ${destino}\n\n${cuerpo}\n`);
      write(raiz, "docs/proyecto/INDEX.md", `# Índice\n\n- [uno](d/uno.md)\n- [x](${destino})\n`);

      const salida = todo(raiz);

      expect(salida).not.toContain(SECRETO);
      expect(salida).not.toContain("root:");
    },
  );

  it("una carpeta de dominio que es un enlace simbólico hacia fuera no se recorre", () => {
    const { raiz, fuera } = conFuera();
    write(raiz, "docs/specs/SPEC.md", "# Spec\n");
    write(raiz, "docs/proyecto/INDEX.md", "# Índice\n");
    symlinkSync(fuera, join(raiz, "docs/proyecto/dominio"));

    const r = comprobarDocs(raiz);

    expect(JSON.stringify(r)).not.toContain(SECRETO);
    expect(r.hallazgos.length).toBeGreaterThan(0);
  });

  it("un tema de investigación que es un enlace simbólico hacia fuera no se recorre", () => {
    const { raiz, fuera } = conFuera();
    mkdirSync(join(raiz, "investigacion"));
    symlinkSync(fuera, join(raiz, "investigacion/tema"));

    const salida = todo(raiz);

    expect(salida).not.toContain(SECRETO);
  });

  it("una historia que es un enlace simbólico hacia fuera no se lee", () => {
    const { raiz, fuera } = conFuera();
    write(
      raiz,
      "docs/sprints/INDEX.json",
      JSON.stringify({ sprints: [{ id: "01", titulo: "x", historias: ["HU-1"] }] }),
    );
    mkdirSync(join(raiz, "docs/historias"), { recursive: true });
    symlinkSync(fuera, join(raiz, "docs/historias/HU-1"));

    expect(todo(raiz)).not.toContain(SECRETO);
  });

  it("un archivo de requisitos que es un enlace simbólico hacia fuera no se lee", () => {
    const { raiz, fuera } = conFuera();
    mkdirSync(join(raiz, "docs/requisitos"), { recursive: true });
    symlinkSync(join(fuera, "secreto.md"), join(raiz, "docs/requisitos/NO_FUNCIONALES.md"));

    expect(todo(raiz)).not.toContain(SECRETO);
  });
});
