import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UserError } from "../core/errors.js";
import { sha256 } from "../core/hash.js";
import { huellaDe } from "./skill.js";
import type { Skill } from "./skill.js";
import { readZip, writeZip } from "./zip.js";
import type { ZipEntry, ZipLimits } from "./zip.js";

export const HUELLA_FILE = "huella.json";

interface HuellaFile {
  nombre: string;
  algoritmo: "sha256";
  huella: string;
  archivos: { ruta: string; sha256: string; bytes: number }[];
}

/**
 * A skill is a folder, not a file: it travels as a .zip with the whole folder under `<nombre>/`
 * and, next to it, `huella.json` with its fingerprint. Whoever receives it recomputes the
 * fingerprint from the files and compares: that is how a change in transit shows up.
 */
export function exportSkill(skill: Skill): { zip: Buffer; huella: string; archivos: number } {
  const entries: ZipEntry[] = skill.archivos.map((f) => {
    if (f.enlace !== undefined) {
      throw new UserError(
        `No se puede exportar «${skill.id}»: «${f.ruta}» es un enlace simbólico.`,
      );
    }
    return { path: `${skill.id}/${f.ruta}`, data: readFileSync(join(skill.dir, f.ruta)) };
  });
  const huella: HuellaFile = {
    nombre: skill.id,
    algoritmo: "sha256",
    huella: skill.huella,
    archivos: skill.archivos.map((f) => ({ ruta: f.ruta, sha256: f.sha256, bytes: f.bytes })),
  };
  entries.push({ path: HUELLA_FILE, data: Buffer.from(`${JSON.stringify(huella, null, 2)}\n`) });
  return { zip: writeZip(entries), huella: skill.huella, archivos: skill.archivos.length };
}

export interface ArchiveContents {
  nombre: string;
  /** Files of the skill, relative to its folder. */
  archivos: ZipEntry[];
  /** The fingerprint recomputed from the files in the archive. */
  huella: string;
  /** The one `huella.json` claims. */
  declarada: string | null;
  coincide: boolean;
}

/** Reads a skill .zip without writing anything to disk; the fingerprint is recomputed, not trusted. */
export function inspectArchive(buffer: Buffer, limits?: ZipLimits): ArchiveContents {
  const entries = readZip(buffer, limits);
  const sidecar = entries.find((e) => e.path === HUELLA_FILE);
  const rest = entries.filter((e) => e.path !== HUELLA_FILE);
  const folders = new Set(rest.map((e) => e.path.split("/")[0]));
  const [nombre] = [...folders];
  if (folders.size !== 1 || nombre === undefined || rest.some((e) => !e.path.includes("/"))) {
    throw new UserError("El .zip debe contener una sola carpeta de skill.");
  }
  const archivos = rest.map((e) => ({ path: e.path.slice(nombre.length + 1), data: e.data }));
  const huella = huellaDe(archivos.map((e) => ({ ruta: e.path, sha256: sha256(e.data) })));
  let declarada: string | null = null;
  if (sidecar) {
    try {
      const parsed = JSON.parse(sidecar.data.toString("utf8")) as Partial<HuellaFile>;
      declarada = typeof parsed.huella === "string" ? parsed.huella : null;
    } catch {
      declarada = null;
    }
  }
  return { nombre, archivos, huella, declarada, coincide: declarada === huella };
}
