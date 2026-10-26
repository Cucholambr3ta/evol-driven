/** Text in a form that compares equal however it was written: no accents, case, numbering or colon. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/^\d+[.)]\s*/, "")
    .replace(/:$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Linea {
  /** 1-based line number in the original text. */
  n: number;
  texto: string;
}

const VALLA = /^ {0,3}(`{3,}|~{3,})/;
/** A longer line is cut: no pattern runs on more than this, so none can be made quadratic. */
export const MAX_LINEA = 8192;

/** The lines that are not inside a fenced code block; an unclosed fence hides the rest of the text. */
export function lineasDeTexto(md: string): Linea[] {
  const salida: Linea[] = [];
  let valla: { caracter: string; largo: number } | null = null;
  md.split(/\r?\n/).forEach((completo, i) => {
    const texto = completo.length > MAX_LINEA ? completo.slice(0, MAX_LINEA) : completo;
    const abre = VALLA.exec(texto);
    if (valla) {
      const cierra = new RegExp(`^ {0,3}${valla.caracter}{${valla.largo},}\\s*$`);
      if (cierra.test(texto)) valla = null;
      return;
    }
    if (abre?.[1]) {
      valla = { caracter: abre[1].charAt(0) === "`" ? "`" : "~", largo: abre[1].length };
      return;
    }
    salida.push({ n: i + 1, texto });
  });
  return salida;
}

export interface Encabezado {
  nivel: number;
  titulo: string;
  linea: number;
}

const ENCABEZADO = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;

/** The headings of a Markdown text, ignoring the ones inside code blocks. */
export function encabezados(md: string): Encabezado[] {
  const salida: Encabezado[] = [];
  for (const { n, texto } of lineasDeTexto(md)) {
    const m = ENCABEZADO.exec(texto);
    const titulo = m?.[2]?.trim() ?? "";
    if (m?.[1] && titulo !== "") salida.push({ nivel: m[1].length, titulo, linea: n });
  }
  return salida;
}

export interface Fila {
  linea: number;
  /** Cell text keyed by the normalized header; a cell the row does not have is empty. */
  celdas: Record<string, string>;
}

export interface Tabla {
  cabeceras: string[];
  filas: Fila[];
}

export const MAX_COLUMNAS = 50;
export const MAX_FILAS = 2000;
const SEPARADOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function partirCeldas(linea: string): string[] {
  const texto = linea
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "");
  const celdas: string[] = [];
  let actual = "";
  let enCodigo = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charAt(i);
    if (c === "\\" && texto.charAt(i + 1) === "|") {
      actual += "|";
      i++;
    } else if (c === "`") {
      enCodigo = !enCodigo;
      actual += c;
    } else if (c === "|" && !enCodigo) {
      celdas.push(actual.trim());
      actual = "";
    } else actual += c;
  }
  celdas.push(actual.trim());
  return celdas;
}

/** The pipe tables of a Markdown text (outside code blocks), with each row keyed by its header. */
export function tablas(md: string): Tabla[] {
  const lineas = lineasDeTexto(md);
  const salida: Tabla[] = [];
  const empiezaPorBarra = (l: Linea | undefined): boolean =>
    l !== undefined && l.texto.trimStart().startsWith("|");
  for (let i = 0; i < lineas.length; i++) {
    const cabecera = lineas[i];
    const separador = lineas[i + 1];
    if (!empiezaPorBarra(cabecera) || !separador || separador.n !== (cabecera?.n ?? 0) + 1)
      continue;
    if (!SEPARADOR.test(separador.texto) || !separador.texto.includes("-")) continue;
    const cabeceras = partirCeldas(cabecera?.texto ?? "").map(normalizar);
    if (cabeceras.length > MAX_COLUMNAS) continue;
    const filas: Fila[] = [];
    let j = i + 2;
    let anterior = separador.n;
    for (; j < lineas.length; j++) {
      const fila = lineas[j];
      if (!fila || !empiezaPorBarra(fila) || fila.n !== anterior + 1 || filas.length >= MAX_FILAS)
        break;
      const celdas = partirCeldas(fila.texto);
      filas.push({
        linea: fila.n,
        celdas: Object.fromEntries(cabeceras.map((h, k) => [h, celdas[k] ?? ""])),
      });
      anterior = fila.n;
    }
    salida.push({ cabeceras, filas });
    i = j - 1;
  }
  return salida;
}

export interface Enlace {
  destino: string;
  linea: number;
}

const MAX_DESTINO = 2048;
const MAX_ENLACES_POR_LINEA = 1000;

/**
 * The inline links of a Markdown text (not images, not inside code blocks), without their title.
 * One pass per line and bounded (a destination is cut at 2048 characters, a line yields at most
 * 1000 links), so a line made of nothing but brackets cannot make it quadratic.
 */
export function enlaces(md: string): Enlace[] {
  const salida: Enlace[] = [];
  for (const { n, texto } of lineasDeTexto(md)) {
    let inicio = -1; // the first «[» since the last «]»
    let imagen = false;
    let encontrados = 0;
    for (let i = 0; i < texto.length && encontrados < MAX_ENLACES_POR_LINEA; i++) {
      const c = texto.charAt(i);
      if (c === "[" && inicio < 0) {
        inicio = i;
        imagen = i > 0 && texto.charAt(i - 1) === "!";
      } else if (c === "]") {
        if (inicio >= 0 && !imagen && texto.charAt(i + 1) === "(") {
          let j = i + 2;
          while (/\s/.test(texto.charAt(j))) j++;
          let profundidad = 0;
          let destino = "";
          for (; j < texto.length && destino.length < MAX_DESTINO; j++) {
            const d = texto.charAt(j);
            if (/\s/.test(d)) break;
            if (d === "(") profundidad++;
            if (d === ")") {
              if (profundidad === 0) break;
              profundidad--;
            }
            destino += d;
          }
          if (destino !== "") {
            salida.push({ destino, linea: n });
            encontrados++;
          }
        }
        inicio = -1;
      }
    }
  }
  return salida;
}

export interface Seccion {
  titulo: string;
  nivel: number;
  /** Line of the heading. */
  linea: number;
  /** The text under the heading, up to the next heading of the same or a higher level. */
  cuerpo: Linea[];
  lineas: string[];
}

/** The sections whose heading has exactly `nivel` `#`s, with the text that follows each one. */
export function secciones(md: string, nivel: number): Seccion[] {
  const titulos = encabezados(md);
  const lineas = lineasDeTexto(md);
  const salida: Seccion[] = [];
  titulos.forEach((h, i) => {
    if (h.nivel !== nivel) return;
    const fin = titulos.slice(i + 1).find((x) => x.nivel <= nivel)?.linea ?? Infinity;
    const cuerpo = lineas.filter((l) => l.n > h.linea && l.n < fin);
    salida.push({ ...h, cuerpo, lineas: cuerpo.map((l) => l.texto) });
  });
  return salida;
}
