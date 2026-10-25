import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { evolPath, packageRoot } from "../core/paths.js";
import { INSTALL_HINT, toolPath } from "../skills/tools.js";
import type { ToolName } from "../skills/tools.js";
import { securityToolVersion } from "./tools.js";
import type { Area, RunResult, SecFinding, Severity, ToolOutcome } from "./model.js";

/** Folders that are never the project's own code: dependencies, build output and evol's own state. */
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".evol",
  ".venv",
  "venv",
  "__pycache__",
  ".tox",
  ".mypy_cache",
  "target",
]);

/** Every file of the project (relative, with «/»), minus the folders above. */
export function projectFiles(
  root: string,
  base = "",
  skip: ReadonlySet<string> = SKIP_DIRS,
): string[] {
  return readdirSync(join(root, base)).flatMap((name) => {
    const rel = base ? `${base}/${name}` : name;
    if (skip.has(name)) return [];
    const stat = statSync(join(root, rel));
    return stat.isDirectory() ? projectFiles(root, rel, skip) : stat.isFile() ? [rel] : [];
  });
}

export interface Spec {
  tool: ToolName;
  area: Area;
  obligatoria: boolean;
  red: boolean;
}

const outcomeOf = (
  s: Spec,
  estado: ToolOutcome["estado"],
  extra: Partial<ToolOutcome> = {},
): RunResult => ({
  outcome: {
    herramienta: s.tool,
    area: s.area,
    estado,
    obligatoria: s.obligatoria,
    red: s.red,
    ...extra,
  },
  findings: [],
});

export const missingRun = (s: Spec): RunResult =>
  outcomeOf(s, "falta", { detalle: `${INSTALL_HINT[s.tool]} no está instalado` });
export const notApplicable = (s: Spec, detalle: string): RunResult =>
  outcomeOf(s, "no-aplica", { detalle });
export const failedRun = (s: Spec, detalle: string, version?: string): RunResult =>
  outcomeOf(s, "fallo", { detalle, ...(version ? { version } : {}) });
export const done = (
  s: Spec,
  findings: SecFinding[],
  version?: string,
  detalle?: string,
): RunResult => ({
  ...outcomeOf(s, "ok", { ...(version ? { version } : {}), ...(detalle ? { detalle } : {}) }),
  findings,
});

