import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { orchestratorBody } from "./orchestrator.js";

export interface AgentReport {
  created: string[];
  updated: string[];
  unchanged: string[];
  skipped: { file: string; reason: string }[];
}

const GENERATED = "<!-- evol:generated -->";
const BEGIN = "<!-- evol:begin -->";
const END = "<!-- evol:end -->";
export const HOOK_COMMAND = "evol hook session-start";

const COMMANDS: Record<string, string> = {
  "evol-status.md": `---
description: Estado del pipeline evol: fase actual, qué falta y qué sigue
---

${GENERATED}

Ejecuta \`evol status\` (o la herramienta \`evol_status\` del MCP \`evol\`) y, si quieres saber si la
fase ya cumple, \`evol_verify\`.

Resume en pocas líneas: la fase actual, los artefactos que faltan o siguen con \`[[COMPLETAR]]\` y
qué disciplina los exige.

No ejecutes \`evol approve\` ni \`evol next\`: aprobar y avanzar de fase lo hace la persona, en su
terminal.
`,
  "evol-fase.md": `---
description: Ayuda a completar los artefactos de la fase actual de evol
argument-hint: [indicaciones opcionales]
---

${GENERATED}

1. Mira la fase y sus disciplinas con \`evol status\`.
2. Lee los artefactos que ya existen y localiza los marcadores \`[[COMPLETAR]]\`.
3. Redacta con la persona lo que falta. Pregunta lo que no sepas: no inventes requisitos.
4. Comprueba con \`evol_verify\` (o \`evol status\`) hasta que no queden problemas.
5. Cuando todo verifique, dile a la persona que ejecute ella misma \`evol approve <fase>\` y después
   \`evol next\`. Nunca lo hagas por ella.

Indicaciones adicionales: $ARGUMENTS
`,
  "evol-impacto.md": `---
description: Mide el alcance de un cambio antes de editar un símbolo
argument-hint: <símbolo>
---

${GENERATED}

Antes de modificar \`$ARGUMENTS\`, ejecuta \`evol impact $ARGUMENTS\` (o la herramienta \`evol_impact\`).

Resume qué depende de él, directa y transitivamente, y qué tests lo cubren. Propón qué pruebas
ejecutar después del cambio. Si el nombre es ambiguo, usa el id completo que devuelve \`evol\`.
`,
  "evol-memoria.md": `---
description: Guarda o consulta memoria del proyecto (MemPalace)
argument-hint: <decision|leccion|contexto> <texto>   |   buscar <consulta>
---

${GENERATED}

Si \`$ARGUMENTS\` empieza por \`buscar\`, ejecuta \`evol memory search "<consulta>"\` y resume lo hallado.

En otro caso guarda lo indicado con \`evol memory add --tipo <tipo> --texto "<texto>"\` (o la
herramienta \`evol_memory_add\`). Las lecciones también se escriben en \`lecciones.md\`, que la fase
retro exige. No guardes secretos.
`,
};

/** The command files for Claude Code: the fixed helpers plus `/evol`, generated from the orchestrator skill. */
function commandFiles(): Record<string, string> {
  return {
    "evol.md": `---
description: Orquesta el proyecto: lee el estado, propone el siguiente paso, reparte el trabajo y se detiene ante cada aprobación
argument-hint: [qué quieres hacer, o nada para ver el estado]
---

${GENERATED}

${orchestratorBody()}

Lo que la persona pide ahora: $ARGUMENTS
`,
    ...COMMANDS,
  };
}

function claudeBlock(): string {
  return `${BEGIN}

## Flujo de trabajo con evol

Este proyecto sigue el pipeline de \`evol\`: briefing → spec → plan → build → qa → retro.

- Al empezar, mira la fase con \`evol status\` (o \`/evol-status\`).
- **Aprobar (\`evol approve\`) y avanzar (\`evol next\`) lo hace siempre una persona**, en su terminal.
  No los ejecutes ni intentes saltarte la aprobación.
- Los archivos con \`[[COMPLETAR]]\` están sin escribir: complétalos antes de pedir la aprobación.
- Antes de modificar un símbolo, mide su alcance con \`evol impact <símbolo>\` (\`/evol-impacto\`).
- Guarda decisiones y lecciones con \`evol memory add\` (\`/evol-memoria\`) y consulta con
  \`evol memory search\`.
- El MCP \`evol\` (\`.mcp.json\`) ofrece las consultas como herramientas de solo lectura.

${END}
`;
}

function write(root: string, rel: string, content: string, report: AgentReport): void {
  const file = join(root, rel);
  const existed = existsSync(file);
  if (existed && readFileSync(file, "utf8") === content) {
    report.unchanged.push(rel);
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  (existed ? report.updated : report.created).push(rel);
}

function readJson(
  root: string,
  rel: string,
  report: AgentReport,
): { data: Record<string, unknown>; exists: boolean } | null {
  const file = join(root, rel);
  if (!existsSync(file)) return { data: {}, exists: false };
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown>, exists: true };
    }
  } catch {
    // fall through
  }
  report.skipped.push({ file: rel, reason: "no es un JSON válido; no se tocó" });
  return null;
}

