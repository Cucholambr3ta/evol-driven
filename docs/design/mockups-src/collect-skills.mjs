// Reads the skills installed on this machine and writes data/skills.json for the Skills screen.
//
//   node collect-skills.mjs [carpeta-con-proyectos-de-muestra]
//
// Read-only. A skill that several agents share through symlinks is one skill with several places.
// The body of a skill is kept only when it is the user's own (the evol library): third-party
// skills contribute metadata, file lists and the review checks, never their text.
// Nothing from the previous evol system is read: evol-driven starts with an empty library.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import YAML from "yaml";

const here = dirname(new URL(import.meta.url).pathname);
const projectsDir = process.argv[2] ? resolve(process.argv[2]) : null;
const home = homedir();
const NOW = Date.now();
const NEW_DAYS = 14;
const MAX_BODY = 8000;
const tilde = (p) => (p.startsWith(home) ? `~${p.slice(home.length)}` : p);

/** Where skills live. `own` = the user's library, whose text can go into the mockup. */
const SOURCES = [
  { id: "biblioteca", label: "Biblioteca evol", dir: join(home, ".config/evol/skills"), agent: null, own: true, editable: true },
  { id: "claude", label: "Claude Code", dir: join(home, ".claude/skills"), agent: "claude" },
  { id: "codex", label: "Codex", dir: join(home, ".codex/skills"), agent: "codex" },
  { id: "agents", label: "Agentes (.agents)", dir: join(home, ".agents/skills"), agent: "agents" },
  { id: "hermes", label: "Hermes", dir: join(home, ".hermes/skills"), agent: "hermes" },
  { id: "omarchy", label: "Omarchy", dir: "/usr/share/omarchy/default/agents/skills", agent: null },
];

const AGENTS = [
  { id: "claude", label: "Claude Code", dir: "~/.claude/skills" },
  { id: "codex", label: "Codex", dir: "~/.codex/skills" },
  { id: "agents", label: "Agentes (.agents)", dir: "~/.agents/skills" },
  { id: "hermes", label: "Hermes", dir: "~/.hermes/skills" },
];

/** Every folder under `dir` that holds a SKILL.md (depth-limited, symlinks followed once). */
function findSkillDirs(dir, depth = 4) {
  const found = [];
  if (!existsSync(dir)) return found;
  const walk = (current, level) => {
    if (existsSync(join(current, "SKILL.md"))) { found.push(current); return; }
    if (level >= depth) return;
    let entries = [];
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".system") continue;
      const full = join(current, e.name);
      let isDir = e.isDirectory();
      if (e.isSymbolicLink()) { try { isDir = statSync(full).isDirectory(); } catch { isDir = false; } }
      if (isDir) walk(full, level + 1);
    }
  };
  walk(dir, 0);
  return found;
}

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".git") walk(full); }
      else if (e.isFile()) out.push({ ruta: relative(root, full), bytes: statSync(full).size, mtime: statSync(full).mtimeMs });
    }
  };
  walk(root);
  return out.sort((a, b) => (a.ruta === "SKILL.md" ? -1 : b.ruta === "SKILL.md" ? 1 : a.ruta.localeCompare(b.ruta)));
}

/** When the YAML is broken, still recover the top-level `key: value` lines so the skill can be shown. */
function looseFront(raw) {
  const front = {};
  let key = null;
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m) {
      key = m[1];
      const v = m[2].replace(/^["']|["']$/g, "").trim();
      front[key] = v === ">" || v === "|" || v === ">-" || v === "|-" ? "" : v;
    } else if (key && /^\s+\S/.test(line) && typeof front[key] === "string") {
      front[key] = `${front[key]} ${line.trim()}`.trim();
    }
  }
  return front;
}

function parseSkill(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { front: null, body: text, error: "no tiene frontmatter (---)" };
  try {
    const front = YAML.parse(m[1]);
    return { front: front && typeof front === "object" ? front : null, body: m[2], error: front && typeof front === "object" ? null : "el frontmatter no es un mapa YAML" };
  } catch (e) {
    return { front: looseFront(m[1]), body: m[2], error: `YAML inválido: ${String(e.message).split("\n")[0]}`, roto: true };
  }
}

