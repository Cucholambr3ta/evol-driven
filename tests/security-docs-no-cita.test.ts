import { describe, expect, it } from "vitest";
import { comprobarDocs } from "../src/docs/check.js";
import { LARGO_NOMBRE } from "../src/docs/lectura.js";
import { tempDir, write } from "./helpers.js";

const CLAVE = "AKIAEJEMPLOFALSO1234";
const ESC = String.fromCharCode(27);
const salida = (root: string): string =>
  comprobarDocs(root)
    .hallazgos.map((h) => `${h.archivo}|${h.mensaje}`)
    .join("\n");

describe("los mensajes de los comprobadores no citan el contenido de los documentos (CA-152, CA-158, CA-162)", () => {
  it("lo que hay en celdas, identificadores y términos defectuosos no aparece en el mensaje", () => {
    const root = tempDir();
    write(
      root,
      "docs/requisitos/NO_FUNCIONALES.md",
      `| ID | Requisito | Métrica | Umbral | Validación |\n| - | - | - | - | - |\n| ${CLAVE} | a | | | |\n`,
    );
    write(
      root,
      "investigacion/t/t-evidence-index.md",
      `| ID | Fuente | Consultada | Clasificación | Afirma |\n| - | - | - | - | - |\n| ${CLAVE} | ${CLAVE} | ${CLAVE} | ${CLAVE} | x |\n`,
    );
    write(root, "investigacion/t/audit.md", `Dice algo [E-9999999] y [E-1].\n`);

    expect(salida(root)).not.toContain(CLAVE);
  });

  it("un nombre de archivo con escapes de terminal o saltos de línea sale limpio y acotado", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "# Spec\n");
    write(root, "docs/proyecto/INDEX.md", "# Índice\n");
    const nombre = `${ESC}[31mroto\nlinea${"x".repeat(200)}.md`;
    write(root, `docs/proyecto/d/${nombre}`, "# Doc\n");

    const s = salida(root);

    expect(s).not.toContain(ESC);
    expect(s.split("\n").every((l) => [...l].length < LARGO_NOMBRE + 200)).toBe(true);
    expect(s.length).toBeGreaterThan(0);
  });

  it("el índice de evidencia no se cita al fallar su lectura", () => {
    const root = tempDir();
    write(root, "investigacion/t/t-evidence-index.md", `${CLAVE}\n`);
    write(root, "investigacion/t/otro-evidence-index.md", `${CLAVE}\n`);

    expect(salida(root)).not.toContain(CLAVE);
  });

  it("ningún mensaje usa la palabra «desconocido»", () => {
    const root = tempDir();
    write(root, "docs/requisitos/RESTRICCIONES.md", "## Limitaciones conocidas\n\n### L1\n\nx\n");
    write(root, "investigacion/t/x.md", "[E-1]\n");

    expect(salida(root)).not.toMatch(/desconocid/i);
  });
});