/** JSON in Prettier's style: short arrays of plain values stay on one line. */
export function formatJson(value: unknown, depth = 0): string {
  const pad = "  ".repeat(depth + 1);
  const end = "  ".repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => v === null || typeof v !== "object")) {
      return `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
    }
    return `[\n${value.map((v) => pad + formatJson(v, depth + 1)).join(",\n")}\n${end}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const lines = entries.map(
      ([k, v]) => `${pad}${JSON.stringify(k)}: ${formatJson(v, depth + 1)}`,
    );
    return `{\n${lines.join(",\n")}\n${end}}`;
  }
  return JSON.stringify(value);
}

function writeJson(
  root: string,
  rel: string,
  data: Record<string, unknown>,
  report: AgentReport,
): void {
  write(root, rel, `${formatJson(data)}\n`, report);
}

function hasHook(settings: Record<string, unknown>): boolean {
  const hooks = settings["hooks"] as Record<string, unknown> | undefined;
  const entries = hooks?.["SessionStart"];
  if (!Array.isArray(entries)) return false;
  return entries.some((entry: { hooks?: { command?: string }[] }) =>
    entry.hooks?.some((h) => h.command === HOOK_COMMAND),
  );
}

/**
 * Creates or refreshes the files that make Claude Code (and any MCP client) follow the pipeline.
 * It never overwrites what is not evol's: user files are only extended with evol's own entries.
 */
export function writeAgentFiles(root: string): AgentReport {
  const report: AgentReport = { created: [], updated: [], unchanged: [], skipped: [] };

  for (const [name, content] of Object.entries(commandFiles())) {
    const rel = `.claude/commands/${name}`;
    const file = join(root, rel);
    if (existsSync(file) && !readFileSync(file, "utf8").includes(GENERATED)) {
      report.skipped.push({ file: rel, reason: "ya existe y no es de evol; no se tocó" });
      continue;
    }
    write(root, rel, content, report);
  }

  const claudeFile = join(root, "CLAUDE.md");
  const block = claudeBlock();
  if (!existsSync(claudeFile)) {
    write(root, "CLAUDE.md", `# Instrucciones para agentes\n\n${block}`, report);
  } else {
    const current = readFileSync(claudeFile, "utf8");
    const start = current.indexOf(BEGIN);
    const end = current.indexOf(END);
    const next =
      start !== -1 && end > start
        ? `${current.slice(0, start)}${block.trimEnd()}${current.slice(end + END.length)}`
        : `${current.trimEnd()}\n\n${block}`;
    write(root, "CLAUDE.md", next, report);
  }

  const settings = readJson(root, ".claude/settings.json", report);
  if (settings) {
    if (hasHook(settings.data)) report.unchanged.push(".claude/settings.json");
    else {
      const hooks = (settings.data["hooks"] ?? {}) as Record<string, unknown>;
      const existing = Array.isArray(hooks["SessionStart"]) ? hooks["SessionStart"] : [];
      hooks["SessionStart"] = [
        ...existing,
        { hooks: [{ type: "command", command: HOOK_COMMAND, timeout: 30 }] },
      ];
      writeJson(root, ".claude/settings.json", { ...settings.data, hooks }, report);
    }
  }

  const mcp = readJson(root, ".mcp.json", report);
  if (mcp) {
    const servers = (mcp.data["mcpServers"] ?? {}) as Record<string, unknown>;
    if (servers["evol"]) report.unchanged.push(".mcp.json");
    else {
      servers["evol"] = { command: "evol", args: ["mcp"] };
      writeJson(root, ".mcp.json", { ...mcp.data, mcpServers: servers }, report);
    }
  }
  return report;
}

/** True when everything `writeAgentFiles` manages is already in place. */
export function agentFilesComplete(root: string): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const name of Object.keys(commandFiles())) {
    if (!existsSync(join(root, ".claude", "commands", name)))
      missing.push(`.claude/commands/${name}`);
  }
  const claude = join(root, "CLAUDE.md");
  if (!existsSync(claude) || !readFileSync(claude, "utf8").includes(BEGIN))
    missing.push("CLAUDE.md");
  const settings = readJson(root, ".claude/settings.json", {
    created: [],
    updated: [],
    unchanged: [],
    skipped: [],
  });
  if (!settings || !hasHook(settings.data)) missing.push(".claude/settings.json (hook)");
  const mcp = readJson(root, ".mcp.json", { created: [], updated: [], unchanged: [], skipped: [] });
  const servers = mcp?.data["mcpServers"] as Record<string, unknown> | undefined;
  if (!servers?.["evol"]) missing.push(".mcp.json (servidor evol)");
  return { ok: missing.length === 0, missing };
}
