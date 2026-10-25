import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Where a rule lives, for `evol doctor`'s convivencia report. */
export type Clasificacion = "impuesta" | "declarativa" | "no anulable";

export interface HookGlobal {
  evento: string;
  comando: string;
}

export interface McpServidor {
  nombre: string;
  transporte: "local" | "remoto";
  origen: "proyecto" | "global";
}

export interface ConvivenciaReport {
  /** Hooks of another framework at the account/machine level: never anulable from a project. */
  hooksAjenos: HookGlobal[];
  bypassPermissions: boolean;
  /** Plugin ids the global settings have turned on, that the project can turn off for itself. */
  pluginsActivados: string[];
  /** A deny rule with a relative pattern (`.ssh/*`) instead of an absolute one (`~/.ssh/**`): it only protects the current working directory, not the home directory from elsewhere. */
  denyRelativos: string[];
  outputStyleGlobal: string | null;
  mcpServers: McpServidor[];
}

/** The commands evol's own hooks and MemPalace's run: never reported as "another framework". */
const OWN_HOOK = /^(evol |mempalace )/;

function readJson(file: string): Record<string, unknown> | null {
  if (!existsSync(file)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function hooksOf(settings: Record<string, unknown>): HookGlobal[] {
  const hooks = settings["hooks"] as Record<string, unknown> | undefined;
  if (!hooks) return [];
  const found: HookGlobal[] = [];
  for (const [evento, entradas] of Object.entries(hooks)) {
    if (!Array.isArray(entradas)) continue;
    for (const entrada of entradas as { hooks?: { command?: string }[] }[]) {
      for (const h of entrada.hooks ?? []) {
        if (h.command && !OWN_HOOK.test(h.command)) found.push({ evento, comando: h.command });
      }
    }
  }
  return found;
}

function mcpServersOf(
  config: Record<string, unknown>,
  origen: McpServidor["origen"],
): McpServidor[] {
  const mcp = config["mcp"] as Record<string, unknown> | undefined;
  if (!mcp) return [];
  const servers = (mcp["servers"] as Record<string, { type?: string }> | undefined) ?? {};
  const found: McpServidor[] = Object.entries(servers).map(([nombre, s]) => ({
    nombre,
    transporte: s?.type === "remote" ? "remoto" : "local",
    origen,
  }));
  // a top-level entry beside "servers" (the shape context7 uses in OpenCode) is remote too
  for (const [key, value] of Object.entries(mcp)) {
    if (key === "servers") continue;
    const s = value as { type?: string } | undefined;
    if (s && typeof s === "object" && "type" in s) {
      found.push({ nombre: key, transporte: s.type === "remote" ? "remoto" : "local", origen });
    }
  }
  return found;
}

/**
 * What another framework left at the account level (`home`), read only — never changed here.
 * `evol doctor` uses this to tell the person what it found and whether it could anul it from the
 * project; `evol agents` uses `pluginsActivados` to know which plugins to turn off locally.
 */
export function detectGlobalAgents(
  home: string = process.env["HOME"] ?? homedir(),
): ConvivenciaReport {
  const report: ConvivenciaReport = {
    hooksAjenos: [],
    bypassPermissions: false,
    pluginsActivados: [],
    denyRelativos: [],
    outputStyleGlobal: null,
    mcpServers: [],
  };

  const claude = readJson(join(home, ".claude", "settings.json"));
  if (claude) {
    report.hooksAjenos = hooksOf(claude);
    const permissions = claude["permissions"] as
      { defaultMode?: unknown; deny?: unknown } | undefined;
    if (permissions?.defaultMode === "bypassPermissions") report.bypassPermissions = true;
    if (Array.isArray(permissions?.deny)) {
      report.denyRelativos = (permissions.deny as unknown[])
        .filter((r): r is string => typeof r === "string")
        .filter((r) => /\(\.[a-zA-Z]/.test(r)); // `Read(.ssh/*)`, not `Read(~/.ssh/**)`
    }
    const enabled = claude["enabledPlugins"] as Record<string, unknown> | undefined;
    if (enabled) {
      report.pluginsActivados = Object.entries(enabled)
        .filter(([, on]) => on === true)
        .map(([id]) => id);
    }
    if (typeof claude["outputStyle"] === "string") report.outputStyleGlobal = claude["outputStyle"];
  }

  const opencode = readJson(join(home, ".config", "opencode", "opencode.json"));
  if (opencode) report.mcpServers.push(...mcpServersOf(opencode, "global"));

  return report;
}

/** The project's own `.mcp.json` (Claude Code) and `opencode.json`, as `mcpServers`. */
export function projectMcpServers(root: string): McpServidor[] {
  const found: McpServidor[] = [];
  const mcpJson = readJson(join(root, ".mcp.json"));
  if (mcpJson) {
    const servers = (mcpJson["mcpServers"] as Record<string, { type?: string }> | undefined) ?? {};
    for (const [nombre, s] of Object.entries(servers)) {
      found.push({
        nombre,
        transporte: s?.type === "remote" ? "remoto" : "local",
        origen: "proyecto",
      });
    }
  }
  const opencode = readJson(join(root, "opencode.json"));
  if (opencode) found.push(...mcpServersOf(opencode, "proyecto"));
  return found;
}
