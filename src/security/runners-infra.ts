import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toolPath } from "../skills/tools.js";
import type { RunResult, SecFinding, Severity } from "./model.js";
import { done, failedRun, firstLine, json, missingRun, notApplicable, rel } from "./runners.js";
import type { Spec } from "./runners.js";
import { securityToolVersion } from "./tools.js";

/* The areas that only read files: containers and infrastructure as code, and licences. */

const TRIVY: Spec = { tool: "trivy", area: "contenedores", obligatoria: false, red: false };
const CHECKOV: Spec = { tool: "checkov", area: "contenedores", obligatoria: false, red: false };
const SYFT: Spec = { tool: "syft", area: "licencias", obligatoria: false, red: false };
const REUSE: Spec = { tool: "reuse", area: "licencias", obligatoria: false, red: false };

const SKIP_DIRS = "node_modules,dist,build,coverage,.git,.evol,.venv,venv,target";

const IAC_FILE = /(^|\/)(Dockerfile[\w.-]*|[\w.-]*\.dockerfile|[\w.-]*\.tf|[\w.-]*\.tfvars)$/i;
const MANIFEST = /^(apiVersion|AWSTemplateFormatVersion):/m;

/** Dockerfiles, Terraform, and the YAML that is Kubernetes or CloudFormation (it has to be read to know). */
function iacFiles(root: string, files: string[]): string[] {
  return files.filter((f) => {
    if (IAC_FILE.test(f)) return true;
    if (!/\.(ya?ml|json)$/i.test(f)) return false;
    try {
      return (
        statSync(join(root, f)).size < 1_000_000 &&
        MANIFEST.test(readFileSync(join(root, f), "utf8"))
      );
    } catch {
      return false;
    }
  });
}

const TRIVY_SEVERITY: Record<string, Severity> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

interface TrivyOutput {
  Results?: {
    Target?: string;
    Misconfigurations?: {
      ID?: string;
      Title?: string;
      Severity?: string;
      Status?: string;
      CauseMetadata?: { StartLine?: number };
    }[];
  }[];
}

/**
 * trivy over Dockerfiles, Terraform and Kubernetes manifests. It reads its checks from its own
 * package (no update from the network), and the project's `.trivyignore` does not count: what is
 * ignored goes in `.evol/security-ignore.json`.
 */