const SECRET = /(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}|(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_\-/+=]{16,}['"])/i;
const SCRIPT = /\.(sh|bash|py|js|mjs|ts|rb|pl)$/i;
const NETWORK = /\b(curl|wget|fetch\(|requests\.|https?:\/\/[^\s)'"]+\/(api|v\d))/i;

function review(skillDir, files, front, parseError, folderName) {
  const checks = [];
  const add = (nivel, texto) => checks.push({ nivel, texto });
  if (parseError) add("error", `Frontmatter: ${parseError}. Suele arreglarse poniendo la description entre comillas o con el bloque «description: >».`);
  else add("ok", "El frontmatter es YAML válido.");
  const name = front?.name;
  if (!name) add("error", "Falta el campo name.");
  else if (name !== folderName) add("aviso", `name («${name}») no coincide con la carpeta («${folderName}»).`);
  else add("ok", "name coincide con la carpeta.");
  const desc = typeof front?.description === "string" ? front.description.replace(/\s+/g, " ").trim() : "";
  if (!desc) add("error", "Falta description: sin ella el agente no sabe cuándo usarla.");
  else if (desc.length < 40) add("aviso", `description es muy corta (${desc.length} caracteres): conviene decir cuándo usarla.`);
  else add("ok", `description clara (${desc.length} caracteres).`);
  const big = files.filter((f) => f.bytes > 1_000_000);
  if (big.length) add("aviso", `Archivos de más de 1 MB: ${big.map((f) => f.ruta).join(", ")}.`);
  const scripts = files.filter((f) => SCRIPT.test(f.ruta));
  const flagged = [];
  let leaked = false;
  for (const f of files) {
    if (f.bytes > 512_000) continue;
    let t = "";
    try { t = readFileSync(join(skillDir, f.ruta), "utf8"); } catch { continue; }
    if (SECRET.test(t)) leaked = true;
    if (SCRIPT.test(f.ruta) && NETWORK.test(t)) flagged.push(f.ruta);
  }
  if (leaked) add("error", "Parece contener una clave o un token escrito en claro.");
  else add("ok", "No se encontraron claves en los archivos.");
  if (scripts.length) add("aviso", `Incluye ${scripts.length} script(s) que el agente puede ejecutar: ${scripts.slice(0, 4).map((s) => s.ruta).join(", ")}${scripts.length > 4 ? "…" : ""}. Revísalos antes de usarla.`);
  if (flagged.length) add("aviso", `Scripts que acceden a la red: ${flagged.join(", ")}.`);
  if (!scripts.length) add("ok", "Solo instrucciones: no trae scripts.");
  return checks;
}

/** The 31 disciplines of evol-driven (disciplines/*.json). Each one will need a skill that applies it. */
const disciplines = new Map(
  readdirSync(join(here, "../../../disciplines")).filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(here, "../../../disciplines", f), "utf8"))).map((d) => [d.id, d]),
);
const skills = new Map(); // realpath -> skill
for (const src of SOURCES) {
  for (const dir of findSkillDirs(src.dir)) {
    const real = realpathSync(dir);
    const viaLink = lstatSync(dir).isSymbolicLink() || realpathSync(src.dir) !== resolve(src.dir) || real !== resolve(dir);
    let skill = skills.get(real);
    if (!skill) {
      const files = listFiles(real);
      const raw = readFileSync(join(real, "SKILL.md"), "utf8");
      const { front, body, error, roto } = parseSkill(raw);
      const folderName = basename(real);
      const own = SOURCES.find((s) => s.own && real.startsWith(resolve(s.dir))) !== undefined;
      const group = relative(src.dir, dirname(dir));
      const tipos = (v) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []);
      const mtime = Math.max(...files.map((f) => f.mtime));
      const sha = createHash("sha256");
      for (const f of files) sha.update(f.ruta).update(readFileSync(join(real, f.ruta)));
      const desc = typeof front?.description === "string" ? front.description.replace(/\s+/g, " ").trim() : "";
      skill = {
        id: `${folderName}-${createHash("sha1").update(real).digest("hex").slice(0, 6)}`,
        nombre: typeof front?.name === "string" ? front.name : folderName,
        carpeta: folderName,
        descripcion: desc,
        categoria: typeof front?.category === "string" ? front.category : group && !group.startsWith("..") ? group.split("/")[0] : null,
        origen: typeof front?.origin === "string" ? front.origin : null,
        licencia: typeof front?.license === "string" ? front.license : null,
        version: front?.version != null ? String(front.version) : null,
        triggers: tipos(front?.triggers ?? front?.trigger).slice(0, 8),
        cuandoUsarla: tipos(front?.when_to_use).slice(0, 6),
        compatible: tipos(front?.compatible_with),
        frontmatter: front ? Object.fromEntries(Object.entries(front).filter(([k]) => !["name", "description"].includes(k)).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 200) : v])) : {},
        archivos: files.map(({ ruta, bytes }) => ({ ruta, bytes })),
        bytes: files.reduce((n, f) => n + f.bytes, 0),
        huella: sha.digest("hex").slice(0, 16),
        modificado: new Date(mtime).toISOString(),
        nueva: NOW - mtime < NEW_DAYS * 86_400_000,
        propia: own,
        fuente: src.id,
        frontmatterRoto: roto === true,
        revision: review(real, files, front, error, folderName),
        lugares: [],
        proyectos: [],
        ...(own ? { texto: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}\n\n…(recortado: el cuerpo tiene ${body.length} caracteres)` : body, cuerpoCompleto: body.length <= MAX_BODY } : { texto: null }),
      };
      skills.set(real, skill);
    }
    skill.lugares.push({ fuente: src.id, agente: src.agent, ruta: tilde(dir), enlace: viaLink });
    if (skill.propia && skill.grupo === undefined) { skill.grupo = null; skill.disciplina = null; }
    // The first source that finds it names it, but a skill the user owns stays "own".
    if (src.own && !skill.propia) skill.propia = true;
  }
}

// Which sample projects carry a skill of the same name.
if (projectsDir && existsSync(projectsDir)) {
  for (const p of readdirSync(projectsDir)) {
    for (const where of ["skills", ".claude/skills", ".agents/skills", ".evol/skills"]) {
      for (const dir of findSkillDirs(join(projectsDir, p, where), 2)) {
        for (const s of skills.values()) {
          if (s.carpeta === basename(dir)) s.proyectos.push({ proyecto: p, ruta: `${where}/${basename(dir)}` });
        }
      }
    }
  }
}

const list = [...skills.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
const sources = SOURCES.map((s) => ({
  id: s.id, label: s.label, dir: tilde(s.dir), existe: existsSync(s.dir), editable: Boolean(s.editable),
  total: list.filter((k) => k.lugares.some((l) => l.fuente === s.id)).length,
}));
// "New" means recently added to the library, not a recent file date: the legacy skills were cloned today.
for (const k of list) {
  if (k.propia) k.enBiblioteca = k.lugares.some((l) => l.fuente === "biblioteca");
  k.nueva = k.enBiblioteca === true && NOW - new Date(k.modificado).getTime() < NEW_DAYS * 86_400_000;
}
// Each agent: whether it is installed here, how many skills it sees and how many come from the library.
const agentes = AGENTS.map((a) => {
  const mine = list.filter((k) => k.lugares.some((l) => l.agente === a.id));
  return {
    ...a, existe: existsSync(join(home, a.dir.slice(2))), total: mine.length,
    deLaBiblioteca: mine.filter((k) => k.enBiblioteca).length, ajenas: mine.filter((k) => !k.propia).length,
    conAvisos: mine.filter((k) => k.revision.some((c) => c.nivel !== "ok")).length,
    enlazadas: mine.filter((k) => k.lugares.some((l) => l.agente === a.id && l.enlace)).length,
  };
});
// The only way into the library: an agent audits the skill first. These are the checks it runs.
const auditoria = {
  agente: "skill-auditor",
  etapas: [
    ["solicitud", "Solicitud", "Le pasas la ruta, el .zip o el enlace con la versión fijada (@sha) de la skill. La página no la recibe ni la copia."],
    ["cuarentena", "Cuarentena", "El agente la copia a una carpeta aislada fuera de la biblioteca; nada se ejecuta ni queda visible para otros agentes."],
    ["auditoria", "Auditoría", "Las reglas de evol revisan cada archivo y el agente skill-auditor hace una segunda pasada; el informe queda en la auditoría del proyecto."],
    ["veredicto", "Veredicto", "PASS (aprobada), WARN (con avisos) o BLOCK (bloqueada). Un error crítico bloquea sin anulación; un aviso exige que lo aceptes por escrito."],
    ["biblioteca", "Biblioteca", "Solo si hay veredicto, el agente la copia a la biblioteca con su huella y el informe, y queda en el diario."],
  ],
  comprobaciones: [
    ["Secretos", "Claves, tokens, contraseñas y rutas con credenciales en cualquier archivo, incluidos los de ejemplo."],
    ["Filtraciones", "Instrucciones o scripts que envíen contenido de tus proyectos, variables de entorno o memoria a un tercero."],
    ["Scripts", "Qué ejecuta cada script, con qué permisos y si escribe fuera de la carpeta de la skill (rm, chmod, sudo, eval, curl | sh)."],
    ["Red", "Dominios a los que llama; todo dominio fuera de una lista permitida es un aviso."],
    ["Inyección de instrucciones", "Texto que intente cambiar las reglas del agente: ignorar instrucciones previas, ocultar acciones o pedir permisos amplios."],
    ["Funcionamiento", "Frontmatter válido, name = carpeta, description útil, referencias a archivos que existen y que no choque con otra skill."],
    ["Procedencia", "Origen, licencia y versión; la huella SHA-256 queda registrada para detectar cambios posteriores."],
    ["Herencia del sistema anterior", "Ninguna referencia al sistema evol previo: ni su nombre, ni su marco de metodologías, ni sus rutas y comandos que no existan en evol-driven."],
  ],
};
const out = {
  generado: new Date(NOW).toISOString(), diasNueva: NEW_DAYS, totalDisciplinas: disciplines.size, fuentes: sources, agentes, auditoria,
  grupos: [], disciplinas: [...disciplines.values()].map((d) => ({ id: d.id, nombre: d.nombre, tipo: d.tipo, fases: d.fases ?? [] })).sort((a, b) => (a.tipo === b.tipo ? a.id.localeCompare(b.id) : a.tipo === "base" ? -1 : 1)), skills: list,
};
writeFileSync(join(here, "data/skills.json"), `${JSON.stringify(out)}\n`);
const own = list.filter((s) => s.propia).length;
console.log(`skills.json: ${list.length} skills (${own} propias), ${sources.map((s) => `${s.id}=${s.total}`).join(" ")}, ${(statSync(join(here, "data/skills.json")).size / 1024).toFixed(0)} KB`);
