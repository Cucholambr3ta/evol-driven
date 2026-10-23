import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { UserError } from "../core/errors.js";
import type { AuditFinding } from "./report.js";
import { readZip } from "./zip.js";

/** Limits of what a skill may be: past these it is a project, not a skill. */
export const LIMITS = { files: 200, fileBytes: 1_000_000, totalBytes: 5_000_000 };

export interface Entry {
  ruta: string;
  data: Buffer;
}

export type Language = "shell" | "python" | "js";

/** Scripting languages that are not on the allowed list (shell, Python, JavaScript, TypeScript). */
const FORBIDDEN_LANGUAGE = /\.(rb|pl|pm|ps1|psm1|bat|cmd|php|lua|vbs)$/i;
const NESTED_ARCHIVE = /\.(zip|gz|tgz|bz2|xz|7z|rar|tar|jar|whl)$/i;

export function languageOf(ruta: string, text: string): Language | null {
  if (/\.(sh|bash|zsh)$/i.test(ruta)) return "shell";
  if (/\.py$/i.test(ruta)) return "python";
  if (/\.(js|mjs|cjs|ts|mts|cts|tsx)$/i.test(ruta)) return "js";
  const shebang = /^#!\s*(\S+)(?:\s+(\S+))?/.exec(text);
  if (!shebang) return null;
  const interpreter = shebang[1]?.endsWith("/env") ? (shebang[2] ?? "") : (shebang[1] ?? "");
  if (/(^|\/)(ba|z|da)?sh$/.test(interpreter)) return "shell";
  if (/python[0-9.]*$/.test(interpreter)) return "python";
  if (/(^|\/)(node|tsx|deno|bun)$/.test(interpreter)) return "js";
  return null;
}

export const isBinary = (data: Buffer): boolean => data.subarray(0, 8000).includes(0);

const ASSET_MAGIC: Record<string, (d: Buffer) => boolean> = {
  png: (d) => d.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  jpg: (d) => d.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  jpeg: (d) => d.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  gif: (d) => d.subarray(0, 4).toString("latin1") === "GIF8",
  webp: (d) =>
    d.subarray(0, 4).toString("latin1") === "RIFF" &&
    d.subarray(8, 12).toString("latin1") === "WEBP",
  ico: (d) => d.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])),
  woff: (d) => d.subarray(0, 4).toString("latin1") === "wOFF",
  woff2: (d) => d.subarray(0, 4).toString("latin1") === "wOF2",
  ttf: (d) =>
    d.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0])) ||
    d.subarray(0, 4).toString("latin1") === "true",
  otf: (d) => d.subarray(0, 4).toString("latin1") === "OTTO",
};

/**
 * A binary file is either a resource a skill may legitimately carry (an image or a font whose
 * contents really are what its extension says: not code) or something a person cannot read.
 */
export function binaryKind(ruta: string, data: Buffer): "recurso" | "ilegible" {
  const ext = (ruta.split(".").pop() ?? "").toLowerCase();
  return ASSET_MAGIC[ext]?.(data) === true ? "recurso" : "ilegible";
}

const ASSET_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i;

/** Minified or obfuscated code cannot be read by a person, so it cannot be approved by one. */
export function looksObfuscated(text: string): string | null {
  if (text.split("\n").some((line) => line.length > 1000))
    return "tiene líneas de más de 1000 caracteres";
  if (/[A-Za-z0-9+/]{300,}={0,2}/.test(text)) return "contiene un bloque codificado largo";
  if ((text.match(/\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}/g) ?? []).length >= 40)
    return "abusa de secuencias de escape";
  return null;
}

// eslint-disable-next-line no-control-regex -- file names with control characters are exactly what this looks for
const CONTROL_NAME = /[\u0000-\u001f\u007f]/;

