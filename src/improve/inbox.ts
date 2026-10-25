import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { UserError } from "../core/errors.js";
import { userConfigDir } from "../core/paths.js";

/**
 * The improvement inbox. While working in a project, a person or an agent notices something the
 * framework should do better. It is written down here, with where it came from, and **nothing is
 * changed**: the improvements are made later, in the origin of the framework, from this list.
 */
export const inboxFile = (): string => join(userConfigDir(), "mejoras", "buzon.jsonl");

const EntrySchema = z.object({
  id: z.string(),
  fecha: z.string(),
  proyecto: z.string().nullable(),
  versionEvol: z.string(),
  texto: z.string().min(1),
  evidencia: z.string().optional(),
  estado: z.enum(["pendiente", "hecha", "descartada"]),
  nota: z.string().optional(),
});
export type Improvement = z.infer<typeof EntrySchema>;

export function readInbox(file: string = inboxFile()): Improvement[] {
  if (!existsSync(file)) return [];
  const byId = new Map<string, Improvement>();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      continue;
    }
    const parsed = EntrySchema.safeParse(raw);
    // a later line for the same id replaces the earlier one: closing an item appends, never rewrites
    if (parsed.success) byId.set(parsed.data.id, parsed.data);
  }
  return [...byId.values()];
}

export interface NewImprovement {
  texto: string;
  proyecto: string | null;
  versionEvol: string;
  evidencia?: string;
}

const MAX_TEXT = 2_000;

export function addImprovement(
  input: NewImprovement,
  file: string = inboxFile(),
  now: Date = new Date(),
): Improvement {
  const texto = input.texto.trim();
  if (texto === "") throw new UserError("Escribe en qué consiste la mejora.");
  if (texto.length > MAX_TEXT)
    throw new UserError(
      `La nota es demasiado larga (más de ${MAX_TEXT} caracteres): resúmela y pon el detalle como evidencia.`,
    );
  const existing = readInbox(file);
  const next =
    existing.reduce((max, e) => Math.max(max, Number(e.id.replace(/^m-/, "")) || 0), 0) + 1;
  const entry: Improvement = {
    id: `m-${String(next).padStart(3, "0")}`,
    fecha: now.toISOString(),
    proyecto: input.proyecto,
    versionEvol: input.versionEvol,
    texto,
    ...(input.evidencia ? { evidencia: input.evidencia.slice(0, MAX_TEXT) } : {}),
    estado: "pendiente",
  };
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(entry)}\n`);
  return entry;
}

export function closeImprovement(
  id: string,
  estado: "hecha" | "descartada",
  nota: string | undefined,
  file: string = inboxFile(),
): Improvement {
  const found = readInbox(file).find((e) => e.id === id);
  if (!found)
    throw new UserError(`No hay ninguna mejora «${id}». Mira las que hay con: evol mejora list`);
  const closed: Improvement = { ...found, estado, ...(nota ? { nota } : {}) };
  writeFileSync(file, `${readFileSync(file, "utf8")}${JSON.stringify(closed)}\n`);
  return closed;
}
