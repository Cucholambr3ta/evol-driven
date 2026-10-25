import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { z } from "zod";

/**
 * The installed copy is read-only and carries the hash of what was installed. `evol doctor` compares
 * them: a framework that changed where it should not is the mix-up this exists to catch.
 */
export const INTEGRITY_FILE = "INTEGRIDAD.json";

/** What is hashed: the parts of the package that decide how evol behaves. */
const COVERED = ["dist", "disciplines", "templates", "rules", "skills", "package.json"] as const;

const IntegritySchema = z.object({
  version: z.number().int(),
  archivos: z.record(z.string(), z.string()),
});

function walk(root: string, rel: string, out: string[]): void {
  const full = join(root, rel);
  const stat = lstatSync(full);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    for (const name of readdirSync(full).sort()) walk(root, join(rel, name), out);
  } else out.push(rel.split(sep).join("/"));
}

export function hashFiles(root: string): Record<string, string> {
  const files: string[] = [];
  for (const part of COVERED) if (existsSync(join(root, part))) walk(root, part, files);
  const hashes: Record<string, string> = {};
  for (const f of files)
    hashes[f] = createHash("sha256")
      .update(readFileSync(join(root, f)))
      .digest("hex");
  return hashes;
}

export function writeIntegrity(root: string): number {
  const archivos = hashFiles(root);
  writeFileSync(
    join(root, INTEGRITY_FILE),
    `${JSON.stringify({ version: 1, archivos }, null, 2)}\n`,
  );
  return Object.keys(archivos).length;
}

export interface IntegrityReport {
  ok: boolean;
  /** No integrity record at all: nothing to compare against. */
  sinRegistro: boolean;
  modificados: string[];
  faltan: string[];
  nuevos: string[];
}

export function verifyIntegrity(root: string): IntegrityReport {
  const file = join(root, INTEGRITY_FILE);
  if (!existsSync(file))
    return { ok: false, sinRegistro: true, modificados: [], faltan: [], nuevos: [] };
  const parsed = IntegritySchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success)
    return { ok: false, sinRegistro: true, modificados: [], faltan: [], nuevos: [] };
  const expected = parsed.data.archivos;
  const actual = hashFiles(root);
  const modificados = Object.keys(expected).filter((f) => f in actual && actual[f] !== expected[f]);
  const faltan = Object.keys(expected).filter((f) => !(f in actual));
  const nuevos = Object.keys(actual).filter((f) => !(f in expected));
  return {
    ok: modificados.length + faltan.length + nuevos.length === 0,
    sinRegistro: false,
    modificados,
    faltan,
    nuevos,
  };
}

/** Takes the write permission away from everything in the folder (files and directories). */
export function makeReadOnly(root: string): void {
  const visit = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) visit(full);
      else chmodSync(full, stat.mode & ~0o222);
    }
    chmodSync(dir, lstatSync(dir).mode & ~0o222);
  };
  visit(root);
}

/** Gives the owner write permission back, so a folder can be deleted or replaced. */
export function makeWritable(root: string): void {
  const visit = (dir: string): void => {
    chmodSync(dir, lstatSync(dir).mode | 0o200);
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) visit(full);
      else chmodSync(full, stat.mode | 0o200);
    }
  };
  visit(root);
}

export const relativeTo = (root: string, file: string): string =>
  relative(root, file).split(sep).join("/");
