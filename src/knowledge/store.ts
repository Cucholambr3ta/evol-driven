import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { UserError } from "../core/errors.js";
import { userConfigDir } from "../core/paths.js";
import type { KnowledgeSource, Registry } from "./model.js";

/**
 * The knowledge belongs to the person, not to a project: the documentation of a library serves all
 * their projects. It lives next to the gate keys, in the user's configuration folder.
 */
export const knowledgeDir = (): string => join(userConfigDir(), "knowledge");
const registryFile = (): string => join(knowledgeDir(), "sources.json");
/** What was captured, exactly as it came. */
export const capturePath = (id: string): string => join(knowledgeDir(), "captures", id);
/** Only the documents that passed the review: the folder an indexer is allowed to read. */
export const readyPath = (id: string): string => join(knowledgeDir(), "ready", id);

export const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function readRegistry(): Registry {
  if (!existsSync(registryFile())) return { version: 1, fuentes: {} };
  try {
    const parsed = JSON.parse(readFileSync(registryFile(), "utf8")) as Registry;
    if (parsed.version !== 1 || typeof parsed.fuentes !== "object") throw new Error("formato");
    return parsed;
  } catch {
    throw new UserError(
      `El registro de fuentes (${registryFile()}) no se puede leer; no lo sobrescribo. Revísalo a mano.`,
    );
  }
}

export function writeRegistry(registry: Registry): void {
  mkdirSync(knowledgeDir(), { recursive: true });
  const tmp = `${registryFile()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(registry, null, 2)}\n`);
  renameSync(tmp, registryFile());
}

export function getSource(registry: Registry, id: string): KnowledgeSource {
  const source = registry.fuentes[id];
  if (!source)
    throw new UserError(
      `No hay una fuente «${id}». Mira las que hay con: evol knowledge source list`,
    );
  return source;
}
