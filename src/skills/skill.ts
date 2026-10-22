import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { basename, join } from "node:path";
import YAML from "yaml";
import { sha256 } from "../core/hash.js";

export const SKILL_FILE = "SKILL.md";
/** Beyond this a folder is not a skill, it is a project: the check refuses it. */
export const MAX_FILES = 2000;

export interface SkillFile {
  ruta: string;
  bytes: number;
  /** Where a symbolic link points; such a file has no content of its own. */
  enlace?: string;
  /** SHA-256 of the content (of the link target for a link). */
  sha256: string;
}

export interface Skill {
  /** The folder name: the identifier every IDE uses for the skill. */
  id: string;
  dir: string;
  nombre: string;
  descripcion: string;
  frontmatter: Record<string, unknown>;
  cuerpo: string;
  archivos: SkillFile[];
  bytes: number;
  huella: string;
  /** Why the frontmatter could not be read; the skill is still listed, with what could be recovered. */
  error?: string;
  truncado: boolean;
}

export interface ParsedSkillMd {
  front: Record<string, unknown> | null;
  cuerpo: string;
  error?: string;
  /** Top-level `key: value` pairs recovered when the YAML is broken, so the skill can still be shown. */
  recuperado: Record<string, string>;
}

/** When the YAML is broken, still recover the top-level `key: value` lines. */
function looseFront(raw: string): Record<string, string> {
  const front: Record<string, string> = {};
  let key: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m && m[1] !== undefined) {
      key = m[1];
      const value = (m[2] ?? "").replace(/^["']|["']$/g, "").trim();
      front[key] = [">", "|", ">-", "|-"].includes(value) ? "" : value;
    } else if (key && /^\s+\S/.test(line)) {
      front[key] = `${front[key] ?? ""} ${line.trim()}`.trim();
    }
  }
  return front;
}

export function parseSkillMd(text: string): ParsedSkillMd {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { front: null, cuerpo: text, error: "no tiene frontmatter (---)", recuperado: {} };
  const raw = m[1] ?? "";
  const cuerpo = m[2] ?? "";
  try {
    const value: unknown = YAML.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { front: value as Record<string, unknown>, cuerpo, recuperado: {} };
    }
    return {
      front: null,
      cuerpo,
      error: "el frontmatter no es un mapa YAML",
      recuperado: looseFront(raw),
    };
  } catch (e) {
    const first = (String((e as Error).message).split("\n")[0] ?? "").replace(/:\s*$/, "");
    return { front: null, cuerpo, error: `YAML inválido: ${first}`, recuperado: looseFront(raw) };
  }
}

/**
 * The fingerprint of a skill: SHA-256 over «path NUL sha256(content)» of every file, sorted by
 * path. It does not depend on timestamps, permissions or the order the disk lists files.
 */
export function huellaDe(files: { ruta: string; sha256: string }[]): string {
  const lines = files
    .map((f) => `${f.ruta}\0${f.sha256}\n`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sha256(lines.join(""));
}

function collect(dir: string, base: string, out: SkillFile[]): boolean {
  for (const entry of readdirSync(dir).sort()) {
    if (out.length >= MAX_FILES) return true;
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    const info = lstatSync(full);
    if (info.isSymbolicLink()) {
      const enlace = readlinkSync(full);
      out.push({ ruta: rel, bytes: 0, enlace, sha256: sha256(`enlace:${enlace}`) });
    } else if (info.isDirectory()) {
      if (collect(full, rel, out)) return true;
    } else if (info.isFile()) {
      out.push({ ruta: rel, bytes: info.size, sha256: sha256(readFileSync(full)) });
    }
  }
  return false;
}

export function readSkill(dir: string): Skill {
  const id = basename(dir);
  const archivos: SkillFile[] = [];
  const truncado = collect(dir, "", archivos);
  let text = "";
  try {
    text = readFileSync(join(dir, SKILL_FILE), "utf8");
  } catch {
    /* a folder without SKILL.md still gets a (broken) entry, so it is not hidden */
  }
  const parsed = parseSkillMd(text);
  const pick = (key: string): string => {
    const fromYaml = parsed.front?.[key];
    if (typeof fromYaml === "string") return fromYaml.replace(/\s+/g, " ").trim();
    return (parsed.recuperado[key] ?? "").replace(/\s+/g, " ").trim();
  };
  return {
    id,
    dir,
    nombre: pick("name") || id,
    descripcion: pick("description"),
    frontmatter: parsed.front ?? {},
    cuerpo: parsed.cuerpo,
    archivos,
    bytes: archivos.reduce((n, f) => n + f.bytes, 0),
    huella: huellaDe(archivos),
    ...(text === ""
      ? { error: `falta ${SKILL_FILE} o está vacío` }
      : parsed.error
        ? { error: parsed.error }
        : {}),
    truncado,
  };
}
