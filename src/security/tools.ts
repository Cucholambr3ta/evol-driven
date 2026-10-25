import { execFile, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { INSTALL_HINT, toolPath } from "../skills/tools.js";
import type { ToolName } from "../skills/tools.js";

/**
 * `siempre`: `evol security scan --ci` fails without it. `segun-proyecto`: required only when the
 * project has what it reads (Python, shell scripts, lock files). `opcional`: it only warns.
 */
export type Obligacion = "siempre" | "segun-proyecto" | "opcional";

export interface SecurityTool {
  tool: ToolName;
  obligatoria: Obligacion;
  uso: string;
  /** Used by the skill audit too: without it every skill stays «no auditada». */
  auditaSkills: boolean;
}

export const SECURITY_TOOLS: readonly SecurityTool[] = [
  { tool: "gitleaks", obligatoria: "siempre", uso: "secretos", auditaSkills: true },
  { tool: "semgrep", obligatoria: "siempre", uso: "código", auditaSkills: true },
  { tool: "bandit", obligatoria: "segun-proyecto", uso: "código Python", auditaSkills: false },
  {
    tool: "shellcheck",
    obligatoria: "segun-proyecto",
    uso: "scripts de shell",
    auditaSkills: false,
  },
  {
    tool: "osv-scanner",
    obligatoria: "segun-proyecto",
    uso: "dependencias (usa red)",
    auditaSkills: false,
  },
  {
    tool: "guarddog",
    obligatoria: "opcional",
    uso: "paquetes maliciosos (usa red)",
    auditaSkills: false,
  },
  {
    tool: "trivy",
    obligatoria: "segun-proyecto",
    uso: "Dockerfile, Terraform y Kubernetes",
    auditaSkills: false,
  },
  { tool: "checkov", obligatoria: "opcional", uso: "pipelines de CI", auditaSkills: false },
  { tool: "syft", obligatoria: "opcional", uso: "SBOM", auditaSkills: false },
  { tool: "reuse", obligatoria: "opcional", uso: "licencias del código", auditaSkills: false },
  {
    tool: "schemathesis",
    obligatoria: "opcional",
    uso: "pruebas de una API (envía tráfico)",
    auditaSkills: false,
  },
  {
    tool: "zaproxy",
    obligatoria: "opcional",
    uso: "análisis pasivo de una API o web (envía tráfico)",
    auditaSkills: false,
  },
  {
    tool: "testssl",
    obligatoria: "opcional",
    uso: "configuración TLS (envía tráfico)",
    auditaSkills: false,
  },
];

const REQUIRED_LABEL: Record<Obligacion, string> = {
  siempre: "obligatoria",
  "segun-proyecto": "obligatoria si el proyecto lo necesita",
  opcional: "opcional",
};

interface Probe {
  args: string[];
  /** The version out of the tool's output, or undefined. */
  parse: (out: string) => string | undefined;
}

const firstLineOf = (out: string): string | undefined => out.trim().split("\n")[0] || undefined;
const stripFrom =
  (pattern: RegExp) =>
  (out: string): string | undefined =>
    firstLineOf(out)?.replace(pattern, "");

/** How to ask each tool for its version, whatever shape its `--version` has. */
const PROBES: Partial<Record<ToolName, Probe>> = {
  gitleaks: { args: ["version"], parse: firstLineOf },
  bandit: { args: ["--version"], parse: stripFrom(/^bandit\s+/i) },
  "osv-scanner": { args: ["--version"], parse: stripFrom(/^osv-scanner version:\s*/i) },
  // its first line is a banner; the number is on the «version:» line
  shellcheck: { args: ["--version"], parse: (out) => /version:\s*(\S+)/i.exec(out)?.[1] },
  // the banner has colour codes around the number: the first x.y(.z) after «version»
  testssl: {
    args: ["--version"],
    parse: (out) =>
      /(\d+\.\d+(?:\.\d+)?)/.exec(out.slice(Math.max(out.search(/version/i), 0)))?.[1],
  },
  trivy: { args: ["--version"], parse: stripFrom(/^Version:\s*/i) },
  syft: { args: ["--version"], parse: stripFrom(/^syft\s+/i) },
  reuse: { args: ["--version"], parse: stripFrom(/^reuse,\s*version\s+/i) },
  schemathesis: { args: ["--version"], parse: stripFrom(/^\S+,\s*version\s+/i) },
};
const DEFAULT_PROBE: Probe = { args: ["--version"], parse: firstLineOf };

/** ZAP's Java machine takes seconds to start: its version is in the name of its jar. */
function zapVersion(bin: string): string | undefined {
  try {
    const jar = readdirSync(dirname(bin)).find((f) => /^zap-\d[\w.-]*\.jar$/.test(f));
    return jar?.replace(/^zap-/, "").replace(/\.jar$/, "");
  } catch {
    return undefined;
  }
}

export function securityToolVersion(tool: ToolName, bin: string): string | undefined {
  if (tool === "zaproxy") return zapVersion(bin);
  const probe = PROBES[tool] ?? DEFAULT_PROBE;
  const r = spawnSync(bin, probe.args, { encoding: "utf8", timeout: 20_000 });
  return r.status === 0 ? probe.parse(r.stdout) : undefined;
}

/**
 * The same, without waiting for each tool in turn: several are Python and slow to start. Used only
 * by `evol doctor` (criterio 145: no se retrasa demasiado), so a `--version` call gets a much
 * tighter cap than the 20 s of the synchronous version above (used by the security scan itself,
 * which has no such budget): a version probe that has not answered in 1.5 s is not going to.
 */
async function securityToolVersionAsync(tool: ToolName, bin: string): Promise<string | undefined> {
  if (tool === "zaproxy") return zapVersion(bin);
  const probe = PROBES[tool] ?? DEFAULT_PROBE;
  return new Promise((resolve) => {
    execFile(bin, probe.args, { encoding: "utf8", timeout: 1_500 }, (error, stdout) =>
      resolve(error ? undefined : probe.parse(stdout)),
    );
  });
}

export interface ToolStatus extends SecurityTool {
  instalada: boolean;
  version?: string;
  etiqueta: string;
  detalle: string;
}

/** Every security tool with whether it is installed, its version and whether it is required. */
export async function securityToolStatus(): Promise<ToolStatus[]> {
  return Promise.all(
    SECURITY_TOOLS.map(async (t) => {
      const bin = toolPath(t.tool);
      const version = bin ? await securityToolVersionAsync(t.tool, bin) : undefined;
      const etiqueta = `${REQUIRED_LABEL[t.obligatoria]}${t.auditaSkills ? "; sin ella toda skill queda «no auditada»" : ""}`;
      return {
        ...t,
        instalada: bin !== null,
        ...(version ? { version } : {}),
        etiqueta,
        detalle: bin
          ? `${version ?? "versión desconocida"} — ${t.uso}; ${etiqueta}`
          : `no instalada: ${INSTALL_HINT[t.tool]} — ${t.uso}; ${etiqueta}`,
      };
    }),
  );
}
