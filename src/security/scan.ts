import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { evolPath } from "../core/paths.js";
import { isIgnored, reviewIgnores } from "./ignore.js";
import type { IgnoreEntry } from "./ignore.js";
import { ACTIVE_AREAS, AREAS, DEFAULT_AREAS, SEVERITIES, location, rank } from "./model.js";
import type { Area, RunResult, SecFinding, Severity, ToolOutcome } from "./model.js";
import { runSchemathesis, runTestssl, runZapPassive } from "./runners-active.js";
import type { Target } from "./runners-active.js";
import { runCheckov, runReuse, runSyft, runTrivy } from "./runners-infra.js";
import {
  projectFiles,
  runBandit,
  runGitleaks,
  runGuarddog,
  runOsvScanner,
  runSemgrep,
  runShellcheck,
} from "./runners.js";

export interface IgnoredFinding extends SecFinding {
  ignorado: Pick<IgnoreEntry, "motivo" | "responsable" | "caduca">;
}

export interface ScanResult {
  fecha: string;
  areas: Area[];
  herramientas: ToolOutcome[];
  /** Findings still open (not ignored), most severe first. */
  abiertos: SecFinding[];
  ignorados: IgnoredFinding[];
  /** Rejected or expired ignores, and anything else worth telling the person. */
  avisos: string[];
}

const RUNNERS: Record<Area, ((root: string, files: string[]) => RunResult)[]> = {
  secretos: [(root) => runGitleaks(root)],
  codigo: [(root) => runSemgrep(root), runBandit, runShellcheck],
  dependencias: [runOsvScanner, runGuarddog],
  contenedores: [runTrivy, runCheckov],
  licencias: [runSyft, runReuse],
  api: [],
  tls: [],
};

/** The areas that send traffic: they get the targets the project declared, never anything else. */
const ACTIVE_RUNNERS: Partial<Record<Area, ((root: string, targets: Target[]) => RunResult)[]>> = {
  api: [runSchemathesis, runZapPassive],
  tls: [runTestssl],
};

export interface ScanOptions {
  /** The targets the project declares as its own (`security.objetivos`). */
  objetivos?: Target[];
  /** A person confirmed the active areas in a terminal. Without it they do not run. */
  confirmadas?: boolean;
}

const notRun = (tool: string, area: Area, detalle: string): RunResult => ({
  outcome: {
    herramienta: tool,
    area,
    estado: "no-aplica",
    obligatoria: false,
    red: false,
    detalle,
  },
  findings: [],
});

export function scan(
  root: string,
  areas: readonly Area[] = DEFAULT_AREAS,
  now = new Date(),
  options: ScanOptions = {},
): ScanResult {
  const chosen = AREAS.filter((a) => areas.includes(a));
  const files = projectFiles(root);
  const runs = chosen.flatMap((area) => {
    if (!ACTIVE_AREAS.includes(area)) return RUNNERS[area].map((run) => run(root, files));
    // an area that sends traffic never runs on its own: declared targets and a person's yes
    if (options.confirmadas !== true)
      return [
        notRun(
          area,
          area,
          "no se confirmó: envía tráfico y lo confirma una persona en una terminal",
        ),
      ];
    const targets = options.objetivos ?? [];
    if (targets.length === 0)
      return [
        notRun(
          area,
          area,
          "el proyecto no declara objetivos propios (security.objetivos en evol.config.json)",
        ),
      ];
    return (ACTIVE_RUNNERS[area] ?? []).map((run) => run(root, targets));
  });
  const review = reviewIgnores(root, now);

  const abiertos: SecFinding[] = [];
  const ignorados: IgnoredFinding[] = [];
  for (const finding of runs.flatMap((r) => r.findings)) {
    const entry = isIgnored(finding, review.vigentes);
    if (entry)
      ignorados.push({
        ...finding,
        ignorado: { motivo: entry.motivo, responsable: entry.responsable, caduca: entry.caduca },
      });
    else abiertos.push(finding);
  }
  const bySeverity = (a: SecFinding, b: SecFinding): number =>
    rank(b.severidad) - rank(a.severidad) || location(a).localeCompare(location(b));
  abiertos.sort(bySeverity);

  return {
    fecha: now.toISOString(),
    areas: chosen,
    herramientas: runs.map((r) => r.outcome),
    abiertos,
    ignorados,
    avisos: review.problemas,
  };
}

