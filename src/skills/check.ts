import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ManifestEntry } from "./manifest.js";
import { binaryKind } from "./inventory.js";
import { MAX_FILES } from "./skill.js";
import type { Skill, SkillFile } from "./skill.js";

export type Level = "ok" | "aviso" | "error";

export interface Finding {
  regla: string;
  nivel: Level;
  texto: string;
  archivo?: string;
}

export interface CheckResult {
  skill: string;
  nivel: Level;
  hallazgos: Finding[];
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SCRIPT = /\.(sh|bash|zsh|py|js|mjs|cjs|ts|rb|pl|ps1)$/i;
const MAX_TEXT_BYTES = 512_000;

const SECRET =
  /(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}|(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_\-/+=]{16,}['"])/gi;
/** Documentation is full of «token: "your_token_here"»: a value that says it is an example is not a secret. */
const PLACEHOLDER =
  /example|your|xxx|placeholder|changeme|replace|ejemplo|tu[_-]|\*{3,}|\.{3}|(.)\1{7,}/i;

export function hasSecret(body: string): boolean {
  return [...body.matchAll(SECRET)].some((m) => !PLACEHOLDER.test(m[0]));
}
const NETWORK = /\b(curl|wget|ncat?)\s|fetch\(|requests\.|urllib|http\.client|axios|https?:\/\//i;
/** A skill of evol-driven carries nothing from the previous evol system: names, paths or commands. */
const LEGACY =
  /\bx-?dd\b|evol-system|\bevol-dd\b|\bpython3?\s+scripts\/evol[-_]|\.evol\/\.gate[-_]?key|\bedms\b|\bevol_cli\b/i;
/** A description should say WHEN to use the skill, not HOW it works: steps in it replace the skill. */
const PROCEDURE = /(^|\n)\s*(\d+[.)]|[-*])\s+\S|\bpaso\s+1\b/i;

const worst = (findings: Finding[]): Level =>
  findings.some((f) => f.nivel === "error")
    ? "error"
    : findings.some((f) => f.nivel === "aviso")
      ? "aviso"
      : "ok";

interface Content {
  file: SkillFile;
  text: string | null;
  binary: boolean;
}

function readContents(skill: Skill): Content[] {
  return skill.archivos
    .filter((f) => f.enlace === undefined)
    .map((file) => {
      if (file.bytes > MAX_TEXT_BYTES) return { file, text: null, binary: false };
      const buffer = readFileSync(join(skill.dir, file.ruta));
      const binary = buffer.subarray(0, 8000).includes(0);
      return { file, text: binary ? null : buffer.toString("utf8"), binary };
    });
}

export function checkSkill(skill: Skill, entry?: ManifestEntry): CheckResult {
  const out: Finding[] = [];
  const add = (regla: string, nivel: Level, texto: string, archivo?: string): void => {
    out.push({ regla, nivel, texto, ...(archivo ? { archivo } : {}) });
  };

  // 1. Folder and frontmatter
  if (!KEBAB.test(skill.id)) {
    add(
      "carpeta",
      "error",
      `El nombre de la carpeta («${skill.id}») debe ir en minúsculas y con guiones.`,
    );
  }
  if (skill.error) {
    const hint = skill.error.startsWith("YAML")
      ? " Suele arreglarse poniendo el valor entre comillas o con el bloque «description: >»."
      : "";
    add("frontmatter", "error", `Frontmatter: ${skill.error}.${hint}`);
  } else add("frontmatter", "ok", "El frontmatter es YAML válido.");

  const declared = skill.frontmatter["name"];
  if (!skill.error) {
    if (typeof declared !== "string" || declared.trim() === "")
      add("nombre", "error", "Falta el campo name.");
    else if (declared !== skill.id) {
      add(
        "nombre",
        "aviso",
        `name («${declared}») no coincide con la carpeta («${skill.id}»): algunos IDE usan la carpeta como identificador.`,
      );
    } else add("nombre", "ok", "name coincide con la carpeta.");
  }

  // 2. Description
  const d = skill.descripcion;
  const rawDescription =
    typeof skill.frontmatter["description"] === "string" ? skill.frontmatter["description"] : d;
  if (d === "")
    add("descripcion", "error", "Falta description: sin ella el agente no sabe cuándo usarla.");
  else if (d.length < 40)
    add(
      "descripcion",
      "aviso",
      `description es muy corta (${d.length} caracteres): conviene decir cuándo usarla.`,
    );
  else if (d.length > 500 || PROCEDURE.test(rawDescription)) {
    add(
      "descripcion",
      "aviso",
      "La description parece explicar el procedimiento: debe decir cuándo activarse, no cómo trabaja, o el agente la seguirá en vez de leer la skill.",
    );
  } else add("descripcion", "ok", `description clara (${d.length} caracteres).`);

  // 3. Files: symbolic links, size, binaries
  if (skill.truncado)
    add(
      "archivos",
      "error",
      `Tiene más de ${MAX_FILES} archivos: no es una skill, es un proyecto.`,
    );
  for (const f of skill.archivos.filter((x) => x.enlace !== undefined)) {
    add(
      "enlaces",
      "error",
      `Es un enlace simbólico (apunta a «${f.enlace}»): una skill no puede depender de archivos de fuera.`,
      f.ruta,
    );
  }
  const contents = readContents(skill);
  for (const c of contents) {
    if (c.binary) {
      if (binaryKind(c.file.ruta, readFileSync(join(skill.dir, c.file.ruta))) === "recurso")
        add(
          "recursos",
          "aviso",
          "Es un recurso binario (imagen o fuente): no se puede leer, comprueba que lo necesita.",
          c.file.ruta,
        );
      else
        add(
          "binarios",
          "error",
          "Es un archivo binario que no se puede leer: una skill solo lleva texto, imágenes y fuentes.",
          c.file.ruta,
        );
    } else if (c.text === null)
      add("tamano", "aviso", "Es demasiado grande para revisarlo (más de 500 KB).", c.file.ruta);
  }

  // 4. Secrets, scripts, network and inheritance
  const leaked = contents.filter((c) => c.text !== null && hasSecret(c.text));
  for (const c of leaked)
    add("secretos", "error", "Parece contener una clave o un token escrito en claro.", c.file.ruta);
  if (leaked.length === 0) add("secretos", "ok", "No se encontraron claves en los archivos.");

  const scripts = skill.archivos.filter((f) => SCRIPT.test(f.ruta));
  if (scripts.length === 0) add("scripts", "ok", "Solo instrucciones: no trae scripts.");
  else {
    const shown = scripts
      .slice(0, 4)
      .map((s) => s.ruta)
      .join(", ");
    add(
      "scripts",
      "aviso",
      `Incluye ${scripts.length} script(s) que el agente puede ejecutar: ${shown}${scripts.length > 4 ? "…" : ""}. Revísalos antes de usarla.`,
    );
    for (const c of contents.filter(
      (x) => SCRIPT.test(x.file.ruta) && x.text !== null && NETWORK.test(x.text ?? ""),
    )) {
      add(
        "red",
        "aviso",
        "El script accede a la red o menciona direcciones externas.",
        c.file.ruta,
      );
    }
  }

  for (const c of contents) {
    const hit = c.text === null ? null : LEGACY.exec(c.text);
    if (hit)
      add(
        "herencia",
        "error",
        `Hace referencia al sistema evol anterior («${hit[0]}»): una skill de evol-driven no hereda nada de él.`,
        c.file.ruta,
      );
  }

  // 5. Where it belongs in the pipeline
  if (!entry)
    add(
      "fases",
      "aviso",
      "No está en el manifiesto de la biblioteca: no tiene alcance ni fase del pipeline.",
    );
  else if (entry.fases.length === 0)
    add("fases", "aviso", "No está ligada a ninguna fase del pipeline.");
  else add("fases", "ok", `Ligada a: ${entry.fases.join(", ")}.`);

  return { skill: skill.id, nivel: worst(out), hallazgos: out };
}
