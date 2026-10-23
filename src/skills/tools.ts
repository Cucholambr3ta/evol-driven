import { spawnSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, relative } from "node:path";
import type { Entry } from "./inventory.js";
import type { AuditFinding, ToolReport } from "./report.js";
import type { Ecosystem } from "./analyze.js";

/**
 * The external tools the audit leans on. If one that is required is missing or fails, the skill is
 * «no auditada»: an audit that could not run must never read as an approval. Tests point each tool
 * to a stub with EVOL_TOOL_<NAME> (an empty value means «not installed»).
 */
export type ToolName = "gitleaks" | "semgrep" | "npm" | "pip-audit" | "osv-scanner";

export const INSTALL_HINT: Record<ToolName, string> = {
  gitleaks: "gitleaks (https://github.com/gitleaks/gitleaks)",
  semgrep: "semgrep (uv tool install semgrep)",
  npm: "npm (viene con Node.js)",
  "pip-audit": "pip-audit (uv tool install pip-audit)",
  "osv-scanner": "osv-scanner (https://google.github.io/osv-scanner)",
};

export function toolPath(name: ToolName): string | null {
  const override = process.env[`EVOL_TOOL_${name.toUpperCase().replaceAll("-", "_")}`];
  const candidates =
    override !== undefined
      ? override === ""
        ? []
        : [override]
      : (process.env["PATH"] ?? "").split(delimiter).map((d) => join(d, name));
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

const missing = (name: ToolName): ToolReport => ({
  estado: "falta",
  detalle: `${INSTALL_HINT[name]} no está instalado`,
});
const failed = (detalle: string, version?: string): ToolReport => ({
  estado: "fallo",
  detalle,
  ...(version ? { version } : {}),
});

function versionOf(bin: string, args: string[]): string | undefined {
  const r = spawnSync(bin, args, { encoding: "utf8", timeout: 20_000 });
  return r.status === 0 ? (r.stdout.trim().split("\n")[0] ?? undefined) : undefined;
}

export interface ToolRun {
  report: ToolReport;
  findings: AuditFinding[];
}

export function runGitleaks(dir: string): ToolRun {
  const bin = toolPath("gitleaks");
  if (!bin) return { report: missing("gitleaks"), findings: [] };
  const version = versionOf(bin, ["version"]);
  const work = mkdtempSync(join(tmpdir(), "evol-gitleaks-"));
  try {
    const file = join(work, "report.json");
    const r = spawnSync(
      bin,
      [
        "detect",
        "--no-git",
        "--source",
        dir,
        "--report-format",
        "json",
        "--report-path",
        file,
        "--no-banner",
        "--exit-code",
        "2",
      ],
      { encoding: "utf8", timeout: 120_000 },
    );
    if (r.error || (r.status !== 0 && r.status !== 2))
      return {
        report: failed(r.error?.message ?? `terminó con el código ${r.status}`, version),
        findings: [],
      };
    let leaks: { RuleID?: string; File?: string; StartLine?: number }[] = [];
    try {
      const raw = readFileSync(file, "utf8").trim();
      leaks = raw === "" ? [] : (JSON.parse(raw) as typeof leaks);
    } catch {
      if (r.status === 2)
        return { report: failed("no se pudo leer su informe", version), findings: [] };
    }
    // never print the secret itself: only the rule, the file and the line
    const findings: AuditFinding[] = leaks.map((l) => ({
      regla: "gitleaks",
      nivel: "bloqueo",
      texto: `gitleaks encontró un secreto (${l.RuleID ?? "regla desconocida"})${l.StartLine ? ` en la línea ${l.StartLine}` : ""}.`,
      archivo: relative(dir, l.File ?? "") || (l.File ?? ""),
    }));
    return { report: { estado: "ok", ...(version ? { version } : {}) }, findings };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export function runSemgrep(dir: string): ToolRun {
  const bin = toolPath("semgrep");
  if (!bin) return { report: missing("semgrep"), findings: [] };
  const version = versionOf(bin, ["--version"]);
  const r = spawnSync(
    bin,
    [
      "scan",
      "--config",
      "auto",
      "--json",
      "--quiet",
      "--metrics",
      "off",
      "--disable-version-check",
      dir,
    ],
    { encoding: "utf8", timeout: 300_000, maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.error) return { report: failed(r.error.message, version), findings: [] };
  let parsed: {
    results?: {
      check_id?: string;
      path?: string;
      start?: { line?: number };
      extra?: { severity?: string; message?: string };
    }[];
  };
  try {
    parsed = JSON.parse(r.stdout) as typeof parsed;
  } catch {
    return {
      report: failed(
        `no devolvió un informe legible (código ${r.status}); semgrep necesita red para bajar sus reglas`,
        version,
      ),
      findings: [],
    };
  }
  const findings: AuditFinding[] = [];
  for (const hit of parsed.results ?? []) {
    const severity = (hit.extra?.severity ?? "").toUpperCase();
    if (severity === "INFO") continue;
    findings.push({
      regla: "semgrep",
      nivel: severity === "ERROR" ? "bloqueo" : "aviso",
      texto: `semgrep (${hit.check_id ?? "regla"}): ${(hit.extra?.message ?? "").split("\n")[0]?.slice(0, 160) ?? ""}`,
      archivo: relative(dir, hit.path ?? "") || (hit.path ?? ""),
    });
  }
  return { report: { estado: "ok", ...(version ? { version } : {}) }, findings };
}

const NODE_AUDITABLE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json)$/;

/** Vulnerability scan of the dependencies the skill declares. Needs the network (the advisory databases). */
export function runDependencyAudit(
  dir: string,
  entries: Entry[],
  ecosystems: Set<Ecosystem>,
): { reports: Record<string, ToolReport>; findings: AuditFinding[] } {
  const reports: Record<string, ToolReport> = {};
  const findings: AuditFinding[] = [];
  const dirOf = (p: string): string => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

  if (ecosystems.has("node")) {
    const locks = entries.filter((e) => NODE_AUDITABLE.test(e.ruta));
    const bin = toolPath("npm");
    if (locks.length === 0)
      reports["npm"] = {
        estado: "fallo",
        detalle: "las dependencias de Node no usan package-lock.json y no hay forma de auditarlas",
      };
    else if (!bin) reports["npm"] = missing("npm");
    else {
      reports["npm"] = {
        estado: "ok",
        ...(versionOf(bin, ["--version"])
          ? { version: versionOf(bin, ["--version"]) as string }
          : {}),
      };
      for (const lock of locks) {
        const r = spawnSync(bin, ["audit", "--json", "--package-lock-only"], {
          cwd: join(dir, dirOf(lock.ruta)),
          encoding: "utf8",
          timeout: 120_000,
        });
        try {
          const out = JSON.parse(r.stdout) as {
            vulnerabilities?: Record<string, { severity?: string }>;
            error?: unknown;
          };
          if (out.error) throw new Error("npm audit falló");
          for (const [pkg, v] of Object.entries(out.vulnerabilities ?? {})) {
            const high = v.severity === "high" || v.severity === "critical";
            findings.push({
              regla: "vulnerabilidades",
              nivel: high ? "bloqueo" : "aviso",
              texto: `«${pkg}» tiene una vulnerabilidad ${v.severity ?? "conocida"}.`,
              archivo: lock.ruta,
            });
          }
        } catch {
          reports["npm"] = failed(
            "npm audit no devolvió un informe legible (¿sin red?)",
            reports["npm"]?.version,
          );
        }
      }
    }
  }

  if (ecosystems.has("python")) {
    const reqs = entries.filter((e) => /(^|\/)requirements[\w.-]*\.txt$/.test(e.ruta));
    const bin = toolPath("pip-audit");
    if (reqs.length === 0)
      reports["pip-audit"] = { estado: "no-aplica", detalle: "sin requirements.txt" };
    else if (!bin) reports["pip-audit"] = missing("pip-audit");
    else {
      reports["pip-audit"] = {
        estado: "ok",
        ...(versionOf(bin, ["--version"])
          ? { version: versionOf(bin, ["--version"]) as string }
          : {}),
      };
      for (const req of reqs) {
        const r = spawnSync(
          bin,
          ["-r", join(dir, req.ruta), "--no-deps", "--disable-pip", "-f", "json"],
          { encoding: "utf8", timeout: 180_000 },
        );
        try {
          const out = JSON.parse(r.stdout) as {
            dependencies?: { name?: string; vulns?: unknown[] }[];
          };
          for (const dep of out.dependencies ?? []) {
            if ((dep.vulns ?? []).length > 0)
              findings.push({
                regla: "vulnerabilidades",
                nivel: "bloqueo",
                texto: `«${dep.name ?? "paquete"}» tiene ${(dep.vulns ?? []).length} vulnerabilidad(es) conocida(s).`,
                archivo: req.ruta,
              });
          }
        } catch {
          reports["pip-audit"] = failed(
            "pip-audit no devolvió un informe legible (¿sin red?)",
            reports["pip-audit"]?.version,
          );
        }
      }
    }
  }
  return { reports, findings };
}
