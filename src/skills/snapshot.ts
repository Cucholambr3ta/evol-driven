import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { userConfigDir } from "../core/paths.js";
import type { Entry } from "./inventory.js";
import { readSkill } from "./skill.js";

/** Where audited copies live until a person approves them: outside every project and the library. */
export function quarantineRoot(): string {
  return join(userConfigDir(), "quarantine");
}

export function snapshotBase(huella: string): string {
  return join(quarantineRoot(), huella.slice(0, 16));
}

/**
 * The immutable copy that is audited, and that approval installs: files are written from memory
 * (not copied from a folder somebody can still change), read-only and without execute permission.
 */
export function writeSnapshot(entries: Entry[], huella: string): string {
  const base = snapshotBase(huella);
  rmSync(base, { recursive: true, force: true });
  const skillDir = join(base, "skill");
  mkdirSync(skillDir, { recursive: true, mode: 0o700 });
  chmodSync(base, 0o700);
  for (const e of entries) {
    const target = resolve(skillDir, e.ruta);
    if (!target.startsWith(resolve(skillDir) + sep))
      throw new Error(`ruta fuera de la cuarentena: ${e.ruta}`);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, e.data, { mode: 0o444 });
    chmodSync(target, 0o444);
  }
  return skillDir;
}

/** True while the snapshot still has exactly the audited bytes. */
export function verifySnapshot(skillDir: string, huella: string): boolean {
  return readSkill(skillDir).huella === huella;
}
