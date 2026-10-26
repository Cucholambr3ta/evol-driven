import type { DocFinding } from "./hallazgo.js";
import { crearLector, nombreSeguro } from "./lectura.js";
import { encabezados, normalizar, secciones, tablas } from "./markdown.js";

export const CARPETA_REQUISITOS = "docs/requisitos";

const COLUMNAS_NFR = ["id", "requisito", "metrica", "umbral", "validacion"] as const;
const FALTA_NFR: Record<string, string> = {
  requisito: "el requisito",
  metrica: "la métrica",
  umbral: "el umbral",
  validacion: "la validación",
};
const CAMPOS_LIMITACION: [string, string][] = [
  ["razon", "Razón"],
  ["impacto", "Impacto"],
  ["roadmap", "Roadmap"],
];

type Aviso = (archivo: string, mensaje: string) => void;

function noFuncionales(archivo: string, texto: string, bloqueo: Aviso): void {
  const todas = tablas(texto);
  if (todas.length === 0) return bloqueo(archivo, "no tiene la tabla de requisitos");
  const tabla = todas.find((t) => COLUMNAS_NFR.every((c) => t.cabeceras.includes(c)));
  if (!tabla)
    return bloqueo(
      archivo,
      "la tabla de requisitos no tiene las columnas ID, Requisito, Métrica, Umbral y Validación",
    );
  const vistos = new Set<string>();
  for (const fila of tabla.filas) {
    const id = (fila.celdas["id"] ?? "").toUpperCase();
    if (!/^NFR-\d{1,6}$/.test(id)) {
      bloqueo(archivo, `identificador no válido en la línea ${fila.linea}`);
      continue;
    }
    if (vistos.has(id)) bloqueo(archivo, `${id}: repetido`);
    vistos.add(id);
    for (const [columna, falta] of Object.entries(FALTA_NFR))
      if ((fila.celdas[columna] ?? "").trim() === "") bloqueo(archivo, `${id}: falta ${falta}`);
  }
}

function limitaciones(archivo: string, texto: string, bloqueo: Aviso): void {
  const titulos = encabezados(texto);
  const padre = titulos.find((h) => normalizar(h.titulo) === "limitaciones conocidas");
  if (!padre) return bloqueo(archivo, "no tiene la sección «Limitaciones conocidas»");
  const fin =
    titulos.find((h) => h.linea > padre.linea && h.nivel <= padre.nivel)?.linea ?? Infinity;
  const vistas = new Set<string>();
  for (const s of secciones(texto, padre.nivel + 1)) {
    if (s.linea < padre.linea || s.linea > fin) continue;
    const id = /^L(\d{1,6})(?!\w)/i.exec(s.titulo)?.[0]?.toUpperCase() ?? "";
    if (id === "") {
      bloqueo(archivo, `identificador no válido en la línea ${s.linea}`);
      continue;
    }
    if (vistas.has(id)) bloqueo(archivo, `${id}: repetida`);
    vistas.add(id);
    const campos = new Map<string, string>();
    for (const linea of s.lineas) {
      const m = /^\s*([^:]{1,30}):\s*(.*)$/.exec(linea);
      if (m?.[1]) campos.set(normalizar(m[1]), (m[2] ?? "").trim());
    }
    for (const [clave, etiqueta] of CAMPOS_LIMITACION)
      if ((campos.get(clave) ?? "") === "") bloqueo(archivo, `${id}: falta «${etiqueta}»`);
  }
}

function glosario(archivo: string, texto: string, bloqueo: Aviso): void {
  const vistos = new Set<string>();
  for (const s of secciones(texto, 3)) {
    const clave = normalizar(s.titulo);
    if (vistos.has(clave)) bloqueo(archivo, `término repetido: «${nombreSeguro(s.titulo)}»`);
    vistos.add(clave);
  }
}

/** The non-functional requirements, the known limitations and the glossary of `docs/requisitos`. */
export function comprobarRequisitos(raiz: string): DocFinding[] {
  const hallazgos: DocFinding[] = [];
  const leer = crearLector(raiz);
  const partes: [string, (a: string, t: string, b: Aviso) => void][] = [
    ["NO_FUNCIONALES.md", noFuncionales],
    ["RESTRICCIONES.md", limitaciones],
    ["GLOSARIO.md", glosario],
  ];
  for (const [nombre, comprobar] of partes) {
    const archivo = `${CARPETA_REQUISITOS}/${nombre}`;
    const bloqueo: Aviso = (a, mensaje) =>
      hallazgos.push({ archivo: nombreSeguro(a), mensaje, nivel: "bloqueo" });
    const lectura = leer(archivo);
    if (!lectura.ok) {
      // a missing file is the discipline's artifact to report; an unreadable one is ours
      if (!lectura.motivo.includes("no existe o no es accesible")) bloqueo(archivo, lectura.motivo);
      continue;
    }
    comprobar(archivo, lectura.texto, bloqueo);
  }
  return hallazgos;
}
