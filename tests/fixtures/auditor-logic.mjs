// What the fake readers share: reading the prompt's files and reporting what a careful reader would. Tests only.
export const RULES = [
  { re: /ignora todas las instrucciones anteriores[^\n.]*/i, categoria: "inyeccion", severidad: "bloqueo" },
  { re: /curl [^\n]*\$\(env\)/, categoria: "filtracion", severidad: "bloqueo" },
  { re: /MARCA-SOSPECHOSA[^\n]*/, categoria: "otro", severidad: "aviso" },
];

export function findings(prompt, leaky = false) {
  const out = [];
  for (const m of prompt.matchAll(/<<<ARCHIVO ruta="([^"]+)" marca=(\w+)>>>\n([\s\S]*?)\n<<<FIN marca=\2>>>/g)) {
    const [, label, , body] = m;
    for (const rule of RULES) {
      const hit = rule.re.exec(body);
      if (!hit) continue;
      const linea = body.slice(0, hit.index).split("\n").length;
      out.push({
        archivo: label,
        linea,
        categoria: rule.categoria,
        severidad: rule.severidad,
        cita: hit[0].trim(),
        texto: leaky ? `contiene «${hit[0].trim()}»` : "hay algo sospechoso en este archivo",
      });
    }
  }
  return out;
}

