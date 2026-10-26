import { statSync } from "node:fs";
import { join } from "node:path";
import type { DocFinding } from "./hallazgo.js";
import {
  carpetaSegura,
  crearLector,
  listarMarkdown,
  nombreSeguro,
  resolverEnRaiz,
  TOPE_DOCUMENTOS,
} from "./lectura.js";
import { enlaces, lineasDeTexto } from "./markdown.js";

export const CARPETA_GRANULAR = "docs/proyecto";
/** A domain document with less content than this only warns (without counting headings or the origin). */
export const MIN_LINEAS = 15;

const ORIGEN = /^Origen:\s*(.*?)\s*$/;
const ENCABEZADO = /^ {0,3}#{1,6}\s/;

/** The documents of `docs/proyecto/<dominio>/<subdominio>.md` and their index, traced both ways. */
export function comprobarGranular(raiz: string): DocFinding[] {
  const hallazgos: DocFinding[] = [];
  const bloqueo = (archivo: string, mensaje: string): void => {
    hallazgos.push({ archivo: nombreSeguro(archivo), mensaje, nivel: "bloqueo" });
  };
  if (!carpetaSegura(raiz, CARPETA_GRANULAR)) {
    bloqueo(
      CARPETA_GRANULAR,
      "no es una carpeta del proyecto (enlace simbólico o fuera de la raíz): no se comprueba",
    );
    return hallazgos;
  }
  const leer = crearLector(raiz);
  const listado = listarMarkdown(join(raiz, CARPETA_GRANULAR));
  for (const enlace of listado.enlaces)
    bloqueo(`${CARPETA_GRANULAR}/${enlace}`, "enlace simbólico: no se sigue");
  if (listado.excedido) {
    bloqueo(
      CARPETA_GRANULAR,
      `demasiados documentos o demasiado profundo (máximo ${TOPE_DOCUMENTOS} documentos): no se comprueba`,
    );
    return hallazgos;
  }

  const indice = `${CARPETA_GRANULAR}/INDEX.md`;
  const documentos = listado.archivos.filter((a) => a !== "INDEX.md" && a.includes("/"));
  for (const suelto of listado.archivos.filter((a) => a !== "INDEX.md" && !a.includes("/")))
    bloqueo(
      `${CARPETA_GRANULAR}/${suelto}`,
      `documento fuera de una carpeta de dominio (${CARPETA_GRANULAR}/<dominio>/<subdominio>.md)`,
    );

  const enlazados = new Set<string>();
  if (!listado.archivos.includes("INDEX.md")) {
    bloqueo(indice, "falta el índice de documentos");
  } else {
    const lectura = leer(indice);
    if (!lectura.ok) bloqueo(indice, lectura.motivo);
    else {
      for (const { destino } of enlaces(lectura.texto)) {
        if (/^(https?|mailto):/i.test(destino)) continue;
        const r = resolverEnRaiz(raiz, CARPETA_GRANULAR, destino);
        if (!r.ok || !r.rel.startsWith(`${CARPETA_GRANULAR}/`)) {
          bloqueo(indice, `enlace no válido «${nombreSeguro(destino)}»`);
          continue;
        }
        const dentro = r.rel.slice(CARPETA_GRANULAR.length + 1);
        if (!r.existe) bloqueo(indice, `enlace roto: ${nombreSeguro(dentro)}`);
        else enlazados.add(dentro);
      }
      for (const doc of documentos)
        if (!enlazados.has(doc))
          bloqueo(`${CARPETA_GRANULAR}/${doc}`, `no está enlazado en ${indice}`);
    }
  }

  for (const doc of documentos) {
    const archivo = `${CARPETA_GRANULAR}/${doc}`;
    const lectura = leer(archivo);
    if (!lectura.ok) {
      bloqueo(archivo, lectura.motivo);
      continue;
    }
    const lineas = lineasDeTexto(lectura.texto);
    const origen = lineas.map((l) => ORIGEN.exec(l.texto)).find((m) => m !== null);
    const valor = origen?.[1] ?? "";
    if (valor === "") bloqueo(archivo, "no declara su origen («Origen: <ruta>»)");
    else {
      const r = resolverEnRaiz(raiz, "", valor);
      if (!r.ok) bloqueo(archivo, "el origen no se puede resolver dentro del proyecto");
      else if (!r.existe) bloqueo(archivo, `el origen «${nombreSeguro(r.rel)}» no existe`);
      else if (!statSync(r.abs).isFile())
        bloqueo(archivo, `el origen «${nombreSeguro(r.rel)}» no es un archivo`);
    }
    let usadoOrigen = false;
    const contenido = lineas.filter((l) => {
      if (l.texto.trim() === "" || ENCABEZADO.test(l.texto)) return false;
      if (!usadoOrigen && ORIGEN.test(l.texto)) {
        usadoOrigen = true;
        return false;
      }
      return true;
    }).length;
    if (contenido < MIN_LINEAS)
      hallazgos.push({
        archivo: nombreSeguro(archivo),
        mensaje: `tiene ${contenido} líneas de contenido; el mínimo es ${MIN_LINEAS}`,
        nivel: "aviso",
      });
  }
  return hallazgos;
}
