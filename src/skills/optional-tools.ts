import {
  projectFiles,
  runBandit,
  runGuarddog,
  runOsvScanner,
  runShellcheck,
} from "../security/runners.js";
import type { RunResult, SecFinding } from "../security/model.js";
import type { AuditFinding, ToolReport } from "./report.js";
import { INSTALL_HINT } from "./tools.js";
import type { ToolName } from "./tools.js";

/**
 * Folders that are never part of what a skill is. A skill hiding a script in a folder called «build»
 * must still be read, so unlike a project scan only these two are left out.
 */
const SKIP = new Set([".git", "node_modules"]);

const WHAT: Record<string, string> = {
  shellcheck: "los scripts de shell",
  bandit: "los scripts de Python",
  "osv-scanner": "las dependencias",
  guarddog: "los paquetes sospechosos",
};

function toFinding(f: SecFinding): AuditFinding | null {
  const where = f.linea ? ` (línea ${f.linea})` : "";
  switch (f.herramienta) {
    case "shellcheck":
    case "bandit":
      // the rules of pass 1 already block what is dangerous; a linter only adds warnings,
      // and its low-severity notes would drown them
      if (f.severidad === "LOW") return null;
      return {
        regla: f.herramienta,
        nivel: "aviso",
        texto: `${f.herramienta} ${f.regla}${where}: ${f.mensaje}; revisa el script.`,
        archivo: f.archivo,
      };
    case "osv-scanner":
      return {
        regla: "vulnerabilidades",
        nivel: f.severidad === "CRITICAL" || f.severidad === "HIGH" ? "bloqueo" : "aviso",
        texto: `${f.mensaje} (${f.regla}, ${f.severidad}).`,
        archivo: f.archivo,
      };
    case "guarddog":
      // its rules are heuristics: a hit asks for a look, it does not condemn the package
      return {
        regla: "paquete-sospechoso",
        nivel: "aviso",
        texto: `guarddog marcó ${f.mensaje}: puede ser un paquete malicioso o un falso positivo; revísalo.`,
        archivo: f.archivo,
      };
    default:
      return null;
  }
}

/**
 * The recommended tools of pass 1. They are optional: when one is missing or fails, the audit
 * warns about it and carries on, and the skill is never left «no auditada» because of them (that
 * is only for gitleaks and semgrep). A tool is only asked for when the skill has something it reads.
 */
export function runOptionalTools(dir: string): {
  reports: Record<string, ToolReport>;
  findings: AuditFinding[];
} {
  const files = projectFiles(dir, "", SKIP);
  const runs: RunResult[] = [
    runShellcheck(dir, files),
    runBandit(dir, files),
    runOsvScanner(dir, files),
    runGuarddog(dir, files),
  ];
  const reports: Record<string, ToolReport> = {};
  const findings: AuditFinding[] = [];
  for (const { outcome, findings: found } of runs) {
    const name = outcome.herramienta;
    reports[name] = {
      estado: outcome.estado,
      ...(outcome.version ? { version: outcome.version } : {}),
      ...(outcome.detalle ? { detalle: outcome.detalle } : {}),
    };
    if (outcome.estado === "falta" || outcome.estado === "fallo")
      findings.push({
        regla: "herramientas-opcionales",
        nivel: "aviso",
        texto:
          outcome.estado === "falta"
            ? `${INSTALL_HINT[name as ToolName]} no está instalada (es opcional): no se analizaron ${WHAT[name] ?? "los archivos"}.`
            : `${name} falló (${outcome.detalle ?? "sin detalle"}); es opcional, pero no se analizaron ${WHAT[name] ?? "los archivos"}.`,
      });
    for (const f of found) {
      const a = toFinding(f);
      if (a) findings.push(a);
    }
  }
  return { reports, findings };
}
