import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadConfig } from "../core/config.js";
import { loadDisciplines } from "../core/disciplines.js";
import { readKey, readLog, verifyChain, keyPath } from "../core/gate.js";
import { CONFIG_FILE, findProjectRoot, packageVersion } from "../core/paths.js";
import { loadState } from "../core/state.js";
import { agentFilesComplete } from "../agents/files.js";
import { GitNexusProvider } from "../codeintel/gitnexus.js";
import { withMemPalace } from "../memory/mempalace.js";
import { out } from "./shared.js";

type Level = "ok" | "aviso" | "error";

interface Check {
  level: Level;
  name: string;
  detail: string;
}

const ICON: Record<Level, string> = { ok: "✓", aviso: "!", error: "✗" };

function tool(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 20_000 });
  return result.error || result.status !== 0 ? null : (result.stdout.trim().split("\n")[0] ?? "");
}

export default async function run(): Promise<number> {
  const checks: Check[] = [];
  const add = (level: Level, name: string, detail: string): void =>
    void checks.push({ level, name, detail });

  const major = Number(process.versions.node.split(".")[0]);
  add(
    major >= 24 ? "ok" : "error",
    "Node.js",
    `${process.versions.node}${major >= 24 ? "" : " (se requiere ≥ 24)"}`,
  );
  add("ok", "evol", packageVersion());

  const git = tool("git", ["--version"]);
  add(git ? "ok" : "error", "Git", git ?? "no está instalado");

  const root = findProjectRoot();
  let memoryEnabled = true;
  if (!root) {
    add(
      "aviso",
      "Proyecto",
      `no hay ${CONFIG_FILE} aquí; se omiten las comprobaciones del proyecto`,
    );
  } else {
    try {
      const config = loadConfig(root, loadDisciplines());
      memoryEnabled = config.memory.enabled;
      add(
        "ok",
        "Configuración",
        `${config.name}: ${config.modules.length} módulo(s), proveedor de código «${config.codeIntel}»`,
      );
      const state = loadState(root);
      add("ok", "Estado del pipeline", `fase actual: ${state.currentPhase}`);
      const key = readKey(state.projectId);
      if (!key)
        add(
          "error",
          "Clave del gate",
          `falta ${keyPath(state.projectId)} (no se guarda en el repositorio)`,
        );
      else {
        const chain = verifyChain(readLog(root), key);
        add(
          chain.ok ? "ok" : "error",
          "Registro de aprobaciones",
          chain.ok ? "íntegro" : `no íntegro (entrada ${chain.seq}: ${chain.reason})`,
        );
      }
      const agents = agentFilesComplete(root);
      add(
        agents.ok ? "ok" : "aviso",
        "Integración con agentes",
        agents.ok ? "completa" : `falta ${agents.missing.join(", ")} (evol agents lo crea)`,
      );
      if (config.codeIntel === "gitnexus") {
        const availability = await new GitNexusProvider().available();
        add(
          availability.ok ? "ok" : "error",
          "GitNexus (proveedor configurado)",
          availability.detail,
        );
      }
    } catch (error) {
      add("error", "Proyecto", (error as Error).message.split("\n")[0] ?? "error");
    }
  }

  try {
    const status = await withMemPalace((m) => m.status(), { timeoutMs: 60_000 });
    const drawers = status["total_drawers"];
    add(
      "ok",
      "MemPalace",
      `conectado${typeof drawers === "number" ? ` (${drawers} recuerdos)` : ""}`,
    );
  } catch (error) {
    const detail = ((error as Error).message.split("\n")[0] ?? "no disponible").replace(
      /^No se pudo usar MemPalace:\s*/,
      "",
    );
    add(
      memoryEnabled ? "error" : "aviso",
      "MemPalace",
      `${detail} — instálalo con «uv tool install mempalace»`,
    );
  }

  if (!root || !existsSync(CONFIG_FILE)) {
    const nexus = await new GitNexusProvider().available();
    add("aviso", "GitNexus (opcional)", nexus.ok ? nexus.detail : "no instalado (es opcional)");
  }

  for (const c of checks) out(`${ICON[c.level]} ${c.name}: ${c.detail}`);
  const errors = checks.filter((c) => c.level === "error").length;
  out(errors === 0 ? "\nTodo en orden." : `\n${errors} problema(s) por resolver.`);
  return errors === 0 ? 0 : 1;
}
