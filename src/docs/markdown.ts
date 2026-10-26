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
