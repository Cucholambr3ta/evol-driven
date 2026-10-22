import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { writeAgentFiles } from "../agents/files.js";
import { detectLayout } from "../core/adopt.js";
import { parseConfig, saveConfig } from "../core/config.js";
import type { EvolConfig, ModuleConfig } from "../core/config.js";
import { loadDisciplines } from "../core/disciplines.js";
import { UserError } from "../core/errors.js";
import { ensureKey } from "../core/gate.js";
import { journalAppend } from "../core/journal.js";
import { getProfile } from "../core/profiles.js";
import { CONFIG_FILE, EVOL_DIR, findProjectRoot } from "../core/paths.js";
import { isPhase, PHASES } from "../core/phases.js";
import type { Phase } from "../core/phases.js";
import { loadContext } from "../core/pipeline.js";
import { initState } from "../core/state.js";
import { renderStatus, statusReport } from "../core/status.js";
import { makeRecorder } from "../memory/events.js";
import { printAgentReport } from "./agents.js";
import { out, warn } from "./shared.js";
import { confirmByTyping, hasTerminal } from "./tty.js";
import { NotInteractiveError } from "../core/errors.js";

const MODULE_SPEC = /^([a-z][a-z0-9-]*)=([^:]+)(?::(.+))?$/;
const GITIGNORE_LINE = ".evol/codegraph.sqlite*";

/** Prettier-using projects would flag evol's generated JSON; keep it out of their format check. */
function ensurePrettierIgnore(root: string): string | null {
  const pkg = join(root, "package.json");
  let uses = readdirSync(root).some(
    (f) => f.startsWith(".prettierrc") || f.startsWith("prettier.config"),
  );
  if (!uses && existsSync(pkg)) {
    try {
      const parsed = JSON.parse(readFileSync(pkg, "utf8")) as {
        devDependencies?: object;
        dependencies?: object;
      };
      uses = "prettier" in { ...parsed.dependencies, ...parsed.devDependencies };
    } catch {
      // not a readable package.json
    }
  }
  if (!uses) return null;
  const file = join(root, ".prettierignore");
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const missing = ["evol.config.json", ".evol"].filter((l) => !current.split("\n").includes(l));
  if (missing.length === 0) return null;
  const separator = current === "" || current.endsWith("\n") ? "" : "\n";
  appendFileSync(file, `${separator}${current === "" ? "" : "\n# evol\n"}${missing.join("\n")}\n`);
  return `Prettier detectado: añadí ${missing.join(" y ")} a .prettierignore`;
}

export function sanitizeName(raw: string): string {
  const name = raw
    .replace(/^@[^/]+\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new UserError(
      `No se pudo derivar un nombre válido de «${raw}». Indica uno con --name (minúsculas, números y guiones; empieza con letra).`,
    );
  }
  return name;
}

function projectName(root: string): string {
  const file = join(root, "package.json");
  if (existsSync(file)) {
    try {
      const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: string };
      if (pkg.name) return pkg.name;
    } catch {
      // fall back to the folder name
    }
  }
  return basename(root);
}

