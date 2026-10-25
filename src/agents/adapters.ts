import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { SUBAGENT_ROLES } from "../core/roles.js";
import type { RoleId } from "../core/roles.js";
import { orchestratorBody, orchestratorDescription } from "./orchestrator.js";
import { roleDescription } from "./roles.js";

/**
 * One adapter per IDE. The orchestrator and the roles are written once (as skills); an adapter only
 * puts them where its IDE looks and in the format its IDE reads, and says what it could not do. What
 * an IDE's own agent confirmed (docs/design/consultas) is generated; what is still unconfirmed, or
 * lives in a file of the person's own (global MCP configuration, permission rules), is printed as a
 * fragment for them to apply: an adapter never edits what is not the project's.
 */

export type IdeId = "claude-code" | "codex" | "antigravity" | "opencode" | "hermes";
export type Level = "A" | "B" | "C";

/** Level A: native subagents. B: a command, no subagents. C: instructions and MCP only. */
export interface AdapterFile {
  rel: string;
  content: string;
}

export interface Fragment {
  /** The file the person would put it in. */
  archivo: string;
  texto: string;
  nota: string;
}

export interface Protection {
  /** What stops the agent from approving a phase or moving the pipeline on. */
  aprobar: "instalada" | "manual" | "por-confirmar";
  detalle: string;
  /** Whether the read-only promise of `verificador` and `seguridad` is enforced by the IDE or only asked. */
  soloLectura: "impuesta" | "solo-instruccion" | "sin-subagentes";
}

export interface Adapter {
  id: IdeId;
  nombre: string;
  nivel: Level;
  /** How a person starts the orchestrator. */
  entrada: string;
  deteccion: { binarios: string[]; carpetas: string[] };
  /** Project files evol generates and keeps up to date (each one carries evol's marker). */
  archivos(): AdapterFile[];
  fragmentos(): Fragment[];
  proteccion: Protection;
}

export const MARKER = "evol:generated";
const MD_MARK = `<!-- ${MARKER} -->`;
const TOML_MARK = `# ${MARKER}`;

const LOAD = (role: RoleId): string => `Carga la skill \`${role}\` y haz la tarea que te pasen.`;
/** A value written between quotes, so it stays one string whatever it contains (JSON strings are valid YAML and TOML). */
const q = (value: string): string => JSON.stringify(value);

export const ENTRY_NOTE =
  "La skill `evol` es la fuente del orquestador; este archivo se genera de ella al ejecutar `evol agents`.";

/** The instructions block every IDE reads: no project state in it, only the way of working. */
export function instructionsBlock(): string {
  return `<!-- evol:begin -->

## Flujo de trabajo con evol

Este proyecto sigue el pipeline de \`evol\`: briefing → spec → plan → build → qa → retro.

- Para trabajar en el proyecto escribe \`/evol\` (en Codex, la skill \`$evol\`): lee el estado, propone el siguiente paso y reparte el trabajo. Sin
  argumentos solo muestra el estado, sin modificar nada.
- El estado se consulta con \`evol status --json\`; lo que falta de la fase anterior, con \`evol prerequisites --json\`.
- **Aprobar (\`evol approve\`) y avanzar (\`evol next\`) lo hace siempre una persona**, en su terminal.
  No los ejecutes ni intentes saltarte la aprobación.
- Los archivos con \`[[COMPLETAR]]\` están sin escribir: complétalos antes de pedir la aprobación.
- La revisión de \`verificador\` y \`seguridad\` se hace con contexto limpio y en solo lectura, sin cambiar nada.
- **No modifiques el framework evol desde este proyecto** (su copia instalada es de solo lectura). Si encuentras algo que mejorar, anótalo con \`evol mejora add "…"\`: se atiende en el origen del framework.

<!-- evol:end -->
`;
}

const subagentRoles = (): { role: RoleId; description: string }[] =>
  SUBAGENT_ROLES.map((role) => ({ role, description: roleDescription(role) }));

/* ------------------------------------------------------------------------------------------ */

const codex: Adapter = {
  id: "codex",
  nombre: "Codex",
  nivel: "A",
  entrada: "$evol",
  deteccion: { binarios: ["codex"], carpetas: [".codex"] },
  archivos: () => [
    // Codex has no custom `/` commands: the entry point is a skill, called with `$evol`
    {
      rel: ".agents/skills/evol/SKILL.md",
      content: `---\nname: evol\ndescription: ${q(orchestratorDescription())}\n---\n\n${MD_MARK}\n\n${orchestratorBody()}\n`,
    },
    ...subagentRoles().map(({ role, description }) => ({
      rel: `.codex/agents/${role}.toml`,
      content: `${TOML_MARK}\nname = ${q(role)}\ndescription = ${q(description)}\ndeveloper_instructions = ${q(LOAD(role))}\n`,
    })),
  ],
  fragmentos: () => [
    {
      archivo: ".codex/config.toml (solo se carga si el repositorio es de confianza)",
      texto: `[mcp_servers.evol]\ncommand = "evol"\nargs = ["mcp"]\n\n[agents]\nmax_concurrent_threads_per_session = 3\n`,
      nota: "El servidor MCP de evol y el tope de hilos de subagentes (3, el valor por defecto de evol).",
    },
    {
      archivo: ".codex/rules/evol.rules (por confirmar el formato exacto)",
      texto: `Una regla «forbidden» para los comandos «evol approve» y «evol next».`,
      nota: "Las reglas de Codex solo cubren lo que corre fuera del sandbox: se refuerza con la instrucción de AGENTS.md y con que la CLI exige una terminal para aprobar.",
    },
  ],
  proteccion: {
    aprobar: "manual",
    detalle:
      "regla `forbidden` en .codex/rules (solo cubre lo que corre fuera del sandbox); la protección real es que evol approve exige una terminal",
    soloLectura: "solo-instruccion",
  },
};

