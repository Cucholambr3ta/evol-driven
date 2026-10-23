import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { userConfigDir } from "../../core/paths.js";
import { promptHash } from "./prompt.js";

export interface TrustEntry {
  modelo: string;
  promptHash: string;
  fecha: string;
  resultado: "fiable" | "no-fiable";
  detalle: string;
}

interface TrustFile {
  version: 1;
  lectores: Record<string, TrustEntry>;
}

const file = (): string => join(userConfigDir(), "auditor-confianza.json");

function read(): TrustFile {
  if (!existsSync(file())) return { version: 1, lectores: {} };
  try {
    const parsed = JSON.parse(readFileSync(file(), "utf8")) as TrustFile;
    return parsed.version === 1 && typeof parsed.lectores === "object"
      ? parsed
      : { version: 1, lectores: {} };
  } catch {
    // an unreadable record is no record: nothing is trusted until the self-test runs again
    return { version: 1, lectores: {} };
  }
}

export function recordTrust(id: string, entry: TrustEntry): void {
  const data = read();
  data.lectores[id] = entry;
  mkdirSync(userConfigDir(), { recursive: true });
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, file());
}

/**
 * A reader counts only if its self-test passed with this very model and this very prompt: change
 * either one and it has to prove itself again.
 */
export function isTrusted(id: string, modelo: string, hash: string = promptHash()): boolean {
  const entry = read().lectores[id];
  return entry?.resultado === "fiable" && entry.modelo === modelo && entry.promptHash === hash;
}
