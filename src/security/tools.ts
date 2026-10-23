import { spawnSync } from "node:child_process";
import { INSTALL_HINT, toolPath, versionOf } from "../skills/tools.js";
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
];

const REQUIRED_LABEL: Record<Obligacion, string> = {
  siempre: "obligatoria",
  "segun-proyecto": "obligatoria si el proyecto lo necesita",
  opcional: "opcional",
};

/** The version of an installed security tool, whatever shape its `--version` has. */
export function securityToolVersion(tool: ToolName, bin: string): string | undefined {
  switch (tool) {
    case "gitleaks":
      return versionOf(bin, ["version"]);
    case "bandit":
      return versionOf(bin, ["--version"])?.replace(/^bandit\s+/i, "");
    case "osv-scanner":
      return versionOf(bin, ["--version"])?.replace(/^osv-scanner version:\s*/i, "");
    case "shellcheck":
      // its first line is a banner; the number is on the «version:» line
      return /version:\s*(\S+)/i.exec(
        spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 20_000 }).stdout,
      )?.[1];
    default:
      return versionOf(bin, ["--version"]);
  }
}

export interface ToolStatus extends SecurityTool {
  instalada: boolean;
  version?: string;
  etiqueta: string;
  detalle: string;
}

/** Every security tool with whether it is installed, its version and whether it is required. */
export function securityToolStatus(): ToolStatus[] {
  return SECURITY_TOOLS.map((t) => {
    const bin = toolPath(t.tool);
    const version = bin ? securityToolVersion(t.tool, bin) : undefined;
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
  });
}