const antigravity: Adapter = {
  id: "antigravity",
  nombre: "Antigravity",
  nivel: "A",
  entrada: "/evol",
  deteccion: { binarios: ["antigravity", "agy"], carpetas: [".gemini", ".antigravity"] },
  archivos: () => [
    {
      rel: ".agents/workflows/evol.md",
      content: `---\ndescription: ${q(orchestratorDescription())}\n---\n\n${MD_MARK}\n\n${orchestratorBody()}\n`,
    },
    ...subagentRoles().map(({ role, description }) => ({
      rel: `.agents/agents/${role}.md`,
      // read-only by construction: the only tools it is given are the ones that read
      content: `---\nname: ${role}\ndescription: ${q(description)}\nsubagent: true\ntools:\n  - view_file\n  - grep_search\n  - list_dir\n---\n\n${MD_MARK}\n\n${LOAD(role)}\n`,
    })),
  ],
  fragmentos: () => [
    {
      archivo:
        "~/.gemini/config/mcp_config.json (global: el MCP del proyecto solo va dentro de un plugin)",
      texto: `{\n  "mcpServers": {\n    "evol": { "command": "evol", "args": ["mcp"] }\n  }\n}`,
      nota: "Añade la entrada «evol» a tu configuración global; evol no la edita.",
    },
    {
      archivo:
        ".agents/hooks.json (por confirmar si `PreInvocation` y `PreToolUse` valen en tu versión)",
      texto: `Un gancho PreToolUse con «deny» para «evol approve» y «evol next», y PreInvocation con «evol hook session-start».`,
      nota: "Las fuentes discrepan en si la carpeta es .agent o .agents; aquí se usa .agents, como confirmó el propio IDE.",
    },
  ],
  proteccion: {
    aprobar: "por-confirmar",
    detalle:
      "gancho PreToolUse con deny o la lista de bloqueo de comandos del IDE; por confirmar en tu versión",
    soloLectura: "impuesta",
  },
};

const opencode: Adapter = {
  id: "opencode",
  nombre: "OpenCode",
  nivel: "A",
  entrada: "/evol",
  deteccion: { binarios: ["opencode"], carpetas: [".config/opencode", ".opencode"] },
  archivos: () => [
    {
      rel: ".opencode/commands/evol.md",
      content: `---\ndescription: ${q(orchestratorDescription())}\nagent: build\n---\n\n${MD_MARK}\n\n${orchestratorBody()}\n\nLo que la persona pide ahora: $ARGUMENTS\n`,
    },
    ...subagentRoles().map(({ role, description }) => ({
      rel: `.opencode/agents/${role}.md`,
      // read-only by permission: it can neither edit files nor run shell commands
      content: `---\ndescription: ${q(description)}\nmode: subagent\npermissions:\n  - { action: edit, resource: "*", effect: deny }\n  - { action: shell, resource: "*", effect: deny }\n---\n\n${MD_MARK}\n\n${LOAD(role)}\n`,
    })),
  ],
  fragmentos: () => [
    {
      archivo: "opencode.json (el MCP del proyecto)",
      texto: `{\n  "mcp": {\n    "servers": {\n      "evol": { "command": ["evol", "mcp"] }\n    }\n  }\n}`,
      nota: "Añade la entrada al opencode.json de tu proyecto; el formato exacto de «command» depende de tu versión.",
    },
    {
      archivo: "opencode.json (el bloqueo de approve y next)",
      texto: `{ "action": "shell", "resource": "evol approve *", "effect": "deny" }\n{ "action": "shell", "resource": "evol next*", "effect": "deny" }`,
      nota: "Dos permisos de shell con efecto «deny» (el propio OpenCode confirmó que el de approve funciona).",
    },
  ],
  proteccion: {
    aprobar: "por-confirmar",
    detalle:
      "permiso `shell` con recurso `evol approve *` y efecto `deny`: lo confirmó OpenCode, pero evol no edita opencode.json",
    soloLectura: "impuesta",
  },
};