function parseIds(list: string | undefined, fallback: string[]): string[] {
  if (!list) return fallback;
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      name: { type: "string" },
      modulo: { type: "string", multiple: true },
      disciplinas: { type: "string" },
      fase: { type: "string" },
      perfil: { type: "string" },
      "no-memory": { type: "boolean" },
      "no-agentes": { type: "boolean" },
    },
  });

  const root = resolve(positionals[0] ?? process.cwd());
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new UserError(`No existe la carpeta ${root}.`);
  }
  const enclosing = findProjectRoot(root);
  if (enclosing) {
    throw new UserError(
      enclosing === root
        ? `${root} ya es un proyecto evol (${CONFIG_FILE}).`
        : `${root} está dentro del proyecto evol ${enclosing}. Para un submódulo, defínelo en su ${CONFIG_FILE}.`,
    );
  }
  if (existsSync(join(root, EVOL_DIR, "state.json"))) {
    throw new UserError(`Ya hay un estado de evol en ${join(root, EVOL_DIR)}; no se sobrescribe.`);
  }

  const phase: Phase =
    values.fase === undefined
      ? "briefing"
      : isPhase(values.fase)
        ? values.fase
        : (() => {
            throw new UserError(`--fase debe ser una de: ${PHASES.join(", ")}.`);
          })();
  // Joining midway marks earlier phases as done without approvals, so a person must say so.
  if (phase !== "briefing" && !hasTerminal()) throw new NotInteractiveError();

  const registry = loadDisciplines();
  const name = sanitizeName(values.name ?? projectName(root));
  if (values.perfil !== undefined && values.disciplinas !== undefined) {
    throw new UserError("Usa --perfil o --disciplinas, no los dos.");
  }
  const profile = values.perfil ?? "base";
  const shared = parseIds(values.disciplinas, getProfile(profile).disciplinas);

  const specs = values.modulo ?? [];
  const parsed =
    specs.length === 0
      ? [{ name: "app", root: ".", ids: shared }]
      : specs.map((spec) => {
          const m = MODULE_SPEC.exec(spec);
          if (!m)
            throw new UserError(
              `--modulo «${spec}» no es válido. Formato: nombre=ruta[:ID,ID,...]`,
            );
          return { name: m[1] as string, root: m[2] as string, ids: parseIds(m[3], shared) };
        });

  const notes: string[] = [];
  const modules: ModuleConfig[] = parsed.map((m) => {
    const dir = join(root, m.root);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      throw new UserError(`La carpeta del módulo «${m.name}» no existe: ${dir}`);
    }
    const detection = detectLayout(dir, m.ids, registry);
    notes.push(...detection.notes.map((n) => `[${m.name}] ${n}`));
    return {
      name: m.name,
      root: m.root,
      disciplinas: m.ids,
      ...(Object.keys(detection.rutas).length > 0 ? { rutas: detection.rutas } : {}),
      ...(Object.keys(detection.comandos).length > 0 ? { comandos: detection.comandos } : {}),
    };
  });

  const config: EvolConfig = parseConfig(
    {
      name,
      version: 1,
      codeIntel: "native",
      memory: { wing: name.replace(/-/g, "_"), enabled: values["no-memory"] !== true },
      qa: { requireTestsForChangedSymbols: false, requireCriteriaCoverage: false },
      modules,
    },
    registry,
  );

  if (phase !== "briefing") {
    await confirmByTyping(
      `Adoptar «${name}» en la fase «${phase}» marca como hechas, sin aprobación, las anteriores (${PHASES.slice(0, PHASES.indexOf(phase)).join(", ")}). Escribe la fase para confirmar: `,
      phase,
    );
  }

  // Everything is validated: from here on we only add files.
  saveConfig(root, config);
  const state = initState(root, phase);
  ensureKey(state.projectId);
  journalAppend(root, "project-adopted", { name, phase, perfil: profile });

  const gitignore = join(root, ".gitignore");
  if (!existsSync(gitignore)) writeFileSync(gitignore, `${GITIGNORE_LINE}\n`);
  else if (!readFileSync(gitignore, "utf8").includes("codegraph.sqlite")) {
    appendFileSync(
      gitignore,
      `\n# evol: datos derivados (se reconstruyen con \`evol index\`)\n${GITIGNORE_LINE}\n`,
    );
  }

  const prettier = ensurePrettierIgnore(root);

  out(`Proyecto «${name}» adoptado en ${root} (fase ${phase}).`);
  out("Creado: evol.config.json, .evol/ y la clave del gate (en tu configuración de usuario).");
  if (prettier) out(`  · ${prettier}`);
  for (const note of notes) out(`  · ${note}`);

  if (values["no-agentes"] !== true) {
    out("Integración con agentes:");
    printAgentReport(writeAgentFiles(root));
  }

  const ctx = loadContext(root);
  if (config.memory.enabled) {
    await makeRecorder(root, config, warn)("project-adopted", { name, phase });
  }
  out("");
  for (const line of renderStatus(statusReport(ctx))) out(line);
  out("");
  out(
    "Siguiente: completa lo que marque ✗, y cuando una fase esté lista: evol approve <fase> y evol next.",
  );
  return 0;
}