/** Rules about what is in the folder, before anything is read for meaning. */
export function inventoryFindings(entries: Entry[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  const block = (regla: string, texto: string, archivo?: string): void => {
    out.push({ regla, nivel: "bloqueo", texto, ...(archivo ? { archivo } : {}) });
  };
  if (entries.length > LIMITS.files)
    block(
      "limites",
      `Tiene ${entries.length} archivos (el máximo es ${LIMITS.files}): no es una skill, es un proyecto.`,
    );
  const total = entries.reduce((n, e) => n + e.data.length, 0);
  if (total > LIMITS.totalBytes)
    block("limites", `Pesa ${total} bytes (el máximo es ${LIMITS.totalBytes}).`);
  for (const e of entries) {
    if (CONTROL_NAME.test(e.ruta))
      block(
        "nombres",
        "El nombre del archivo tiene caracteres de control.",
        JSON.stringify(e.ruta),
      );
    if (e.data.length > LIMITS.fileBytes)
      block("limites", `Pesa más de ${LIMITS.fileBytes} bytes.`, e.ruta);
    if (NESTED_ARCHIVE.test(e.ruta))
      block(
        "comprimidos",
        "Es un archivo comprimido: una skill no puede traer paquetes dentro.",
        e.ruta,
      );
    else if (isBinary(e.data) || ASSET_EXT.test(e.ruta)) {
      if (binaryKind(e.ruta, e.data) === "recurso") {
        out.push({
          regla: "recursos",
          nivel: "aviso",
          texto:
            "Es un recurso binario (imagen o fuente): no se puede leer, comprueba que lo necesita.",
          archivo: e.ruta,
        });
      } else
        block(
          "binarios",
          "Es un archivo binario que no se puede leer: una skill solo lleva texto, imágenes y fuentes.",
          e.ruta,
        );
    } else if (FORBIDDEN_LANGUAGE.test(e.ruta)) {
      block(
        "lenguaje",
        "Es un script en un lenguaje no permitido (solo shell, Python, JavaScript y TypeScript).",
        e.ruta,
      );
    } else {
      const text = e.data.toString("utf8");
      if (languageOf(e.ruta, text) !== null) {
        const why = looksObfuscated(text);
        if (why) block("ofuscado", `Código minificado u ofuscado: ${why}.`, e.ruta);
      } else if (e.data.length > 0 && text.startsWith("#!")) {
        block("lenguaje", "Es un script con un intérprete no permitido.", e.ruta);
      }
    }
  }
  return out;
}

/** Reads a folder into memory without following links; what it cannot take is reported, not read. */
export function gatherFolder(dir: string): { entries: Entry[]; findings: AuditFinding[] } {
  const entries: Entry[] = [];
  const findings: AuditFinding[] = [];
  let stop = false;
  const walk = (current: string, base: string): void => {
    for (const name of readdirSync(current).sort()) {
      if (stop) return;
      const full = join(current, name);
      const rel = base ? `${base}/${name}` : name;
      const info = lstatSync(full);
      if (info.isSymbolicLink()) {
        findings.push({
          regla: "enlaces",
          nivel: "bloqueo",
          texto: `Es un enlace simbólico (apunta a «${readlinkSync(full)}»): una skill no puede depender de archivos de fuera.`,
          archivo: rel,
        });
      } else if (info.isDirectory()) walk(full, rel);
      else if (info.isFile()) {
        if (entries.length >= LIMITS.files + 1 || info.size > LIMITS.fileBytes * 4) {
          findings.push({
            regla: "limites",
            nivel: "bloqueo",
            texto: "Se interrumpió la lectura: hay demasiados archivos o uno es enorme.",
            archivo: rel,
          });
          stop = true;
          return;
        }
        entries.push({ ruta: rel, data: readFileSync(full) });
      }
    }
  };
  walk(dir, "");
  return { entries, findings };
}

/** Reads a skill .zip (one folder inside) into memory; unsafe archives are a BLOCK, not a crash. */
export function gatherZip(buffer: Buffer): {
  entries: Entry[];
  findings: AuditFinding[];
  nombre: string | null;
} {
  try {
    const raw = readZip(buffer).filter((e) => e.path !== "huella.json");
    const folders = new Set(raw.map((e) => e.path.split("/")[0]));
    const [nombre] = [...folders];
    if (folders.size !== 1 || nombre === undefined || raw.some((e) => !e.path.includes("/"))) {
      return {
        entries: [],
        nombre: null,
        findings: [
          {
            regla: "zip",
            nivel: "bloqueo",
            texto: "El .zip debe contener una sola carpeta de skill.",
          },
        ],
      };
    }
    return {
      nombre,
      findings: [],
      entries: raw.map((e) => ({ ruta: e.path.slice(nombre.length + 1), data: e.data })),
    };
  } catch (e) {
    if (e instanceof UserError)
      return {
        entries: [],
        nombre: null,
        findings: [{ regla: "zip", nivel: "bloqueo", texto: e.message }],
      };
    throw e;
  }
}
