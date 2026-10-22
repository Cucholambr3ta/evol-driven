// Builds the interface mockups into ../mockups from ui/ and data/.
//   node build.mjs [carpeta-de-salida]
// Data refresh (needs the sample projects and a built evol):
//   node collect-docs.mjs <proyectos> <dist/cli.js> <EVOL_CONFIG_DIR>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL("./", import.meta.url).pathname;
const out = process.argv[2] ?? new URL("../mockups", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const read = (f) => readFileSync(dir + f, "utf8");
const data = {
  generado: new Date().toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }),
  portfolio: JSON.parse(read("data/portfolio.json")),
  code: JSON.parse(read("data/code.json")),
  memory: JSON.parse(read("data/memory.json")),
  catalogo: JSON.parse(read("data/catalogo.json")),
};
const safe = (s) => s.replace(/<\/script/gi, "<\\/script");
const page = (title, script, extra = "", lib = "") => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${read("ui/style.css")}</style></head>
<body><script>window.EVOL=${safe(JSON.stringify(data))};${extra}</script>
<script>${read("ui/common.js")}</script>${lib ? `<script>${read("ui/" + lib)}</script>` : ""}<script>${read("ui/" + script)}</script></body></html>
`;
writeFileSync(out + "/index.html", page("Tablero de proyectos", "board.js"));
writeFileSync(out + "/proyecto.html", page("Proyecto", "project.js"));
writeFileSync(out + "/grafos.html", page("Grafos de conocimiento", "graphs.js", "", "stars.js"));
writeFileSync(out + "/documentacion.html", page("Documentación", "docs.js", `window.EVOL_DOCS=${safe(read("data/docs.json").trim())};`, "stars.js"));
writeFileSync(out + "/skills.html", page("Skills", "skills.js", `window.EVOL_SKILLS=${safe(read("data/skills.json").trim())};`));
console.log("escritos 5 archivos en", out);
