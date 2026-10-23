export type Veredicto = "pass" | "warn" | "block" | "no-auditada";

export interface AuditFinding {
  regla: string;
  nivel: "aviso" | "bloqueo";
  texto: string;
  archivo?: string;
}

export type ToolState = "ok" | "falta" | "fallo" | "no-aplica";

export interface ToolReport {
  estado: ToolState;
  version?: string;
  detalle?: string;
}

export interface Capacidades {
  red: string[];
  escribe: string[];
  comandos: string[];
  entorno: string[];
}

export interface CapacidadesReport {
  /** Who wrote the declaration that was used. */
  fuente: "autor" | "persona" | null;
  declaradas: Record<string, Capacidades> | null;
  /** What the static analysis found each script doing. */
  inferidas: Record<string, Capacidades>;
  /** A declaration evol proposes from what it found, for a person to confirm. */
  propuesta: Record<string, Capacidades> | null;
}

export interface AuditReport {
  version: 1;
  fecha: string;
  evol: string;
  skill: string;
  huella: string;
  origen: { tipo: "carpeta" | "zip" | "remoto"; ref: string; sha?: string; propia: boolean };
  veredicto: Veredicto;
  hallazgos: AuditFinding[];
  herramientas: Record<string, ToolReport>;
  inventario: { archivos: number; bytes: number; scripts: string[] };
  capacidades: CapacidadesReport;
  /** Pass 1 (rules) is this report; pass 2 (the isolated sub-process) comes with `approve`. */
  pasadas: { reglas: "hecha"; subproceso: "pendiente" };
}

export const VEREDICTO_LABEL: Record<Veredicto, string> = {
  pass: "PASS",
  warn: "WARN",
  block: "BLOCK",
  "no-auditada": "NO AUDITADA",
};

export function verdictOf(findings: AuditFinding[], incomplete: boolean): Veredicto {
  if (findings.some((f) => f.nivel === "bloqueo")) return "block";
  if (incomplete) return "no-auditada";
  return findings.some((f) => f.nivel === "aviso") ? "warn" : "pass";
}