const hermes: Adapter = {
  id: "hermes",
  nombre: "Hermes",
  nivel: "A",
  entrada: "(sin comando propio confirmado: pide «sigue con el proyecto» o carga la skill evol)",
  deteccion: { binarios: ["hermes"], carpetas: [".hermes"] },
  // Hermes reads AGENTS.md; its subagents are created at run time with delegate_task, so there is
  // nothing to generate for them, and its entry point and hooks are still to be confirmed
  archivos: () => [],
  fragmentos: () => [
    {
      archivo: "~/.hermes/config.yaml (global)",
      texto: `hermes mcp add evol --command evol --args mcp`,
      nota: "El MCP de Hermes es global. Las skills van en ~/.hermes/skills.",
    },
  ],
  proteccion: {
    aprobar: "por-confirmar",
    detalle:
      "por confirmar: no se sabe cómo bloquear comandos en Hermes; la protección real es que evol approve exige una terminal",
    soloLectura: "solo-instruccion",
  },
};

export const OTHER_ADAPTERS: Adapter[] = [codex, antigravity, opencode, hermes];

export const CLAUDE_CODE: Omit<Adapter, "archivos" | "fragmentos"> = {
  id: "claude-code",
  nombre: "Claude Code",
  nivel: "A",
  entrada: "/evol",
  deteccion: { binarios: ["claude"], carpetas: [".claude"] },
  proteccion: {
    aprobar: "instalada",
    detalle: "permissions.deny en .claude/settings.json para `evol approve` y `evol next`",
    soloLectura: "impuesta",
  },
};

export const IDE_IDS: IdeId[] = ["claude-code", "codex", "antigravity", "opencode", "hermes"];

export function adapterById(id: string): Adapter | undefined {
  return OTHER_ADAPTERS.find((a) => a.id === id);
}

/* ------------------------------------------------------------------------------------------ */

export interface Detection {
  id: IdeId;
  nombre: string;
  nivel: Level;
  detectado: boolean;
  /** Where it was seen: the executable, or the folder of its own configuration. */
  donde: string | null;
}

function onPath(name: string, pathEnv: string): string | null {
  for (const dir of pathEnv.split(delimiter)) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Which IDEs are on this machine: by their executable, or by the folder they keep their configuration in. */
export function detectIdes(
  home: string = homedir(),
  pathEnv: string = process.env["PATH"] ?? "",
): Detection[] {
  const all = [CLAUDE_CODE, ...OTHER_ADAPTERS];
  return all.map((a) => {
    const binary =
      a.deteccion.binarios.map((b) => onPath(b, pathEnv)).find((p) => p !== null) ?? null;
    const folder =
      a.deteccion.carpetas.map((c) => join(home, c)).find((p) => existsSync(p)) ?? null;
    return {
      id: a.id,
      nombre: a.nombre,
      nivel: a.nivel,
      detectado: binary !== null || folder !== null,
      donde: binary ?? folder,
    };
  });
}

/* ------------------------------------------------------------------------------------------ */

export interface AdapterReport {
  created: string[];
  updated: string[];
  unchanged: string[];
  skipped: { file: string; reason: string }[];
}

/** Writes what is evol's and leaves alone a file with the same name that is not (it has no marker). */
export function writeAdapterFiles(root: string, adapter: Adapter): AdapterReport {
  const report: AdapterReport = { created: [], updated: [], unchanged: [], skipped: [] };
  for (const f of adapter.archivos()) {
    const file = join(root, f.rel);
    const existed = existsSync(file);
    const current = existed ? readFileSync(file, "utf8") : "";
    if (existed && !current.includes(MARKER)) {
      report.skipped.push({ file: f.rel, reason: "ya existe y no es de evol; no se tocó" });
      continue;
    }
    if (existed && current === f.content) {
      report.unchanged.push(f.rel);
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, f.content);
    (existed ? report.updated : report.created).push(f.rel);
  }
  return report;
}

const BEGIN = "<!-- evol:begin -->";
const END = "<!-- evol:end -->";

/** AGENTS.md: the one instructions file every IDE of the matrix reads; only evol's block is ever rewritten. */
export function writeAgentsMd(root: string): AdapterReport {
  const report: AdapterReport = { created: [], updated: [], unchanged: [], skipped: [] };
  const file = join(root, "AGENTS.md");
  const block = instructionsBlock();
  let next: string;
  if (!existsSync(file)) next = `# Instrucciones para agentes\n\n${block}`;
  else {
    const current = readFileSync(file, "utf8");
    const start = current.indexOf(BEGIN);
    const end = current.indexOf(END);
    next =
      start !== -1 && end > start
        ? `${current.slice(0, start)}${block.trimEnd()}${current.slice(end + END.length)}`
        : `${current.trimEnd()}\n\n${block}`;
    if (next === current) {
      report.unchanged.push("AGENTS.md");
      return report;
    }
  }
  const existed = existsSync(file);
  writeFileSync(file, next);
  (existed ? report.updated : report.created).push("AGENTS.md");
  return report;
}

/** Whether every file an adapter generates is in the project: the missing ones, by path. */
export function adapterMissing(root: string, adapter: Adapter): string[] {
  return adapter
    .archivos()
    .filter((f) => !existsSync(join(root, f.rel)))
    .map((f) => f.rel);
}
