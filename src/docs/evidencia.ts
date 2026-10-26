import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { DocFinding } from "./hallazgo.js";
import { leerDocumento, listarMarkdown, nombreSeguro, TOPE_DOCUMENTOS } from "./lectura.js";
import { lineasDeTexto, normalizar, tablas } from "./markdown.js";

export const CARPETA_EVIDENCIA = "investigacion";

/** Today's date as `AAAA-MM-DD` in the local time zone and in UTC. */
export interface Hoy {
  local: string;
  utc: string;
}

export function fechasDeHoy(ahora: Date = new Date()): Hoy {
  const dos = (n: number): string => String(n).padStart(2, "0");
  return {
    local: `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`,
    utc: ahora.toISOString().slice(0, 10),
  };
}

const COLUMNAS = ["id", "fuente", "consultada", "clasificacion", "afirma"];
const CLASIFICACIONES = new Set(["hecho", "supuesto", "contradiccion"]);

function fechaReal(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return f.toISOString().slice(0, 10) === texto;
}

/**
 * The research dossiers of `investigacion/<tema>/`: each topic has an evidence index (every source
 * with an id, a consultation date and a classification) and every `[E-n]` citation in the topic's
 * documents has to be one of its sources. A source nobody cites only warns.
 */
export function comprobarEvidencia(raiz: string, hoy: Hoy = fechasDeHoy()): DocFinding[] {
  const hallazgos: DocFinding[] = [];
  const bloqueo = (archivo: string, mensaje: string): void => {
    hallazgos.push({ archivo: nombreSeguro(archivo), mensaje, nivel: "bloqueo" });
  };
  let temas: string[];
  try {
    temas = readdirSync(join(raiz, CARPETA_EVIDENCIA), { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name)
      .sort();
  } catch {
    return hallazgos;
  }
  for (const tema of temas) {
    const carpeta = `${CARPETA_EVIDENCIA}/${tema}`;
    const listado = listarMarkdown(join(raiz, carpeta));
    for (const enlace of listado.enlaces)
      bloqueo(`${carpeta}/${enlace}`, "enlace simbólico: no se sigue");
    if (listado.excedido) {
      bloqueo(
        carpeta,
        `demasiados documentos o demasiado profundo (máximo ${TOPE_DOCUMENTOS} documentos): no se comprueba`,
      );
      continue;
    }
    if (listado.archivos.length === 0) continue;
    const indices = listado.archivos.filter(
      (a) => !a.includes("/") && a.endsWith("-evidence-index.md"),
    );
    if (indices.length === 0) {
      bloqueo(carpeta, "el tema no tiene índice de evidencia («<tema>-evidence-index.md»)");
      continue;
    }
    if (indices.length > 1) {
      bloqueo(carpeta, "el tema tiene más de un índice de evidencia");
      continue;
    }
    const indice = `${carpeta}/${indices[0] ?? ""}`;
    const lecturaIndice = leerDocumento(join(raiz, indice));
    if (!lecturaIndice.ok) {
      bloqueo(indice, lecturaIndice.motivo);
      continue;
    }
    const todas = tablas(lecturaIndice.texto);
    const tabla = todas.find((t) => COLUMNAS.every((c) => t.cabeceras.includes(c)));
    if (todas.length === 0) {
      bloqueo(indice, "no tiene la tabla de fuentes");
      continue;
    }
    if (!tabla) {
      bloqueo(
        indice,
        "la tabla de fuentes no tiene las columnas ID, Fuente, Consultada, Clasificación y Afirma",
      );
      continue;
    }
    const fuentes = new Set<string>();
    for (const f of tabla.filas) {
      const id = (f.celdas["id"] ?? "").toUpperCase();
      if (!/^E-\d{1,6}$/.test(id)) {
        bloqueo(indice, `identificador no válido en la línea ${f.linea}`);
        continue;
      }
      if (fuentes.has(id)) bloqueo(indice, `${id}: repetida`);
      fuentes.add(id);
      if ((f.celdas["fuente"] ?? "") === "") bloqueo(indice, `${id}: falta la fuente`);
      const fecha = f.celdas["consultada"] ?? "";
      if (fecha === "") bloqueo(indice, `${id}: falta la fecha de consulta`);
      else if (!fechaReal(fecha))
        bloqueo(indice, `${id}: fecha de consulta no válida (AAAA-MM-DD)`);
      else if (fecha > hoy.local && fecha > hoy.utc)
        bloqueo(indice, `${id}: la fecha de consulta es futura`);
      const clase = f.celdas["clasificacion"] ?? "";
      if (clase === "") bloqueo(indice, `${id}: falta la clasificación`);
      else if (!CLASIFICACIONES.has(normalizar(clase)))
        bloqueo(indice, `${id}: clasificación no válida (hecho, supuesto o contradicción)`);
    }
    const citadas = new Set<string>();
    for (const rel of listado.archivos) {
      const archivo = `${carpeta}/${rel}`;
      if (archivo === indice) continue;
      const lectura = leerDocumento(join(raiz, archivo));
      if (!lectura.ok) {
        bloqueo(archivo, lectura.motivo);
        continue;
      }
      const avisadas = new Set<string>();
      for (const { n, texto } of lineasDeTexto(lectura.texto)) {
        for (const m of texto.matchAll(/\[E-(\d+)\]/gi)) {
          const digitos = m[1] ?? "";
          if (digitos.length > 6) {
            bloqueo(archivo, `identificador no válido en la línea ${n}`);
            continue;
          }
          const id = `E-${digitos}`;
          citadas.add(id);
          if (!fuentes.has(id) && !avisadas.has(id)) {
            avisadas.add(id);
            bloqueo(archivo, `cita [${id}] sin fuente en el índice`);
          }
        }
      }
    }
    for (const id of [...fuentes].sort())
      if (!citadas.has(id))
        hallazgos.push({
          archivo: nombreSeguro(indice),
          mensaje: `${id}: ninguna cita la usa`,
          nivel: "aviso",
        });
  }
  return hallazgos;
}
