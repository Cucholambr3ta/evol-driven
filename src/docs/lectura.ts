import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
} from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";

/** The biggest file a documentation check reads (1 MiB): a bigger one can hide what it should show. */
export const TOPE_ARCHIVO = 1024 * 1024;

export type Lectura = { ok: true; texto: string } | { ok: false; motivo: string };

function motivoDeError(error: unknown): string {
  switch ((error as NodeJS.ErrnoException).code) {
    case "ELOOP":
      return "no se puede leer: es un enlace simbólico";
    case "EACCES":
    case "EPERM":
      return "no se puede leer: sin permiso";
    case "ENAMETOOLONG":
      return "no se puede leer: la ruta es demasiado larga";
    default:
      return "no se puede leer: no existe o no es accesible";
  }
}

/**
 * Reads a document the way every documentation check has to: without following a symbolic link,
 * only a regular file (checked on the open descriptor, so a swap after the open changes nothing),
 * reading at most the cap plus one byte, and answering with a reason instead of throwing. The
 * reason never includes the path or the content.
 */
export function leerDocumento(ruta: string, tope = TOPE_ARCHIVO): Lectura {
  let fd: number;
  try {
    fd = openSync(ruta, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    return { ok: false, motivo: motivoDeError(error) };
  }
  try {
    if (!fstatSync(fd).isFile()) return { ok: false, motivo: "no es un archivo regular" };
    const buffer = Buffer.alloc(tope + 1);
    let leidos = 0;
    while (leidos < buffer.length) {
      const n = readSync(fd, buffer, leidos, buffer.length - leidos, null);
      if (n === 0) break;
      leidos += n;
    }
    if (leidos > tope) return { ok: false, motivo: `demasiado grande (más de ${tope} bytes)` };
    return { ok: true, texto: new TextDecoder("utf-8").decode(buffer.subarray(0, leidos)) };
  } catch (error) {
    return { ok: false, motivo: motivoDeError(error) };
  } finally {
    closeSync(fd);
  }
}

// the escape sequences of a terminal are made of control characters: that is what this matches
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
const NO_MOSTRABLE = /[\p{Cc}؜‎‏‪-‮⁦-⁩]/gu;
export const LARGO_NOMBRE = 80;

/**
 * A name taken from a document or a file (a path, an identifier, a term) as it may appear in a
 * message: without terminal escape sequences, control characters, line breaks or bidirectional
 * marks, and at most 80 characters.
 */
export function nombreSeguro(nombre: string): string {
  const limpio = nombre.replace(ANSI, "").replace(NO_MOSTRABLE, "?");
  const caracteres = [...limpio];
  return caracteres.length <= LARGO_NOMBRE
    ? limpio
    : `${caracteres.slice(0, LARGO_NOMBRE - 1).join("")}…`;
}

export type Resolucion = { ok: false } | { ok: true; abs: string; rel: string; existe: boolean };

function lexicamenteValida(texto: string): boolean {
  if (texto === "" || /\p{Cc}/u.test(texto)) return false;
  if (texto.startsWith("/") || texto.startsWith("\\")) return false;
  if (/^[A-Za-z]:/.test(texto) || /^[a-z][a-z0-9+.-]*:/i.test(texto)) return false;
  return !texto.split(/[\\/]+/).includes("..");
}

/**
 * Turns the text of a link or an origin into a path inside `raiz`, or refuses. First the text alone
 * (no `..`, no absolute path, no scheme, no control characters, before and after decoding `%` once),
 * then the nearest existing ancestor is resolved with `realpath` and must stay inside the root. A
 * path that leaves the root, or that cannot be resolved, always answers the same: `{ ok: false }`.
 */
export function resolverEnRaiz(raiz: string, base: string, texto: string): Resolucion {
  const sinAncla = texto.split("#")[0]?.split("?")[0] ?? "";
  if (!lexicamenteValida(sinAncla)) return { ok: false };
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(sinAncla);
  } catch {
    return { ok: false };
  }
  if (!lexicamenteValida(decodificado)) return { ok: false };
  const abs = resolve(raiz, base, decodificado);
  const rel = relative(raiz, abs).split(sep).join(posix.sep);
  if (rel === "" || rel.startsWith("..")) return { ok: false };
  try {
    const raizReal = realpathSync(raiz);
    let ancestro = abs;
    let existe = true;
    for (;;) {
      try {
        lstatSync(ancestro);
        break;
      } catch {
        existe = false;
        const padre = dirname(ancestro);
        if (padre === ancestro) return { ok: false };
        ancestro = padre;
      }
    }
    const real = realpathSync(ancestro);
    if (real !== raizReal && !real.startsWith(raizReal + sep)) return { ok: false };
    return { ok: true, abs, rel, existe };
  } catch {
    return { ok: false };
  }
}

export const TOPE_DOCUMENTOS = 500;
export const PROFUNDIDAD_MAXIMA = 6;

export interface Listado {
  /** Markdown files, relative to the folder, with `/` separators and sorted. */
  archivos: string[];
  /** Symbolic links found (never followed), relative to the folder. */
  enlaces: string[];
  /** True when there are more documents or more depth than the caps allow. */
  excedido: boolean;
}

/** The Markdown files under `dir`, without following symbolic links and within the caps. */
export function listarMarkdown(dir: string): Listado {
  const listado: Listado = { archivos: [], enlaces: [], excedido: false };
  const recorrer = (actual: string, relativo: string, profundidad: number): void => {
    let entradas;
    try {
      entradas = readdirSync(actual, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entrada of entradas.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = relativo === "" ? entrada.name : `${relativo}/${entrada.name}`;
      if (entrada.isSymbolicLink()) listado.enlaces.push(rel);
      else if (entrada.isDirectory()) {
        if (profundidad >= PROFUNDIDAD_MAXIMA) listado.excedido = true;
        else recorrer(join(actual, entrada.name), rel, profundidad + 1);
      } else if (entrada.isFile() && entrada.name.endsWith(".md")) {
        if (listado.archivos.length >= TOPE_DOCUMENTOS) listado.excedido = true;
        else listado.archivos.push(rel);
      }
      if (listado.excedido) return;
    }
  };
  recorrer(dir, "", 1);
  listado.archivos.sort();
  return listado;
}
