import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { UserError } from "../core/errors.js";
import { evolPath } from "../core/paths.js";

export const BACKUPS_DIR = "respaldos";
/** How many backups `save` keeps; older ones are pruned once a newer one lands. */
const KEEP = 10;

export interface BackupEntry {
  rel: string;
  /** Whether the file existed before this write. */
  existia: boolean;
  /** The file's previous content, base64, only when `existia` is true. */
  antesBase64?: string;
  /** sha256 of what evol wrote this time: lets a later `--deshacer` tell an untouched file from an edited one. */
  despuesSha256: string;
}

export interface BackupManifest {
  version: 1;
  fecha: string;
  entradas: BackupEntry[];
}

const sha256 = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");

/**
 * Collects what one `evol agents` run touched, as it happens, so it can be written as a single
 * backup once every file succeeded — never a partial one if something fails midway.
 */
export class BackupCollector {
  private entries: BackupEntry[] = [];

  /** Call once per file, right before it is overwritten (or right after it is newly created). */
  capture(rel: string, before: Buffer | undefined, existia: boolean, after: string | Buffer): void {
    const entry: BackupEntry = { rel, existia, despuesSha256: sha256(after) };
    if (existia && before) entry.antesBase64 = before.toString("base64");
    this.entries.push(entry);
  }

  get empty(): boolean {
    return this.entries.length === 0;
  }

  /** Writes `.evol/respaldos/<id>/manifest.json` atomically and prunes anything past `KEEP`. Returns the id, or null if there was nothing to back up. */
  save(root: string): string | null {
    if (this.entries.length === 0) return null;
    // a counter breaks a tie when two saves land in the same millisecond (ISO's own resolution)
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    let id = stamp;
    // zero-padded, so a lexicographic sort (listBackups) still sorts "-2" before "-10"
    for (let n = 1; existsSync(evolPath(root, BACKUPS_DIR, id)); n++) {
      id = `${stamp}-${String(n).padStart(3, "0")}`;
    }
    const dir = evolPath(root, BACKUPS_DIR, id);
    const tmp = `${dir}.tmp`;
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const manifest: BackupManifest = {
      version: 1,
      fecha: new Date().toISOString(),
      entradas: this.entries,
    };
    writeFileSync(join(tmp, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    renameSync(tmp, dir);
    prune(root);
    return id;
  }
}

function backupsRoot(root: string): string {
  return evolPath(root, BACKUPS_DIR);
}

/** Every backup id, oldest first (the ids are ISO timestamps with `:`/`.` replaced by `-`, so they sort). */
export function listBackups(root: string): string[] {
  const dir = backupsRoot(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => !f.endsWith(".tmp") && existsSync(join(dir, f, "manifest.json")))
    .sort();
}

function prune(root: string): void {
  const ids = listBackups(root);
  for (const id of ids.slice(0, Math.max(0, ids.length - KEEP))) {
    rmSync(join(backupsRoot(root), id), { recursive: true, force: true });
  }
}

export function readBackup(root: string, id: string): BackupManifest {
  const file = join(backupsRoot(root), id, "manifest.json");
  return JSON.parse(readFileSync(file, "utf8")) as BackupManifest;
}

export interface RestoreResult {
  id: string;
  restaurados: string[];
  /** Left alone because its current bytes do not match what evol wrote: someone edited it since. */
  manual: string[];
}

/**
 * Undoes the most recent backup (or the one named by `id`): restores a file to what it held
 * before, or deletes one evol created, but only when the file's current bytes still match what
 * evol wrote — an edit since then is left in place and reported, never overwritten.
 */
export function restoreBackup(root: string, id?: string): RestoreResult {
  const chosen = id ?? listBackups(root).at(-1);
  if (!chosen) throw new UserError("No hay ninguna copia de evol agents que deshacer.");
  const manifest = readBackup(root, chosen);
  const restaurados: string[] = [];
  const manual: string[] = [];
  for (const e of manifest.entradas) {
    const file = join(root, e.rel);
    const current = existsSync(file) ? readFileSync(file) : null;
    if (current && sha256(current) !== e.despuesSha256) {
      manual.push(e.rel);
      continue;
    }
    if (e.existia) {
      writeFileSync(file, Buffer.from(e.antesBase64 ?? "", "base64"));
    } else if (current) {
      rmSync(file);
    }
    restaurados.push(e.rel);
  }
  return { id: chosen, restaurados, manual };
}
