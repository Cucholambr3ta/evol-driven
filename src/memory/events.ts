import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { userInfo } from "node:os";
import type { EvolConfig } from "../core/config.js";
import { journalAppend } from "../core/journal.js";
import type { Recorder } from "../core/pipeline.js";
import { withMemPalace } from "./mempalace.js";
import type { MemPalaceOptions } from "./mempalace.js";

export type MemoryKind = "decision" | "leccion" | "contexto" | "aprobacion" | "pipeline";

export const ROOMS: Record<MemoryKind, string> = {
  decision: "decisiones",
  leccion: "lecciones",
  contexto: "contexto",
  aprobacion: "aprobaciones",
  pipeline: "pipeline",
};

export function isMemoryKind(value: string): value is MemoryKind {
  return value in ROOMS;
}

/** Appends a lesson to lecciones.md in the project (the file the retro phase checks). */
export function appendLesson(root: string, title: string, text: string): void {
  const file = join(root, "lecciones.md");
  const date = new Date().toISOString().slice(0, 10);
  const entry = `\n### ${title} — ${date}\n\n${text}\n`;
  if (existsSync(file)) appendFileSync(file, entry);
  else writeFileSync(file, `# Lecciones\n${entry}`);
}

export function lessonCount(root: string): number {
  const file = join(root, "lecciones.md");
  return existsSync(file) ? (readFileSync(file, "utf8").match(/^###\s+\S/gm) ?? []).length : 0;
}

/**
 * Saves into the project's MemPalace wing. Throws when MemPalace is unavailable:
 * explicit memory commands must fail loudly.
 */
export async function remember(
  config: EvolConfig,
  kind: MemoryKind,
  content: string,
  options: MemPalaceOptions = {},
): Promise<string> {
  return withMemPalace(
    (memory) =>
      memory.addDrawer({
        wing: config.memory.wing,
        room: ROOMS[kind],
        content,
        source: `evol:${kind}`,
        addedBy: `evol:${userInfo().username}`,
      }),
    options,
  );
}

/**
 * Pipeline events are always journaled locally; they also go to MemPalace when enabled,
 * but a MemPalace failure only produces a warning (it must not block the pipeline).
 */
export function makeRecorder(
  root: string,
  config: EvolConfig,
  warn: (message: string) => void,
  options: MemPalaceOptions = {},
): Recorder {
  return async (type, data) => {
    journalAppend(root, type, data);
    if (!config.memory.enabled) return;
    const kind: MemoryKind = type === "approved" ? "aprobacion" : "pipeline";
    try {
      await remember(config, kind, `${type}: ${JSON.stringify(data)}`, options);
    } catch (error) {
      warn(
        `MemPalace no registró «${type}» (queda en .evol/journal.jsonl): ${(error as Error).message.split("\n")[0]}`,
      );
    }
  };
}
