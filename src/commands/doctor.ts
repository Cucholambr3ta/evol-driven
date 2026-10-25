import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadConfig } from "../core/config.js";
import { loadDisciplines } from "../core/disciplines.js";
import { expectedPhase, readKey, readLog, verifyChain, keyPath } from "../core/gate.js";
import { CONFIG_FILE, findProjectRoot, packageRoot } from "../core/paths.js";
import { loadState } from "../core/state.js";
import { adapterMissing, CLAUDE_CODE, detectIdes, OTHER_ADAPTERS } from "../agents/adapters.js";
import { agentFilesComplete } from "../agents/files.js";
import { detectGlobalAgents, projectMcpServers } from "../agents/convivencia.js";
import { GitNexusProvider } from "../codeintel/gitnexus.js";
import { withMemPalace } from "../memory/mempalace.js";
import { securityToolStatus } from "../security/tools.js";
import {
  describeVersion,
  versionInfo,
  compareVersions,
  readInstallRecord,
} from "../release/version.js";
import { verifyIntegrity } from "../release/integrity.js";
import { checkUpdateNotice } from "../release/notice.js";
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

/** The 9 categories CA-134 protects, as `evol doctor` names them in the convivencia section. */
const RUTAS_PROTEGIDAS = [
  "~/.ssh",
  ".env / .env.*",
  "*.pem",
  "*.key",
  "~/.aws/credentials",
  ".evol/state.json",
  ".evol/gate-log.jsonl",
  "evol ciclo*",
  "la clave del gate (~/.config/evol/keys)",
];

function tool(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 20_000 });
  return result.error || result.status !== 0 ? null : (result.stdout.trim().split("\n")[0] ?? "");
}

/** Where to look for a newer version (criterio 145): `EVOL_UPDATE_REPO` for tests, else the record
 * `evol update` left, else the origin's git remote. `null` means nothing to check against. */
function updateRepo(): string | null {
  const explicit = process.env["EVOL_UPDATE_REPO"];
  if (explicit) return explicit;
  const record = readInstallRecord(packageRoot());
  if (record) return record.repositorio;
  const remote = spawnSync("git", ["-C", packageRoot(), "remote", "get-url", "origin"], {
    encoding: "utf8",
  });
  return remote.status === 0 && remote.stdout.trim() ? remote.stdout.trim() : null;
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

  // Arrancan ya, en paralelo con todo lo que sigue (criterio 145: entre las dos, más de 2,5 s en
  // serie antes de que exista ningún aviso de versión nueva). Capturadas en lugar de esperadas: se
  // consumen más abajo, una vez se conocen datos que solo salen de leer el proyecto (memoryEnabled).
  const mempalacePromise = withMemPalace((m) => m.status(), { timeoutMs: 60_000 }).then(
    (status) => ({ ok: true as const, status }),
    (error: unknown) => ({ ok: false as const, error: error as Error }),
  );
  const securityPromise = securityToolStatus();

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
        const log = readLog(root);
        const chain = verifyChain(log, key);
        add(
          chain.ok ? "ok" : "error",
          "Registro de aprobaciones",
          chain.ok ? "íntegro" : `no íntegro (entrada ${chain.seq}: ${chain.reason})`,
        );
        // state.json es una caché del registro firmado (criterio 134): si alguien lo edita a mano
        // para simular una fase ya aprobada, esto lo detecta aunque la cadena siga íntegra.
        if (chain.ok) {
          const expected = expectedPhase(log);
          if (expected !== null && expected !== state.currentPhase) {
            add(
              "error",
              "Fase y aprobaciones",
              `la fase de .evol/state.json («${state.currentPhase}») no concuerda con la última ` +
                `aprobación válida del registro firmado (debería ser «${expected}»)`,
            );
          }
        }
      }
      const agents = agentFilesComplete(root);
      add(
        agents.ok ? "ok" : "aviso",
        "Integración con agentes",
        agents.ok ? "completa" : `falta ${agents.missing.join(", ")} (evol agents lo crea)`,
      );

      // Convivencia con otra configuración global de agentes (criterios 135, 136, 149): solo lee
      // y clasifica, nunca cambia nada fuera del proyecto.
      const globalAgents = detectGlobalAgents();
      for (const h of globalAgents.hooksAjenos) {
        add(
          "aviso",
          "Convivencia",
          `hook global «${h.evento}» (${h.comando}) no anulable: solo se informa`,
        );
      }
      if (globalAgents.bypassPermissions) {
        add(
          "aviso",
          "Convivencia",
          "el modo de permisos global es bypassPermissions: ejecuta todo sin preguntar en cualquier proyecto, incluido este",
        );
      }
      if (globalAgents.denyRelativos.length > 0) {
        add(
          "aviso",
          "Convivencia",
          `regla de bloqueo global con ruta relativa (${globalAgents.denyRelativos.join(", ")}): solo protege si se trabaja desde la carpeta personal`,
        );
      }
      for (const ruta of RUTAS_PROTEGIDAS) {
        add(
          "ok",
          "Convivencia",
          `${ruta}: regla impuesta por el IDE (leer por un script fuera de él no queda cubierto)`,
        );
      }
      const mcpServers = [...globalAgents.mcpServers, ...projectMcpServers(root)];
      for (const s of mcpServers) {
        add(
          s.transporte === "remoto" ? "aviso" : "ok",
          "Convivencia",
          `servidor MCP «${s.nombre}» (${s.origen}, ${s.transporte})${s.transporte === "remoto" ? ": salida de datos del proyecto hacia un servicio remoto" : ""}`,
        );
      }

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

  const mempalace = await mempalacePromise;
  if (mempalace.ok) {
    const drawers = mempalace.status["total_drawers"];
    add(
      "ok",
      "MemPalace",
      `conectado${typeof drawers === "number" ? ` (${drawers} recuerdos)` : ""}`,
    );
  } else {
    const detail = (mempalace.error.message.split("\n")[0] ?? "no disponible").replace(
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
  for (const t of await securityPromise)
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

  // Aviso de versión nueva (criterio 145): nunca a costa de la velocidad ni sin la persona pudiendo
  // apagarlo, y solo cuenta una versión que lleva firma.
  const notice = checkUpdateNotice(updateRepo(), info.version);
  if (notice) {
    const skills =
      notice.skillsQuePerderianAprobacion.length > 0
        ? ` Perderían su aprobación y volverían a pedirla: ${notice.skillsQuePerderianAprobacion.join(", ")}.`
        : "";
    add(
      "aviso",
      "Versión nueva",
      `hay una versión más nueva y firmada: ${notice.versionNueva} (tienes ${info.version}). Instálala con evol update.${skills}`,
    );
  }

  for (const c of checks) out(`${ICON[c.level]} ${c.name}: ${c.detail}`);
  const errors = checks.filter((c) => c.level === "error").length;
  out(errors === 0 ? "\nTodo en orden." : `\n${errors} problema(s) por resolver.`);
  return errors === 0 ? 0 : 1;
}
