// Reads the skills installed on this machine and writes data/skills.json for the Skills screen.
//
//   node collect-skills.mjs [carpeta-con-proyectos-de-muestra]
//
// Read-only. A skill that several agents share through symlinks is one skill with several places.
// The body of a skill is kept only when it is the user's own (the evol library): third-party
// skills contribute metadata, file lists and the review checks, never their text.
// Nothing from the previous evol system is read: evol-driven starts with an empty library.
import { execFileSync } from "node:child_process";
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
// The first agent of evol-driven: /evol, the orchestrator. It is the single entry point in any IDE; it splits the work
// among sub-agents (one role per pipeline phase) that apply the skill of each discipline. Proposal, not built yet.
const PHASES = ["briefing", "spec", "plan", "build", "qa", "retro"];
// A role is a SKILL (what it knows and does, portable to every IDE). Where independence matters it also gets a thin sub-agent
// wrapper, generated from the skill: fresh context, read-only. The others run in line, in the orchestrator's own session.
const ROLES = {
  analista: { ids: ["UDD", "UXDD", "FDD", "A11yDD"], envoltorio: "en línea", texto: "Entiende al usuario y el problema: casos de uso, experiencia, accesibilidad y funcionalidades." },
  arquitecto: { ids: ["SDD", "DDD", "ADD", "EDA", "ESDD", "ODD_API", "APIVDD", "MDD", "DeprecationDD"], envoltorio: "en línea", texto: "Diseña el sistema: especificación, dominio, arquitectura, eventos, interfaces, versiones y migraciones." },
  constructor: { ids: ["TDD", "RDD", "DebtBudgetDD", "CDCDD"], envoltorio: "en línea", texto: "Escribe el código con pruebas primero, refactoriza y vigila la deuda técnica." },
  verificador: { ids: ["BDD", "ATDD", "CCDD", "PDD", "CHAOS"], envoltorio: "subagente", texto: "Comprueba con ojos frescos: comportamiento, aceptación, contratos, rendimiento y resiliencia. Revisar en el mismo contexto en que se construyó sesga el resultado." },
  seguridad: { ids: ["SecDD", "STDD", "THREAT", "PrivacyDD", "COMPLIANCE"], envoltorio: "subagente", texto: "Amenazas, pruebas de seguridad, privacidad y cumplimiento, en solo lectura y con contexto limpio." },
  operaciones: { ids: ["PIPELINE", "IODD", "ODD_OBS", "SLO"], envoltorio: "en línea", texto: "Integración continua, infraestructura como código, observabilidad y objetivos de servicio." },
};
const ALL = [...disciplines.values()];
const roles = Object.entries(ROLES).map(([rol, r]) => {
  const ds = r.ids.map((id) => disciplines.get(id)).filter(Boolean);
  return { rol, skill: rol, texto: r.texto, envoltorio: r.envoltorio, disciplinas: ds.map((d) => ({ id: d.id, tipo: d.tipo, fases: d.fases ?? [] })), fases: PHASES.filter((f) => ds.some((d) => (d.fases ?? []).includes(f))) };
});
const REASON = { briefing: ["afinar-idea"], spec: ["verificar-afirmaciones"], plan: ["interrogar-plan"], qa: ["verificar-afirmaciones"] };
const mapaFases = PHASES.map((fase) => {
  const activas = ALL.filter((d) => (d.fases ?? []).includes(fase));
  return {
    fase, razonamiento: REASON[fase] ?? [],
    roles: roles.map((r) => ({ rol: r.rol, envoltorio: r.envoltorio, disciplinas: r.disciplinas.filter((d) => d.fases.includes(fase)).map((d) => d.id) })).filter((r) => r.disciplinas.length),
    base: activas.filter((d) => d.tipo === "base").map((d) => d.id).sort(), extendidas: activas.filter((d) => d.tipo !== "base").map((d) => d.id).sort(),
  };
});
// The first skills to write (wave 1), and the one sub-agent that is not a skill on purpose.
const inicial = [
  ...ALL.filter((d) => d.tipo === "base").map((d) => ({ nombre: d.id, tipo: "disciplina" })).sort((x, y) => x.nombre.localeCompare(y.nombre)),
  ...["afinar-idea", "interrogar-plan", "verificar-afirmaciones"].map((nombre) => ({ nombre, tipo: "razonamiento" })),
  ...Object.keys(ROLES).map((nombre) => ({ nombre, tipo: "rol" })),
  { nombre: "evol", tipo: "entrada" },
];
const orquestador = {
  id: "/evol", estado: "por crear",
  resumen: "El único punto de entrada en cualquier IDE: lee el estado del proyecto, parte el trabajo en encargos y los resuelve con la skill del rol que toque, en línea o delegando en un subagente cuando aporta independencia.",
  pasos: [
    ["Arrancar", "Lee el estado por el MCP de evol (fase, qué falta, disciplinas activas), la memoria relevante y las lecciones antes de proponer nada."],
    ["Clasificar", "Decide qué pide la persona: una idea vaga (va a briefing), implementar algo (según la fase), cerrar el ciclo (retrospectiva) o el comando de una fase."],
    ["Comprobar", "Mira que existan los artefactos de la fase anterior; si falta alguno se detiene y dice cuál, en vez de seguir."],
    ["Dividir", "Parte el trabajo en encargos pequeños, cada uno con su artefacto y su criterio de «terminado», y activa las disciplinas de la fase respetando sus dependencias."],
    ["Repartir", "Carga la skill del rol y la de la disciplina y trabaja en línea; o delega en un subagente con contexto limpio cuando hace falta revisar con ojos frescos, en solo lectura o en paralelo."],
    ["Verificar", "Reúne los resultados y los pasa por la verificación de evol, que responde PASS, WARN o BLOCK. Un BLOCK detiene el avance."],
    ["Parar", "Se detiene ante cada aprobación: aprobar y avanzar de fase lo hace una persona, en su terminal."],
  ],
  patrones: [
    ["En línea", "Carga la skill del rol y trabaja en la misma sesión. Funciona en cualquier IDE y es lo normal."],
    ["Delegado", "Un subagente con contexto limpio hace la tarea: revisión con ojos frescos y en solo lectura."],
    ["Delegado en paralelo, con sincronización", "Varios subagentes a la vez y un punto de encuentro formal (p. ej. antes de aprobar la especificación)."],
  ],
  razonamiento: [
    ["Antes del briefing", "Afinar la idea: convertir un pedido vago en una propuesta de una página."],
    ["Antes de aprobar el plan", "Interrogar el plan: un plan que nadie cuestionó no se aprueba; la verificación lo exige."],
    ["En especificación y calidad", "Verificar afirmaciones externas (benchmarks, avisos de seguridad) antes de darlas por ciertas."],
  ],
  hace: ["Elegir la fase, las disciplinas y los roles que tocan", "Dividir el trabajo y repartirlo", "Pedir verificaciones y reunir resultados", "Proponer, nunca imponer, el siguiente paso"],
  noHace: ["Aprobar ni avanzar de fase", "Instalar skills ni crear agentes", "Tocar la gobernanza ni la configuración de evol", "Escribir el código él mismo: lo hace el rol constructor, en línea o delegado"],
};
// How each tool is reached. "si" = known and used; "verificar" = reported by secondary sources, check the vendor docs first.
const ides = [
  { id: "claude-code", label: "Claude Code (terminal y VS Code)", entrega: "primera", instrucciones: ["si", "CLAUDE.md, que importa AGENTS.md"], skills: ["si", ".claude/skills"], mcp: ["si", ".mcp.json"], entrada: ["si", "comando /evol o skill"], subagentes: ["si", ".claude/agents"], bloqueo: ["si", "permissions.deny en settings.json"] },
  { id: "codex", label: "Codex 0.163", entrega: "primera", instrucciones: ["si", "AGENTS.md (32 KiB); no lee CLAUDE.md"], skills: ["si", ".agents/skills y ~/.agents/skills"], mcp: ["si", ".codex/config.toml (repo de confianza)"], entrada: ["si", "skill $evol (no hay /evol propio)"], subagentes: ["si", ".codex/agents/*.toml; tope configurable"], bloqueo: ["parcial", "regla forbidden (solo fuera del sandbox) + hook PreToolUse"] },
  { id: "antigravity", label: "Antigravity 1.107", entrega: "primera", instrucciones: ["si", "AGENTS.md y GEMINI.md; reglas en .agents/rules"], skills: ["si", ".agents/skills"], mcp: ["parcial", "global ~/.gemini/config; por proyecto solo vía plugin"], entrada: ["si", "workflow .agents/workflows/evol.md → /evol"], subagentes: ["si", ".agents/agents; en paralelo, sin tope conocido"], bloqueo: ["si", "hook PreToolUse o lista de bloqueo (documentado)"] },
  { id: "opencode", label: "OpenCode 2", entrega: "primera", instrucciones: ["si", "AGENTS.md (no lee CLAUDE.md)"], skills: ["si", ".opencode/skills; lee también .claude y .agents"], mcp: ["si", "opencode.json › mcp.servers"], entrada: ["si", ".opencode/commands/evol.md (la lanza la persona)"], subagentes: ["si", ".opencode/agents; profundidad 1"], bloqueo: ["si", "permissions: shell + «evol approve *» = deny (probado)"] },
  { id: "hermes", label: "Hermes", entrega: "primera", instrucciones: ["si", "AGENTS.md y SOUL.md (visto en su código)"], skills: ["si", "~/.hermes/skills (SKILL.md)"], mcp: ["parcial", "config.yaml global: mcp_servers"], entrada: ["verificar", "comando de barra o skill"], subagentes: ["si", "delegate_task, con tope de concurrencia"], bloqueo: ["verificar", "—"] },
  { id: "gemini-cli", label: "Gemini CLI", entrega: "despues", instrucciones: ["si", "GEMINI.md (o AGENTS.md con context.fileName)"], skills: ["verificar", "—"], mcp: ["si", "settings.json"], entrada: ["si", "comando personalizado .gemini/commands"], subagentes: ["verificar", "—"], bloqueo: ["verificar", "—"] },
  { id: "cursor", label: "Cursor", entrega: "despues", instrucciones: ["si", "AGENTS.md y .cursor/rules"], skills: ["verificar", "parcial"], mcp: ["si", ".cursor/mcp.json"], entrada: ["verificar", "comando o regla"], subagentes: ["verificar", "—"], bloqueo: ["verificar", "—"] },
  { id: "windsurf", label: "Windsurf", entrega: "despues", instrucciones: ["verificar", ".windsurf/rules"], skills: ["verificar", "—"], mcp: ["si", "mcp_config.json"], entrada: ["si", "workflow .windsurf/workflows"], subagentes: ["verificar", "—"], bloqueo: ["verificar", "—"] },
  { id: "copilot", label: "GitHub Copilot", entrega: "despues", instrucciones: ["si", "copilot-instructions.md"], skills: ["verificar", "—"], mcp: ["si", "mcp.json de VS Code"], entrada: ["si", "prompt .github/prompts"], subagentes: ["verificar", "agentes personalizados"], bloqueo: ["verificar", "—"] },
];
// Agent CLIs the skill-auditor subprocess could run through. Eligible only if evol can prove it runs read-only, with no shell and
// no network (isolation test); "instalado" is what this machine has.
const onPath = (cmd) => { try { execFileSync("which", [cmd], { stdio: "ignore" }); return true; } catch { return false; } };
const RUNNERS = [
  ["claude", "Claude Code", "claude"], ["codex", "Codex", "codex"], ["opencode", "OpenCode", "opencode"], ["gemini", "Gemini CLI", "gemini"],
  ["hermes", "Hermes", "hermes"], ["copilot", "GitHub Copilot CLI", "copilot"], ["cursor-agent", "Cursor Agent", "cursor-agent"],
  ["grok", "Grok", "grok"], ["pi", "Pi", "pi"], ["api", "API directa", null],
].map(([id, label, cmd]) => ({ id, label, comando: cmd, instalado: cmd ? onPath(cmd) : null }));
// The only way into the library: an agent audits the skill first. These are the checks it runs.
const auditoria = {
  agente: "skill-auditor", // a sub-agent, not a skill: read-only, no shell, so a hostile skill cannot steer it
  etapas: [
    ["solicitud", "Solicitud", "Le pasas la ruta, el .zip o el enlace fijado con @sha. La página no la recibe ni la copia."],
    ["cuarentena", "Cuarentena", "evol la copia a una carpeta aislada como instantánea inmutable con su hash; nada se ejecuta ni queda visible para otros agentes."],
    ["reglas", "Pasada 1: reglas", "Reglas fijas de evol, sin modelo: son las únicas que bloquean. Si falta una herramienta requerida, la skill queda «no auditada»."],
    ["subproceso", "Pasada 2: subproceso", "evol lanza el subproceso skill-auditor, aislado y de solo lectura. Solo puede añadir hallazgos; nunca baja un BLOCK."],
    ["veredicto", "Veredicto", "PASS, WARN o BLOCK. Un error crítico bloquea sin anulación; un aviso exige que lo aceptes por escrito."],
    ["aprobacion", "Aprobación de una persona", "Tú lo apruebas en tu terminal. Con scripts, ves sus capacidades y escribes el nombre de la skill."],
    ["biblioteca", "Biblioteca", "Se instala la misma instantánea que se auditó, con su hash y el informe, y queda en el diario."],
  ],
  niveles: [
    ["Propia (de evol-driven)", "Pasada 1 y subproceso."],
    ["De terceros, sin scripts", "Pasada 1 y subproceso."],
    ["De terceros, con scripts", "Todos los controles de scripts, dos lecturas del subproceso con CLI distintos, aprobación reforzada y confirmación al ejecutar."],
  ],
  scripts: [
    ["Inventario y límites", "Solo texto en shell, Python, JavaScript o TypeScript. Se rechazan binarios ilegibles (las imágenes y fuentes avisan), comprimidos, código minificado u ofuscado, enlaces que salen de la carpeta y rutas con «..». Se quita el permiso de ejecución."],
    ["Capacidades declaradas", "Cada script declara qué red usa, qué escribe, qué comandos lanza y qué variables lee. Si el análisis detecta más, o no declara nada, es BLOCK."],
    ["Análisis estático", "Patrones peligrosos (descarga y ejecución, eval, sudo, credenciales) y semgrep; falla cerrada si falta la herramienta."],
    ["Dependencias", "Archivo de bloqueo con versiones fijas, sin ganchos de instalación, y análisis de vulnerabilidades."],
    ["Secretos y red", "gitleaks, y toda salida de red no declarada es BLOCK."],
    ["Dos lecturas", "El subproceso lee cada script con dos CLI distintos; con uno solo queda un aviso que aceptas por escrito."],
    ["Análisis dinámico (opcional)", "Con tu permiso, en un sandbox sin red, solo lectura y credenciales trampa; cualquier intento de usarlas es BLOCK."],
    ["Integridad", "Lo instalado es la instantánea auditada, verificada por hash; si un archivo cambia, vuelve a «sin auditar»."],
    ["Ejecución con confirmación", "Cada IDE pide confirmación antes de ejecutar un script de una skill de terceros."],
    ["Aprobación reforzada", "Resumen de capacidades, hallazgos y diferencia de scripts; escribes el nombre de la skill; una versión nueva repite todo."],
  ],
  limites: "Ningún análisis garantiza que un script sea inofensivo: el código ofuscado, las bombas lógicas y los modelos engañados existen. Por eso se combinan capas, se rechaza el código opaco y se aplica el mínimo privilegio al ejecutar. Lo que queda es un riesgo residual que aceptas al aprobar.",
  comprobaciones: [
    ["Secretos", "Claves, tokens, contraseñas y rutas con credenciales en cualquier archivo, incluidos los de ejemplo."],
    ["Filtraciones", "Instrucciones o scripts que envíen contenido de tus proyectos, variables de entorno o memoria a un tercero."],
    ["Scripts", "Qué hace cada script, con qué permisos y si escribe fuera de la carpeta de la skill (rm, chmod, sudo, eval, curl | sh). Nunca se ejecutan durante la auditoría."],
    ["Red", "Dominios a los que llama; todo dominio fuera de una lista permitida es un aviso."],
    ["Inyección de instrucciones", "Texto que intente cambiar las reglas del agente: ignorar instrucciones previas, ocultar acciones o pedir permisos amplios."],
    ["Funcionamiento", "Frontmatter válido, name = carpeta, description útil, referencias a archivos que existen y que no choque con otra skill."],
    ["Procedencia", "Origen, licencia y versión; la huella SHA-256 queda registrada para detectar cambios posteriores."],
    ["Herencia del sistema anterior", "Ninguna referencia al sistema evol previo: ni su nombre, ni su marco de metodologías, ni sus rutas y comandos que no existan en evol-driven."],
  ],
};
const out = {
  generado: new Date(NOW).toISOString(), diasNueva: NEW_DAYS, totalDisciplinas: disciplines.size, fuentes: sources, agentes, orquestador, roles, mapaFases, inicial, ides, runners: RUNNERS, auditoria,
  grupos: [], disciplinas: [...disciplines.values()].map((d) => ({ id: d.id, nombre: d.nombre, tipo: d.tipo, fases: d.fases ?? [] })).sort((a, b) => (a.tipo === b.tipo ? a.id.localeCompare(b.id) : a.tipo === "base" ? -1 : 1)), skills: list,
};
writeFileSync(join(here, "data/skills.json"), `${JSON.stringify(out)}\n`);
const own = list.filter((s) => s.propia).length;
console.log(`skills.json: ${list.length} skills (${own} propias), ${sources.map((s) => `${s.id}=${s.total}`).join(" ")}, ${(statSync(join(here, "data/skills.json")).size / 1024).toFixed(0)} KB`);
