import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";

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