export function count(findings: SecFinding[]): Record<Severity, number> {
  const out: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) out[f.severidad]++;
  return out;
}

/** Why a CI run would fail: an open CRITICAL or HIGH, or a required tool that did not run. */
export function blockers(result: ScanResult): string[] {
  const reasons: string[] = [];
  const n = count(result.abiertos);
  if (n.CRITICAL > 0) reasons.push(`${n.CRITICAL} hallazgo(s) CRITICAL sin ignorar`);
  if (n.HIGH > 0) reasons.push(`${n.HIGH} hallazgo(s) HIGH sin ignorar`);
  for (const t of result.herramientas) {
    if (!t.obligatoria) continue;
    if (t.estado === "falta") reasons.push(`falta ${t.herramienta}, que es obligatoria`);
    if (t.estado === "fallo")
      reasons.push(
        `${t.herramienta} no pudo completar el escaneo${t.detalle ? ` (${t.detalle})` : ""}`,
      );
  }
  return reasons;
}

/* ---------------------------------- persistence ---------------------------------- */

const START = "<!-- evol:security-scan:inicio -->";
const END = "<!-- evol:security-scan:fin -->";
const LISTED = 50;

export function securityDir(root: string): string {
  return evolPath(root, "qa", "security");
}

export function qaReportPath(root: string): string {
  return evolPath(root, "qa", "QA_REPORT.md");
}

/**
 * The section of QA_REPORT.md that the scan owns. Only a CRITICAL carries the `- [ ] CRITICAL:`
 * checkbox that SecDD looks for; the rest are plain bullets so they never block by accident.
 */
export function reportSection(result: ScanResult): string {
  const n = count(result.abiertos);
  const lines = [
    START,
    "## Escaneo de seguridad",
    "",
    `Generado por \`evol security scan\` el ${result.fecha}. Esta sección se reescribe en cada escaneo; lo que escribas fuera de ella se conserva.`,
    "",
    `Abiertos: ${SEVERITIES.map((s) => `${n[s]} ${s}`).join(", ")}. Ignorados vigentes: ${result.ignorados.length}.`,
    "",
  ];
  const critical = result.abiertos.filter((f) => f.severidad === "CRITICAL");
  if (critical.length === 0) lines.push("Sin hallazgos críticos abiertos.");
  for (const f of critical)
    lines.push(`- [ ] CRITICAL: ${f.herramienta} ${f.regla} en ${location(f)}`);
  const others = result.abiertos.filter((f) => f.severidad !== "CRITICAL");
  if (others.length > 0) lines.push("", "Otros hallazgos abiertos:", "");
  for (const f of others.slice(0, LISTED))
    lines.push(`- ${f.severidad}: ${f.herramienta} ${f.regla} en ${location(f)}`);
  if (others.length > LISTED)
    lines.push(`- … y ${others.length - LISTED} más en .evol/qa/security/ultimo.json`);
  const gaps = result.herramientas.filter((t) => t.estado === "falta" || t.estado === "fallo");
  if (gaps.length > 0) {
    lines.push("", "Herramientas que no completaron el escaneo:", "");
    for (const t of gaps)
      lines.push(`- ${t.herramienta} (${t.estado})${t.detalle ? `: ${t.detalle}` : ""}`);
  }
  lines.push(END);
  return lines.join("\n");
}

/** Replaces the scan's section of QA_REPORT.md (creating the file or the section when needed). */
export function writeQaReport(root: string, result: ScanResult): string {
  const file = qaReportPath(root);
  const section = reportSection(result);
  let text = existsSync(file) ? readFileSync(file, "utf8") : "# Reporte de QA\n";
  const from = text.indexOf(START);
  const to = text.indexOf(END);
  text =
    from !== -1 && to > from
      ? `${text.slice(0, from)}${section}${text.slice(to + END.length)}`
      : `${text.replace(/\s*$/, "")}\n\n${section}\n`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
}

export function writeResult(root: string, result: ScanResult): string {
  const file = `${securityDir(root)}/ultimo.json`;
  mkdirSync(securityDir(root), { recursive: true });
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  return file;
}
