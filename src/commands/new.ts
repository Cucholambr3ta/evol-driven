import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { writeAgentFiles } from "../agents/files.js";
import { saveConfig } from "../core/config.js";
import type { EvolConfig } from "../core/config.js";
import { loadDisciplines } from "../core/disciplines.js";
import { UserError } from "../core/errors.js";
import { ensureKey } from "../core/gate.js";
import { journalAppend } from "../core/journal.js";
import { getProfile } from "../core/profiles.js";
import { packageRoot } from "../core/paths.js";
import { initState } from "../core/state.js";
import { makeRecorder } from "../memory/events.js";
import { out, warn } from "./shared.js";

const NAME = /^[a-z][a-z0-9-]*$/;
/** npm drops files called .gitignore from packages, so the template stores it under another name. */
const RENAMED: Record<string, string> = { _gitignore: ".gitignore" };

function copyTemplate(from: string, to: string, vars: Record<string, string>): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    const target = join(to, RENAMED[entry] ?? entry);
    if (statSync(source).isDirectory()) copyTemplate(source, target, vars);
    else {
      let text = readFileSync(source, "utf8");
      for (const [key, value] of Object.entries(vars)) text = text.replaceAll(`{{${key}}}`, value);
      writeFileSync(target, text);
    }
  }
}

/** MemPalace wings are plain lowercase words: letters, digits and underscores. */
export function wingFor(name: string): string {
  return name.replace(/-/g, "_");
}

export default async function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: "string" },
      "no-install": { type: "boolean" },
      "no-git": { type: "boolean" },
      "no-memory": { type: "boolean" },
      conocimiento: { type: "boolean" },
      "no-agentes": { type: "boolean" },
      perfil: { type: "string" },
    },
  });
  const name = positionals[0];
  if (!name)
    throw new UserError(
      "Uso: evol new <nombre> [--dir <carpeta>] [--perfil base|api|web|erp|lib] [--no-install] [--no-git] [--no-memory] [--conocimiento]",
    );
  if (!NAME.test(name)) {
    throw new UserError(
      "El nombre debe empezar con una letra minúscula y usar solo minúsculas, números y guiones.",
    );
  }
  const target = resolve(values.dir ?? process.cwd(), name);
  if (existsSync(target) && readdirSync(target).length > 0) {
    throw new UserError(`La carpeta ${target} ya existe y no está vacía.`);
  }

  const profile = values.perfil ?? "base";
  const disciplinas = getProfile(profile).disciplinas;
  const wing = wingFor(name);
  copyTemplate(join(packageRoot(), "templates", "project"), target, { name, wing });

  const config: EvolConfig = {
    name,
    version: 1,
    codeIntel: "native",
    memory: { wing, enabled: values["no-memory"] !== true },
    qa: { requireTestsForChangedSymbols: true, requireCriteriaCoverage: false },
    modules: [{ name: "app", root: ".", disciplinas }],
    // the reference documentation is off unless the person asks for it
    ...(values.conocimiento === true ? { knowledge: { activo: true } } : {}),
  };
  const unknown = disciplinas.filter((id) => !loadDisciplines().get(id));
  if (unknown.length > 0)
    throw new Error(`Disciplinas base ausentes del registro: ${unknown.join(", ")}`);
  saveConfig(target, config);

  const state = initState(target);
  ensureKey(state.projectId);
  journalAppend(target, "project-created", { name, perfil: profile });

  if (values["no-agentes"] !== true) writeAgentFiles(target);

  if (values["no-git"] !== true) {
    const git = spawnSync("git", ["init", "-q", "-b", "main"], { cwd: target, encoding: "utf8" });
    if (git.status !== 0) warn("no se pudo inicializar Git en el proyecto.");
  }

  if (values["no-install"] !== true) {
    out("Instalando dependencias (npm install)...");
    const install = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: target,
      encoding: "utf8",
    });
    if (install.status !== 0) {
      throw new UserError(
        `El proyecto se creó en ${target}, pero npm install falló:\n${install.stderr.trim().split("\n").slice(-8).join("\n")}`,
      );
    }
  }

  if (config.memory.enabled) {
    await makeRecorder(target, config, warn)("project-created", { name, wing });
  }

  out(`Proyecto «${name}» creado en ${target}`);
  out("Siguiente:");
  out(`  cd ${basename(target) === name ? name : target}`);
  out("  evol status     # qué falta en la fase briefing");
  out(
    "  (completa los archivos marcados con [[COMPLETAR]], luego evol approve briefing y evol next)",
  );
  return 0;
}
