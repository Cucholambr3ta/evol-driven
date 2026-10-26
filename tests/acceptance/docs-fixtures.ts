import { isolateUserConfig, write } from "../helpers.js";
import type { CliResult } from "../helpers.js";

export const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];

/** A past date, so no check can reject it as a future one whatever the time zone. */
export const FECHA = "2026-10-20";

export const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: isolateUserConfig() });

/** The whole output of a command, to look for names in it. */
export const salida = (r: CliResult): string => r.stdout + r.stderr;

/** A command that is not there yet must not pass for the wrong reason: it has to exist and answer. */
export const existe = (r: CliResult): boolean => !/desconocid/i.test(salida(r));

/** The line of the output that names `nombre`, to check what it says about that one item. */
export const lineaDe = (r: CliResult, nombre: string): string =>
  salida(r)
    .split("\n")
    .find((l) => l.includes(nombre)) ?? "";

/** The spec the `Origen:` of a domain document points at, so the origin is a file that exists. */
export function conSpec(root: string): void {
  write(
    root,
    "docs/specs/SPEC.md",
    "# Spec\n\n## Criterios de aceptación\n\n1. **CA-150**: algo\n",
  );
}

/** A domain document with enough content to clear the minimum, with its origin line. */
export function doc(titulo: string, origen = "Origen: docs/specs/SPEC.md"): string {
  const cuerpo = Array.from({ length: 20 }, (_, i) => `Línea ${i + 1} del subdominio ${titulo}.`);
  return `# ${titulo}\n\n${origen}\n\n${cuerpo.join("\n")}\n`;
}

/** `docs/proyecto/INDEX.md` linking each relative path. */
export function indice(...rutas: string[]): string {
  return `# Índice\n\n${rutas.map((r) => `- [${r}](${r})`).join("\n")}\n`;
}

/** A research evidence index with the given rows: `[id, fuente, fecha, clasificación]`. */
export function indiceEvidencia(filas: [string, string, string, string][]): string {
  const cabecera =
    "| ID | Fuente | Consultada | Clasificación | Afirma |\n| --- | --- | --- | --- | --- |";
  const cuerpo = filas.map(([id, f, d, c]) => `| ${id} | ${f} | ${d} | ${c} | algo concreto |`);
  return `# Índice de evidencia\n\n${[cabecera, ...cuerpo].join("\n")}\n`;
}
