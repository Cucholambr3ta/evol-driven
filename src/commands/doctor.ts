import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadConfig } from "../core/config.js";
import { loadDisciplines } from "../core/disciplines.js";
import { readKey, readLog, verifyChain, keyPath } from "../core/gate.js";
import { CONFIG_FILE, findProjectRoot } from "../core/paths.js";
import { loadState } from "../core/state.js";
import { adapterMissing, CLAUDE_CODE, detectIdes, OTHER_ADAPTERS } from "../agents/adapters.js";
import { agentFilesComplete } from "../agents/files.js";
import { GitNexusProvider } from "../codeintel/gitnexus.js";
import { withMemPalace } from "../memory/mempalace.js";
import { securityToolStatus } from "../security/tools.js";
import { describeVersion, versionInfo, compareVersions } from "../release/version.js";
import { verifyIntegrity } from "../release/integrity.js";
import { embeddingsReachable, engineInstalled, storeDir } from "../knowledge/engine.js";
import { readRegistry } from "../knowledge/store.js";
import { indexedLibraries } from "../knowledge/engine.js";
import { libraryDir, listSkills } from "../skills/library.js";
import { pendingApprovals, readManifest } from "../skills/manifest.js";
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
  const info = versionInfo();
  add("ok", "evol", describeVersion(info));
  if (info.canal === "estable") {
    const integrity = verifyIntegrity(info.raiz);
    if (integrity.sinRegistro)
      add("aviso", "Integridad de evol", "la copia instalada no trae su registro de integridad");
    else if (integrity.ok) add("ok", "Integridad de evol", "la copia instalada no ha cambiado");
    else
      add(
        "error",
        "Integridad de evol",
        `la copia instalada se modificó (${[...integrity.modificados, ...integrity.faltan, ...integrity.nuevos].slice(0, 3).join(", ")}…): las mejoras se hacen en el origen, no aquí; reinstálala con evol update`,
      );
  } else if (info.canal === "origen" && process.env["EVOL_ORIGIN_OK"] !== "1")
    add(
      "aviso",
      "Canal",
      "estás usando el origen del framework, no la copia estable: cualquier cambio que hagas en él afecta a todos los proyectos que lo usen",
    );

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
      if (state.creadoCon) {
        const newer = compareVersions(state.creadoCon.version, info.version) > 0;
        add(
          newer ? "aviso" : "ok",
          "Versión con la que se creó el proyecto",
          `${state.creadoCon.version} (${state.creadoCon.canal})${newer ? `: es más nueva que la de este evol (${info.version}); actualízalo` : ""}`,
        );
      }
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

  // Skills that had the person's approval and lost it in an update: what they must give again.
  try {
    const library = libraryDir();
    const waiting = pendingApprovals(listSkills(library), readManifest(library));
    const lost = waiting.filter((w) => w.motivo === "perdio-aprobacion");
    if (lost.length > 0)
      add(
        "aviso",
        "Skills",
        `${lost.length} perdieron tu aprobación tras actualizar (${lost.map((w) => w.id).join(", ")}): evol skills list --pendientes`,
      );
    else if (waiting.length > 0)
      add(
        "ok",
        "Skills",
        `${waiting.length} sin aprobar (evol skills list --pendientes); ninguna de las que ya habías aprobado`,
      );
  } catch (error) {
    add(
      "aviso",
      "Skills",
      (error as Error).message.split("\n")[0] ?? "no se pudo leer la biblioteca",
    );
  }

  // The reference documentation is optional: without it nothing else fails, so these are never errors.
  try {
    const sources = Object.values(readRegistry().fuentes).filter((s) => s.estado === "revisada");
    if (sources.length === 0)
      add("aviso", "Conocimiento", "no hay fuentes revisadas (evol knowledge source add)");
    else if (!engineInstalled())
      add("aviso", "Conocimiento", `${sources.length} fuente(s) revisada(s), pero falta el motor`);
    else {
      const indexed = (await indexedLibraries()).filter((l) => l.documentos > 0).length;
      const embeds = await embeddingsReachable();
      add(
        indexed === sources.length && embeds ? "ok" : "aviso",
        "Conocimiento",
        `${indexed} de ${sources.length} fuente(s) indexadas en ${storeDir()}; embeddings locales ${embeds ? "disponibles" : "no responden (la búsqueda por significado no funcionará)"}`,
      );
    }
  } catch (error) {
    add("aviso", "Conocimiento", (error as Error).message.split("\n")[0] ?? "no disponible");
  }

  // `evol security scan` and `evol skills audit` lean on these; a missing one is a warning here,
  // and it is what makes the scan fail with --ci or leaves every skill «no auditada».
  for (const t of await securityToolStatus())
    add(t.instalada ? "ok" : "aviso", `Seguridad: ${t.tool}`, t.detalle);

  // The IDEs of the matrix that are on this machine, and what each one can do (level A, B or C).
  const ides = detectIdes();
  const found = ides.filter((d) => d.detectado);
  if (found.length === 0)
    add(
      "aviso",
      "IDE de agentes",
      "no se detectó ninguno (Claude Code, Codex, Antigravity, OpenCode ni Hermes)",
    );
  for (const d of found) {
    const other = OTHER_ADAPTERS.find((a) => a.id === d.id);
    const adapter = d.id === "claude-code" ? CLAUDE_CODE : other;
    if (!adapter) continue;
    const readOnly =
      adapter.proteccion.soloLectura === "impuesta"
        ? "subagentes de solo lectura impuestos por el IDE"
        : "subagentes de solo lectura solo por instrucción";
    const block =
      adapter.proteccion.aprobar === "instalada"
        ? "bloqueo de aprobar instalado"
        : adapter.proteccion.aprobar === "manual"
          ? "bloqueo de aprobar parcial (lo completa la terminal)"
          : "bloqueo de aprobar por confirmar";
    const missing = root && other && existsSync(CONFIG_FILE) ? adapterMissing(root, other) : [];
    add(
      missing.length > 0 ? "aviso" : "ok",
      `IDE ${d.nombre}`,
      `nivel ${d.nivel} (subagentes nativos); entrada ${adapter.entrada}; ${readOnly}; ${block}${
        missing.length > 0
          ? `; falta ${missing.join(", ")} (evol agents --ide ${d.id} lo crea)`
          : ""
      }`,
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