export function runTrivy(root: string, files: string[]): RunResult {
  if (iacFiles(root, files).length === 0)
    return notApplicable(TRIVY, "sin Dockerfile, Terraform ni manifiestos de Kubernetes");
  const bin = toolPath("trivy");
  if (!bin) return missingRun(TRIVY);
  const version = securityToolVersion("trivy", bin);
  const work = mkdtempSync(join(tmpdir(), "evol-trivy-"));
  try {
    const noIgnores = join(work, "sin-ignorados");
    writeFileSync(noIgnores, "");
    const r = spawnSync(
      bin,
      [
        "config",
        "--format",
        "json",
        "--quiet",
        "--skip-check-update",
        "--skip-dirs",
        SKIP_DIRS,
        "--ignorefile",
        noIgnores,
        root,
      ],
      { cwd: work, encoding: "utf8", timeout: 300_000, maxBuffer: 128 * 1024 * 1024 },
    );
    if (r.error) return failedRun(TRIVY, r.error.message, version);
    const parsed = r.status === 0 ? json<TrivyOutput>(r.stdout) : null;
    if (parsed === null)
      return failedRun(
        TRIVY,
        `no devolvió un informe legible (código ${r.status}): ${firstLine(r.stderr)}`,
        version,
      );
    const findings: SecFinding[] = [];
    for (const result of parsed.Results ?? [])
      for (const m of result.Misconfigurations ?? []) {
        if (m.Status !== "FAIL") continue;
        findings.push({
          herramienta: "trivy",
          area: "contenedores",
          regla: m.ID ?? "desconocida",
          severidad: TRIVY_SEVERITY[(m.Severity ?? "").toUpperCase()] ?? "LOW",
          archivo: rel(root, result.Target ?? ""),
          ...(m.CauseMetadata?.StartLine ? { linea: m.CauseMetadata.StartLine } : {}),
          mensaje: (m.Title ?? m.ID ?? "configuración insegura").slice(0, 200),
        });
      }
    return done(TRIVY, findings, version);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

interface CheckovCheck {
  check_id?: string;
  check_name?: string;
  file_path?: string;
  file_line_range?: number[];
  severity?: string | null;
}
interface CheckovOutput {
  check_type?: string;
  results?: { failed_checks?: CheckovCheck[] };
}

const CHECKOV_FRAMEWORKS: { name: string; test: (f: string) => boolean }[] = [
  { name: "github_actions", test: (f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f) },
  { name: "gitlab_ci", test: (f) => /(^|\/)\.gitlab-ci\.ya?ml$/.test(f) },
];

/**
 * checkov for what trivy does not read: CI pipelines. It has no severity without a paid key, so
 * its findings are MEDIUM. It never downloads policies and sends nothing.
 */
export function runCheckov(root: string, files: string[]): RunResult {
  const frameworks = CHECKOV_FRAMEWORKS.filter((fw) => files.some(fw.test)).map((fw) => fw.name);
  if (frameworks.length === 0) return notApplicable(CHECKOV, "sin pipelines de CI");
  const bin = toolPath("checkov");
  if (!bin) return missingRun(CHECKOV);
  const version = securityToolVersion("checkov", bin);
  const r = spawnSync(
    bin,
    [
      "-d",
      root,
      "--framework",
      frameworks.join(","),
      "--output",
      "json",
      "--quiet",
      "--compact",
      "--skip-download",
      "--skip-path",
      "node_modules",
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 300_000,
      maxBuffer: 128 * 1024 * 1024,
      env: { ...process.env, BC_SKIP_MAPPING: "TRUE", CKV_IGNORED_DIRECTORIES: SKIP_DIRS },
    },
  );
  if (r.error) return failedRun(CHECKOV, r.error.message, version);
  const raw =
    r.status === 0 || r.status === 1 ? json<CheckovOutput | CheckovOutput[]>(r.stdout) : null;
  if (raw === null)
    return failedRun(
      CHECKOV,
      `no devolvió un informe legible (código ${r.status}): ${firstLine(r.stderr)}`,
      version,
    );
  const findings: SecFinding[] = [];
  for (const out of Array.isArray(raw) ? raw : [raw])
    for (const c of out.results?.failed_checks ?? [])
      findings.push({
        herramienta: "checkov",
        area: "contenedores",
        regla: c.check_id ?? "desconocida",
        severidad: TRIVY_SEVERITY[(c.severity ?? "").toUpperCase()] ?? "MEDIUM",
        archivo: rel(root, (c.file_path ?? "").replace(/^\//, "")),
        ...(c.file_line_range?.[0] ? { linea: c.file_line_range[0] } : {}),
        mensaje: (c.check_name ?? c.check_id ?? "política incumplida").slice(0, 200),
      });
  return done(CHECKOV, findings, version);
}

/** The folder where the scan keeps what it produces (the SBOM). */
const securityOut = (root: string): string => join(root, ".evol", "qa", "security");
export const SBOM_FILE = "sbom.cdx.json";

const COPYLEFT = /^(AGPL|SSPL|GPL)-/i;

interface CycloneDx {
  components?: {
    name?: string;
    version?: string;
    licenses?: { license?: { id?: string }; expression?: string }[];
  }[];
}

/**
 * syft writes the software bill of materials as evidence (CycloneDX, in `.evol/qa/security/`) and
 * the scan flags the dependencies under a strong copyleft licence: not a vulnerability, a decision
 * the person should take knowingly.
 */
export function runSyft(root: string, files: string[]): RunResult {
  const lock =
    /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|uv\.lock|poetry\.lock|Pipfile\.lock|requirements[\w.-]*\.txt|Cargo\.lock|go\.sum|Gemfile\.lock|composer\.lock)$/;
  if (!files.some((f) => lock.test(f))) return notApplicable(SYFT, "sin archivos de bloqueo");
  const bin = toolPath("syft");
  if (!bin) return missingRun(SYFT);
  const version = securityToolVersion("syft", bin);
  mkdirSync(securityOut(root), { recursive: true });
  const file = join(securityOut(root), SBOM_FILE);
  const r = spawnSync(
    bin,
    [`dir:${root}`, "-o", `cyclonedx-json=${file}`, "-q", "--exclude", "./.evol/**"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 300_000,
      env: { ...process.env, SYFT_CHECK_FOR_APP_UPDATE: "false" },
    },
  );
  if (r.error || r.status !== 0 || !existsSync(file))
    return failedRun(
      SYFT,
      r.error?.message ?? `no generó el SBOM (código ${r.status}): ${firstLine(r.stderr)}`,
      version,
    );
  const sbom = json<CycloneDx>(readFileSync(file, "utf8"));
  if (sbom === null) return failedRun(SYFT, "el SBOM no es legible", version);
  const findings: SecFinding[] = [];
  for (const c of sbom.components ?? []) {
    const ids = (c.licenses ?? []).map((l) => l.license?.id ?? l.expression ?? "");
    const strong = ids.find((id) => COPYLEFT.test(id));
    if (strong)
      findings.push({
        herramienta: "syft",
        area: "licencias",
        regla: `copyleft-${strong}`,
        severidad: "MEDIUM",
        archivo: SBOM_FILE,
        mensaje: `${c.name ?? "paquete"}@${c.version ?? "?"} usa ${strong}`.slice(0, 200),
      });
  }
  return done(
    SYFT,
    findings,
    version,
    `${sbom.components?.length ?? 0} componente(s) en .evol/qa/security/${SBOM_FILE}`,
  );
}

interface ReuseLint {
  non_compliant?: Record<string, unknown[]>;
}

const REUSE_LABEL: Record<string, string> = {
  missing_copyright_info: "archivo(s) sin información de copyright",
  missing_licensing_info: "archivo(s) sin información de licencia",
  bad_licenses: "licencia(s) que no son SPDX",
  missing_licenses: "licencia(s) usadas sin su texto en LICENSES/",
  deprecated_licenses: "licencia(s) obsoletas",
  read_errors: "archivo(s) ilegibles",
};

/** REUSE compliance of the project's own code, only for a project that already follows REUSE. */
export function runReuse(root: string, files: string[]): RunResult {
  const follows =
    existsSync(join(root, ".reuse")) ||
    files.some((f) => f.startsWith("LICENSES/")) ||
    existsSync(join(root, "REUSE.toml"));
  if (!follows)
    return notApplicable(REUSE, "el proyecto no usa REUSE (sin .reuse/, REUSE.toml ni LICENSES/)");
  const bin = toolPath("reuse");
  if (!bin) return missingRun(REUSE);
  const version = securityToolVersion("reuse", bin);
  const r = spawnSync(bin, ["--root", root, "lint", "--json"], {
    cwd: root,
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (r.error) return failedRun(REUSE, r.error.message, version);
  const parsed = r.status === 0 || r.status === 1 ? json<ReuseLint>(r.stdout) : null;
  if (parsed === null) {
    // reuse prints deprecation warnings first: the error is the last line
    const lines = r.stderr.trim().split("\n");
    return failedRun(
      REUSE,
      `no devolvió un informe legible (código ${r.status}): ${(lines[lines.length - 1] ?? "").slice(0, 160)}`,
      version,
    );
  }
  const findings: SecFinding[] = [];
  // in the order of the table, not the tool's: the report must not change between runs
  for (const [key, label] of Object.entries(REUSE_LABEL)) {
    const list = parsed.non_compliant?.[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    findings.push({
      herramienta: "reuse",
      area: "licencias",
      regla: key,
      severidad: "MEDIUM",
      archivo: ".",
      mensaje: `${list.length} ${label}`,
    });
  }
  return done(REUSE, findings, version);
}
