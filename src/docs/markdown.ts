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

/** The lines that are not inside a fenced code block; an unclosed fence hides the rest of the text. */
export function lineasDeTexto(md: string): Linea[] {
  const salida: Linea[] = [];
  let valla: { caracter: string; largo: number } | null = null;
  md.split(/\r?\n/).forEach((texto, i) => {
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
    const filas: Fila[] = [];
    let j = i + 2;
    let anterior = separador.n;
    for (; j < lineas.length; j++) {
      const fila = lineas[j];
      if (!fila || !empiezaPorBarra(fila) || fila.n !== anterior + 1) break;
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

/** The inline links of a Markdown text (not images, not inside code blocks), without their title. */
export function enlaces(md: string): Enlace[] {
  const salida: Enlace[] = [];
  for (const { n, texto } of lineasDeTexto(md)) {
    for (const m of texto.matchAll(/(?<!!)\[[^\]]*\]\(/g)) {
      let i = (m.index ?? 0) + m[0].length;
      while (/\s/.test(texto.charAt(i))) i++;
      let profundidad = 0;
      let destino = "";
      for (; i < texto.length; i++) {
        const c = texto.charAt(i);
        if (/\s/.test(c)) break;
        if (c === "(") profundidad++;
        if (c === ")") {
          if (profundidad === 0) break;
          profundidad--;
        }
        destino += c;
      }
      if (destino !== "") salida.push({ destino, linea: n });
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