export const rel = (root: string, path: string): string =>
  isAbsolute(path) ? relative(root, path) : path.replace(/^\.\//, "");

export function json<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const firstLine = (s: string): string => s.trim().split("\n")[0]?.slice(0, 160) ?? "";

/* ---------------------------------- secretos ---------------------------------- */

const GITLEAKS: Spec = { tool: "gitleaks", area: "secretos", obligatoria: true, red: false };

/**
 * gitleaks with evol's own configuration: the project must not choose what is hidden, so its
 * `.gitleaks.toml`, `.gitleaksignore` and «gitleaks:allow» comments do not count. Anything that
 * must be ignored goes in `.evol/security-ignore.json`, with a reason, an owner and an expiry.
 */
export function runGitleaks(root: string): RunResult {
  const bin = toolPath("gitleaks");
  if (!bin) return missingRun(GITLEAKS);
  const version = securityToolVersion("gitleaks", bin);
  const work = mkdtempSync(join(tmpdir(), "evol-sec-gitleaks-"));
  try {
    const report = join(work, "report.json");
    const config = join(work, "gitleaks.toml");
    writeFileSync(
      config,
      [
        "[extend]",
        "useDefault = true",
        "",
        "[[allowlists]]",
        'description = "carpetas que no son del proyecto"',
        "paths = [",
        "  '''(^|/)node_modules/''',",
        "  '''(^|/)dist/''',",
        "  '''(^|/)\\.git/''',",
        "  '''^\\.evol/qa/security/''',",
        "]",
        "",
      ].join("\n"),
    );
    const noIgnores = join(work, "sin-ignorados");
    mkdirSync(noIgnores);
    const r = spawnSync(
      bin,
      [
        "dir",
        root,
        "--config",
        config,
        "--gitleaks-ignore-path",
        noIgnores,
        "--ignore-gitleaks-allow",
        "--redact",
        "--report-format",
        "json",
        "--report-path",
        report,
        "--no-banner",
        "--exit-code",
        "2",
      ],
      { encoding: "utf8", timeout: 300_000 },
    );
    if (r.error || (r.status !== 0 && r.status !== 2))
      return failedRun(GITLEAKS, r.error?.message ?? `terminó con el código ${r.status}`, version);
    let leaks: { RuleID?: string; File?: string; StartLine?: number }[] = [];
    if (existsSync(report)) {
      const raw = readFileSync(report, "utf8").trim();
      const parsed = raw === "" ? [] : json<typeof leaks>(raw);
      if (parsed === null) return failedRun(GITLEAKS, "no se pudo leer su informe", version);
      leaks = parsed;
    } else if (r.status === 2) return failedRun(GITLEAKS, "no escribió su informe", version);
    // never the secret itself, only the rule, the file and the line
    return done(
      GITLEAKS,
      leaks.map((l) => ({
        herramienta: "gitleaks",
        area: "secretos",
        regla: l.RuleID ?? "desconocida",
        severidad: "CRITICAL",
        archivo: rel(root, l.File ?? ""),
        ...(l.StartLine ? { linea: l.StartLine } : {}),
        mensaje: `secreto detectado (${l.RuleID ?? "regla desconocida"})`,
      })),
      version,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/* ----------------------------------- código ----------------------------------- */

const SEMGREP: Spec = { tool: "semgrep", area: "codigo", obligatoria: true, red: false };
const BANDIT: Spec = { tool: "bandit", area: "codigo", obligatoria: true, red: false };
const SHELLCHECK: Spec = { tool: "shellcheck", area: "codigo", obligatoria: true, red: false };

/**
 * semgrep prefixes a rule's id with the folder it came from («home.user.proj.rules.semgrep.evol.x»),
 * which changes from one machine to another and would break the ignore list: that prefix is cut.
 */
export function ruleId(id: string, root: string, dirs: string[]): string {
  const dotted = (d: string): string =>
    d.replace(/^\/+/, "").replaceAll("/", ".").replace(/^\.+/, "");
  for (const dir of dirs) {
    for (const prefix of [dotted(dir), dotted(relative(root, dir))]) {
      const at = prefix === "" ? -1 : id.indexOf(`${prefix}.`);
      if (at !== -1 && at <= 1) return id.slice(at + prefix.length + 1);
    }
  }
  return id;
}

const SEMGREP_SEVERITY: Record<string, Severity> = {
  ERROR: "HIGH",
  WARNING: "MEDIUM",
  INFO: "LOW",
};
const isSeverity = (s: string): s is Severity => ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(s);

/**
 * semgrep with evol's rules and the project's own (`.evol/semgrep/`), offline. `.semgrepignore`
 * files are not honoured. A rule may raise its findings to CRITICAL with `metadata.evol_severity`.
 */
export function runSemgrep(root: string): RunResult {
  const bin = toolPath("semgrep");
  if (!bin) return missingRun(SEMGREP);
  const version = securityToolVersion("semgrep", bin);
  const rules = [join(packageRoot(), "rules", "semgrep")];
  if (existsSync(evolPath(root, "semgrep"))) rules.push(evolPath(root, "semgrep"));
  type SemgrepOut = {
    results?: {
      check_id?: string;
      path?: string;
      start?: { line?: number };
      extra?: { severity?: string; metadata?: { evol_severity?: string } };
    }[];
    errors?: { level?: string; path?: string; type?: unknown }[];
  };
  const once = (): { r: SpawnSyncReturns<string>; parsed: SemgrepOut | null } => {
    const r = spawnSync(
      bin,
      [
        "scan",
        ...rules.flatMap((c) => ["--config", c]),
        "--json",
        "--quiet",
        "--metrics",
        "off",
        "--disable-version-check",
        "--x-ignore-semgrepignore-files",
        ...[...SKIP_DIRS].flatMap((d) => ["--exclude", d]),
        ".",
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 600_000,
        maxBuffer: 128 * 1024 * 1024,
        env: { ...process.env, SEMGREP_SEND_METRICS: "off", SEMGREP_ENABLE_VERSION_CHECK: "0" },
      },
    );
    return { r, parsed: r.error ? null : json<SemgrepOut>(r.stdout) };
  };
  let { r, parsed } = once();
  // The engine sometimes fails on its own, with an error that names no file, and does not on the
  // next run. One retry is safe: only a clean second run counts.
  const engineOnly = (p: SemgrepOut | null): boolean => {
    const bad = (p?.errors ?? []).filter((e) => e.level === "error" || e.level === undefined);
    return bad.length > 0 && bad.every((e) => !e.path);
  };
  if (engineOnly(parsed)) ({ r, parsed } = once());
  if (r.error) return failedRun(SEMGREP, r.error.message, version);
  if (parsed === null)
    return failedRun(
      SEMGREP,
      `no devolvió un informe legible (código ${r.status}): ${firstLine(r.stderr)}`,
      version,
    );
  const broken = (parsed.errors ?? []).filter((e) => e.level === "error" || e.level === undefined);
  if (broken.length > 0)
    return failedRun(
      SEMGREP,
      `no pudo analizar ${broken
        // the type of error says why (a timeout, a crash) without quoting the code it choked on
        .map((e) => {
          const kind = typeof e.type === "string" ? ` (${e.type})` : "";
          return `${e.path ? rel(root, e.path) : "una regla"}${kind}`;
        })
        .slice(0, 3)
        .join(", ")}`,
      version,
    );
  const findings: SecFinding[] = (parsed.results ?? []).map((hit) => {
    const forced = (hit.extra?.metadata?.evol_severity ?? "").toUpperCase();
    const severidad =
      (isSeverity(forced) ? forced : undefined) ??
      SEMGREP_SEVERITY[(hit.extra?.severity ?? "").toUpperCase()] ??
      "LOW";
    const regla = ruleId(hit.check_id ?? "regla", root, rules);
    return {
      herramienta: "semgrep",
      area: "codigo",
      regla,
      severidad,
      archivo: rel(root, hit.path ?? ""),
      ...(hit.start?.line ? { linea: hit.start.line } : {}),
      // the rule's message can interpolate the matched code, so only its id is kept
      mensaje: `regla ${regla}`,
    };
  });
  return done(SEMGREP, findings, version);
}

const BANDIT_SEVERITY: Record<string, Severity> = { HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW" };

/** bandit over the Python files (`# nosec` ignored). Its messages can quote a password, so only the test id and name are kept. */
export function runBandit(root: string, files: string[]): RunResult {
  if (!files.some((f) => f.endsWith(".py"))) return notApplicable(BANDIT, "sin archivos Python");
  const bin = toolPath("bandit");
  if (!bin) return missingRun(BANDIT);
  const version = securityToolVersion("bandit", bin);
  const r = spawnSync(
    bin,
    [
      "-r",
      ".",
      "-f",
      "json",
      "-q",
      "--ignore-nosec",
      "-x",
      [...SKIP_DIRS].map((d) => `./${d}`).join(","),
    ],
    { cwd: root, encoding: "utf8", timeout: 300_000, maxBuffer: 128 * 1024 * 1024 },
  );
  if (r.error) return failedRun(BANDIT, r.error.message, version);
  const parsed = json<{
    results?: {
      filename?: string;
      line_number?: number;
      issue_severity?: string;
      test_id?: string;
      test_name?: string;
    }[];
    errors?: unknown[];
  }>(r.stdout);
  if (parsed === null || (r.status !== 0 && r.status !== 1))
    return failedRun(
      BANDIT,
      `no devolvió un informe legible (código ${r.status}): ${firstLine(r.stderr)}`,
      version,
    );
  if ((parsed.errors ?? []).length > 0)
    return failedRun(BANDIT, `no pudo leer ${(parsed.errors ?? []).length} archivo(s)`, version);
  return done(
    BANDIT,
    (parsed.results ?? []).map((i) => ({
      herramienta: "bandit",
      area: "codigo",
      regla: i.test_id ?? "desconocida",
      severidad: BANDIT_SEVERITY[(i.issue_severity ?? "").toUpperCase()] ?? "LOW",
      archivo: rel(root, i.filename ?? ""),
      ...(i.line_number ? { linea: i.line_number } : {}),
      mensaje: `prueba ${i.test_name ?? i.test_id ?? "desconocida"}`,
    })),
    version,
  );
}

const SHELLCHECK_SEVERITY: Record<string, Severity> = {
  error: "HIGH",
  warning: "MEDIUM",
  info: "LOW",
  style: "LOW",
};

/** shellcheck over the shell scripts, without any `.shellcheckrc`. */
export function runShellcheck(root: string, files: string[]): RunResult {
  const scripts = files.filter((f) => /\.(sh|bash)$/.test(f));
  if (scripts.length === 0) return notApplicable(SHELLCHECK, "sin scripts de shell");
  const bin = toolPath("shellcheck");
  if (!bin) return missingRun(SHELLCHECK);
  const version = securityToolVersion("shellcheck", bin);
  const findings: SecFinding[] = [];
  for (let i = 0; i < scripts.length; i += 100) {
    const r = spawnSync(bin, ["--norc", "-f", "json", ...scripts.slice(i, i + 100)], {
      cwd: root,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.error) return failedRun(SHELLCHECK, r.error.message, version);
    const parsed = json<{ file?: string; line?: number; level?: string; code?: number }[]>(
      r.stdout,
    );
    if (parsed === null)
      return failedRun(SHELLCHECK, `no devolvió un informe legible (código ${r.status})`, version);
    for (const item of parsed)
      findings.push({
        herramienta: "shellcheck",
        area: "codigo",
        regla: `SC${item.code ?? "?"}`,
        severidad: SHELLCHECK_SEVERITY[item.level ?? ""] ?? "LOW",
        archivo: rel(root, item.file ?? ""),
        ...(item.line ? { linea: item.line } : {}),
        mensaje: `aviso SC${item.code ?? "?"} de shellcheck`,
      });
  }
  return done(SHELLCHECK, findings, version);
}

/* -------------------------------- dependencias -------------------------------- */

const OSV: Spec = { tool: "osv-scanner", area: "dependencias", obligatoria: true, red: true };
const GUARDDOG: Spec = { tool: "guarddog", area: "dependencias", obligatoria: false, red: true };

const LOCKFILE =
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|uv\.lock|poetry\.lock|Pipfile\.lock|requirements[\w.-]*\.txt|Cargo\.lock|Gemfile\.lock|composer\.lock)$/;

function severityOfScore(score: number): Severity {
  return score >= 9 ? "CRITICAL" : score >= 7 ? "HIGH" : score >= 4 ? "MEDIUM" : "LOW";
}
const OSV_LABEL: Record<string, Severity> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MODERATE: "MEDIUM",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

interface OsvOutput {
  results?: {
    source?: { path?: string };
    packages?: {
      package?: { name?: string; version?: string };
      groups?: { ids?: string[]; max_severity?: string }[];
      vulnerabilities?: {
        id?: string;
        summary?: string;
        database_specific?: { severity?: string };
      }[];
    }[];
  }[];
}

/** osv-scanner over the lock files. Needs the network: offline it fails, it does not pass. */
export function runOsvScanner(root: string, files: string[]): RunResult {
  const locks = files.filter((f) => LOCKFILE.test(f));
  if (locks.length === 0) return notApplicable(OSV, "sin archivos de bloqueo");
  const bin = toolPath("osv-scanner");
  if (!bin) return missingRun(OSV);
  const version = securityToolVersion("osv-scanner", bin);
  const r = spawnSync(
    bin,
    ["scan", "source", "--format", "json", ...locks.flatMap((l) => ["-L", join(root, l)])],
    { cwd: root, encoding: "utf8", timeout: 300_000, maxBuffer: 128 * 1024 * 1024 },
  );
  if (r.error) return failedRun(OSV, r.error.message, version);
  const parsed = r.status === 0 || r.status === 1 ? json<OsvOutput>(r.stdout) : null;
  if (parsed === null)
    return failedRun(
      OSV,
      `no devolvió un informe legible (código ${r.status}; ¿sin red?): ${firstLine(r.stderr)}`,
      version,
    );
  const findings: SecFinding[] = [];
  for (const result of parsed.results ?? []) {
    for (const pkg of result.packages ?? []) {
      for (const group of pkg.groups ?? []) {
        const id = group.ids?.[0] ?? "desconocida";
        const vuln = (pkg.vulnerabilities ?? []).find((v) =>
          (group.ids ?? []).includes(v.id ?? ""),
        );
        const score = Number(group.max_severity);
        const severidad =
          Number.isFinite(score) && group.max_severity !== ""
            ? severityOfScore(score)
            : (OSV_LABEL[(vuln?.database_specific?.severity ?? "").toUpperCase()] ?? "MEDIUM");
        findings.push({
          herramienta: "osv-scanner",
          area: "dependencias",
          regla: id,
          severidad,
          archivo: rel(root, result.source?.path ?? ""),
          mensaje:
            `${pkg.package?.name ?? "paquete"}@${pkg.package?.version ?? "?"}: ${vuln?.summary ?? id}`.slice(
              0,
              200,
            ),
        });
      }
    }
  }
  return done(OSV, findings, version);
}

const nonEmpty = (v: unknown): boolean =>
  v !== null &&
  v !== undefined &&
  v !== false &&
  !(Array.isArray(v) && v.length === 0) &&
  !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/**
 * guarddog over the manifests: looks for malicious or suspicious packages. Optional (it only warns
 * when missing). The «capability-*» rules only say what a package can do, so they are not findings.
 */
export function runGuarddog(root: string, files: string[]): RunResult {
  const manifests = files.filter((f) => /(^|\/)(package\.json|requirements[\w.-]*\.txt)$/.test(f));
  const targets = manifests.filter((f) => {
    if (f.endsWith("package.json")) {
      const pkg = json<{ dependencies?: object; devDependencies?: object }>(
        readFileSync(join(root, f), "utf8"),
      );
      return Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies }).length > 0;
    }
    return true;
  });
  if (targets.length === 0) return notApplicable(GUARDDOG, "sin dependencias declaradas");
  const bin = toolPath("guarddog");
  if (!bin) return missingRun(GUARDDOG);
  const version = securityToolVersion("guarddog", bin);
  const findings: SecFinding[] = [];
  const problems: string[] = [];
  for (const manifest of targets) {
    const ecosystem = manifest.endsWith("package.json") ? "npm" : "pypi";
    const r = spawnSync(
      bin,
      [ecosystem, "verify", join(root, manifest), "--output-format", "json"],
      { cwd: root, encoding: "utf8", timeout: 900_000, maxBuffer: 256 * 1024 * 1024 },
    );
    const parsed =
      r.status === 0
        ? json<
            {
              dependency?: string;
              version?: string;
              result?: { results?: Record<string, unknown>; errors?: Record<string, unknown> };
            }[]
          >(r.stdout)
        : null;
    if (parsed === null) {
      problems.push(`${manifest}: no devolvió un informe legible (¿sin red?)`);
      continue;
    }
    for (const dep of parsed) {
      if (nonEmpty(dep.result?.errors))
        problems.push(`${manifest}: no pudo revisar ${dep.dependency ?? "un paquete"}`);
      for (const [key, value] of Object.entries(dep.result?.results ?? {})) {
        if (key.startsWith("capability-") || !nonEmpty(value)) continue;
        findings.push({
          herramienta: "guarddog",
          area: "dependencias",
          regla: key,
          severidad: key.startsWith("threat-") ? "HIGH" : "MEDIUM",
          archivo: manifest,
          mensaje: `${dep.dependency ?? "paquete"}@${dep.version ?? "?"}: ${key}`,
        });
      }
    }
  }
  if (problems.length > 0)
    return { ...failedRun(GUARDDOG, problems.slice(0, 3).join("; "), version), findings };
  return done(GUARDDOG, findings, version);
}
