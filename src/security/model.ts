export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export const SEVERITIES: readonly Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export type Area = "secretos" | "codigo" | "dependencias";
export const AREAS: readonly Area[] = ["secretos", "codigo", "dependencias"];

/**
 * One result in the common format. `mensaje` is built only from fields the tool controls (a rule
 * name, a package and its advisory title), never from text taken out of the analysed code: a
 * secret must not travel through the report.
 */
export interface SecFinding {
  herramienta: string;
  area: Area;
  regla: string;
  severidad: Severity;
  archivo: string;
  linea?: number;
  mensaje: string;
}

export type ToolState = "ok" | "falta" | "fallo" | "no-aplica";

export interface ToolOutcome {
  herramienta: string;
  area: Area;
  estado: ToolState;
  /** A tool that must have run for the scan to count: with `--ci` it fails if it did not. */
  obligatoria: boolean;
  /** The tool needs the network (advisory databases, package registries). */
  red: boolean;
  version?: string;
  detalle?: string;
}

export interface RunResult {
  outcome: ToolOutcome;
  findings: SecFinding[];
}

export const rank = (s: Severity): number => SEVERITIES.length - SEVERITIES.indexOf(s);

export function location(f: Pick<SecFinding, "archivo" | "linea">): string {
  return f.linea ? `${f.archivo}:${f.linea}` : f.archivo;
}
