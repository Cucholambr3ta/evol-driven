import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import {
  accessSync,
  constants,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join, relative, resolve } from "node:path";
import { packageRoot } from "../core/paths.js";
import type { Entry } from "./inventory.js";
import type { AuditFinding, ToolReport } from "./report.js";
import type { Ecosystem } from "./analyze.js";

/**
 * The external tools the audit leans on. If one that is required is missing or fails, the skill is
 * «no auditada»: an audit that could not run must never read as an approval. Tests point each tool
 * to a stub with EVOL_TOOL_<NAME> (an empty value means «not installed»).
 */
export type ToolName =
  | "gitleaks"
  | "semgrep"
  | "npm"
  | "pip-audit"
  | "osv-scanner"
  | "bandit"
  | "shellcheck"
  | "guarddog"
  | "trivy"
  | "checkov"
  | "syft"
  | "reuse"
  | "schemathesis"
  | "zaproxy"
  | "testssl";

export const INSTALL_HINT: Record<ToolName, string> = {
  gitleaks: "gitleaks (https://github.com/gitleaks/gitleaks)",
  semgrep: "semgrep (uv tool install semgrep)",
  npm: "npm (viene con Node.js)",
  "pip-audit": "pip-audit (uv tool install pip-audit)",
  "osv-scanner": "osv-scanner (https://google.github.io/osv-scanner)",
  bandit: "bandit (uv tool install bandit)",
  shellcheck: "shellcheck (https://www.shellcheck.net)",
  guarddog: "guarddog (uv tool install guarddog)",
  trivy: "trivy (pacman -S trivy)",
  checkov: "checkov (uv tool install checkov)",
  syft: "syft (pacman -S syft)",
  reuse: "reuse (pacman -S reuse)",
  schemathesis: "schemathesis (uv tool install schemathesis)",
  zaproxy: "zaproxy (pacman -S zaproxy)",
  testssl: "testssl.sh (pacman -S testssl.sh)",
};

/**
 * Where a tool really lives when it is not `<name>` on the PATH. Arch's `/usr/bin/zaproxy` is a
 * wrapper that drops its arguments (it opens the desktop application), so ZAP is run through
 * `zap.sh`, which does take them.
 */
const LOCATIONS: Partial<Record<ToolName, string[]>> = {
  testssl: ["testssl", "testssl.sh"],
  zaproxy: ["/usr/share/zaproxy/zap.sh", "/usr/share/webapps/zaproxy/zap.sh", "zap.sh"],
};

