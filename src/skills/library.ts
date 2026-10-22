import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { UserError } from "../core/errors.js";
import type { DisciplineRegistry } from "../core/disciplines.js";
import { userConfigDir } from "../core/paths.js";
import { SKILL_FILE, readSkill } from "./skill.js";
import type { Skill } from "./skill.js";

/** The user's library: one folder per skill. The same on every machine, for every project. */
export function libraryDir(): string {
  return join(userConfigDir(), "skills");
}

/** The folder to work on: `--dir` when given, otherwise the library. */
export function resolveSkillsDir(option?: string): string {
  return option ? resolve(option) : libraryDir();
}

/** Every immediate folder of `dir` that looks like a skill: a broken one is listed, not hidden. */
export function listSkills(dir: string): Skill[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isDirectory())
    .map(readSkill)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function findSkill(dir: string, name: string): Skill {
  const path = join(dir, name);
  if (!/^[A-Za-z0-9._-]+$/.test(name) || !existsSync(join(path, SKILL_FILE))) {
    throw new UserError(`No hay ninguna skill «${name}» en ${dir}.`);
  }
  return readSkill(path);
}

export interface DisciplineSkillRow {
  id: string;
  nombre: string;
  tipo: "base" | "extendida";
  skill: string | null;
  /** The skill the discipline names exists in the folder being looked at. */
  disponible: boolean;
}

/** One row per discipline: which skill applies it and whether that skill is there yet. */
export function disciplineSkills(registry: DisciplineRegistry, dir: string): DisciplineSkillRow[] {
  const present = new Set(listSkills(dir).map((s) => s.id));
  return registry.all().map((d) => ({
    id: d.id,
    nombre: d.nombre,
    tipo: d.tipo,
    skill: d.skill ?? null,
    disponible: d.skill !== undefined && present.has(d.skill),
  }));
}
