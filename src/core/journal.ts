import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { evolPath } from "./paths.js";

export interface JournalEvent {
  ts: string;
  type: string;
  [key: string]: unknown;
}

/** Append-only local record of what happened. It exists even when MemPalace is unavailable. */
export function journalAppend(root: string, type: string, data: Record<string, unknown>): void {
  const file = evolPath(root, "journal.jsonl");
  mkdirSync(dirname(file), { recursive: true });
  const event: JournalEvent = { ts: new Date().toISOString(), type, ...data };
  appendFileSync(file, `${JSON.stringify(event)}\n`);
}

export function journalRead(root: string): JournalEvent[] {
  const file = evolPath(root, "journal.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JournalEvent);
}