export function toolPath(name: ToolName): string | null {
  const override = process.env[`EVOL_TOOL_${name.toUpperCase().replaceAll("-", "_")}`];
  const candidates =
    override !== undefined
      ? override === ""
        ? []
        : [override]
      : (LOCATIONS[name] ?? [name]).flatMap((n) =>
          isAbsolute(n) ? [n] : (process.env["PATH"] ?? "").split(delimiter).map((d) => join(d, n)),
        );
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

export const missing = (name: ToolName): ToolReport => ({
  estado: "falta",
  detalle: `${INSTALL_HINT[name]} no está instalado`,
});
export const failed = (detalle: string, version?: string): ToolReport => ({
  estado: "fallo",
  detalle,
  ...(version ? { version } : {}),
});

export function versionOf(bin: string, args: string[]): string | undefined {
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
    // The skill must not choose what is ignored: its own .gitleaks.toml, .gitleaksignore and
    // «gitleaks:allow» comments would let it hide a secret from the audit.
    const config = join(work, "gitleaks.toml");
    writeFileSync(config, "[extend]\nuseDefault = true\n");
    const noIgnores = join(work, "sin-ignorados");
    mkdirSync(noIgnores);
    const r = spawnSync(
      bin,
      [
        "dir",
        dir,
        "--config",
        config,
        "--gitleaks-ignore-path",
        noIgnores,
        "--ignore-gitleaks-allow",
        "--redact",
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
      archivo: isAbsolute(l.File ?? "") ? relative(dir, l.File ?? "") : (l.File ?? ""),
    }));
    return { report: { estado: "ok", ...(version ? { version } : {}) }, findings };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Languages the local rules cover: every file of these that semgrep does not report as scanned is a gap. */
const SEMGREP_FILES = /\.(py|js|jsx|mjs|cjs|ts|tsx|mts|cts)$/i;

/** evol's own rules: semgrep runs with exactly these, offline, instead of the registry's («--config auto» needs the network and sends data). */
export function semgrepRulesDir(): string {
  return join(packageRoot(), "rules", "semgrep");
}

function filesUnder(dir: string, base = ""): string[] {
  return readdirSync(join(dir, base)).flatMap((name) => {
    const rel = base ? `${base}/${name}` : name;
    return statSync(join(dir, rel)).isDirectory() ? filesUnder(dir, rel) : [rel];
  });
}

/**
 * Static analysis of the scripts with evol's local rules. Two traps are closed on purpose:
 * semgrep skips folders such as `tests/` unless the scanned folder carries its own `.semgrepignore`
 * (so it scans a temporary copy with an empty one, and the audited copy stays untouched), and it
 * reports which files it really read, so any script it did not read is a failure, not a pass.
 * EVOL_SEMGREP_CONFIG adds more rule sets (for example `p/security-audit`), at the price of the network.
 */
export function runSemgrep(dir: string): ToolRun {
  const bin = toolPath("semgrep");
  if (!bin) return { report: missing("semgrep"), findings: [] };
  const version = versionOf(bin, ["--version"]);
  const work = mkdtempSync(join(tmpdir(), "evol-semgrep-"));
  try {
    const scan = join(work, "skill");
    cpSync(dir, scan, { recursive: true, verbatimSymlinks: true });
    writeFileSync(join(scan, ".semgrepignore"), "");
    const extra = (process.env["EVOL_SEMGREP_CONFIG"] ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c !== "");
    const configs = [semgrepRulesDir(), ...extra].flatMap((c) => ["--config", c]);
    type Semgrep = {
      results?: {
        check_id?: string;
        path?: string;
        start?: { line?: number };
        extra?: { severity?: string; message?: string };
      }[];
      errors?: { level?: string; message?: string; path?: string }[];
      paths?: { scanned?: string[] };
    };
    const once = (): { r: SpawnSyncReturns<string>; parsed: Semgrep | null } => {
      const r = spawnSync(
        bin,
        [
          "scan",
          ...configs,
          "--json",
          "--quiet",
          "--metrics",
          "off",
          "--disable-version-check",
          scan,
        ],
        {
          encoding: "utf8",
          timeout: 300_000,
          maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, SEMGREP_SEND_METRICS: "off", SEMGREP_ENABLE_VERSION_CHECK: "0" },
        },
      );
      try {
        return { r, parsed: JSON.parse(r.stdout) as Semgrep };
      } catch {
        return { r, parsed: null };
      }
    };
    const failing = (parsed: Semgrep | null): boolean =>
      (parsed?.errors ?? []).some((e) => e.level === "error" || e.level === undefined);
    let { r, parsed } = once();
    // The engine sometimes fails on its own, with an error that names no file («Error while
    // matching…»), and does not on the next run. One retry is safe: only a clean second run
    // counts, and a second failure leaves the skill «no auditada».
    if (
      !r.error &&
      parsed !== null &&
      failing(parsed) &&
      (parsed.errors ?? []).every((e) => !e.path)
    )
      ({ r, parsed } = once());
    if (r.error) return { report: failed(r.error.message, version), findings: [] };
    if (parsed === null) {
      return {
        report: failed(
          `no devolvió un informe legible (código ${r.status}): ${r.stderr.trim().split("\n")[0] ?? ""}`,
          version,
        ),
        findings: [],
      };
    }
    const broken = (parsed.errors ?? []).filter(
      (e) => e.level === "error" || e.level === undefined,
    );
    if (broken.length > 0) {
      return {
        report: failed(
          `semgrep no pudo analizar ${broken
            .map(
              (e) =>
                (e.path ? relative(scan, resolve(e.path)) : (e.message ?? "una regla")).split(
                  "\n",
                )[0],
            )
            .slice(0, 3)
            .join(", ")}`,
          version,
        ),
        findings: [],
      };
    }
    const scanned = new Set((parsed.paths?.scanned ?? []).map((p) => relative(scan, resolve(p))));
    const unread = filesUnder(scan).filter((f) => SEMGREP_FILES.test(f) && !scanned.has(f));
    if (unread.length > 0) {
      return {
        report: failed(
          `semgrep no revisó ${unread.length} script(s): ${unread.slice(0, 3).join(", ")}`,
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
        texto: `semgrep (${(hit.check_id ?? "regla").replace(/^.*\./, "")}): ${(hit.extra?.message ?? "").split("\n")[0]?.slice(0, 160) ?? ""}`,
        archivo: relative(scan, resolve(hit.path ?? "")) || (hit.path ?? ""),
      });
    }
    return { report: { estado: "ok", ...(version ? { version } : {}) }, findings };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
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
