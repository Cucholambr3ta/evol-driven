import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { UserError } from "../core/errors.js";
import { AUDIT_LABEL, auditState, readManifest } from "./manifest.js";
import type { AuditState } from "./manifest.js";
import { findSkill } from "./library.js";

/**
 * Installing a skill is making it visible to an IDE, and it is only allowed for one a person approved:
 * the skill stays in the library and the IDE gets a symbolic link, so there is one copy to audit and
 * a change to it is a change the audit notices. Where an IDE looks for skills comes from what each
 * IDE's own agent confirmed; a place nobody has confirmed is not guessed.
 */

export type AgentId = "claude-code" | "codex" | "antigravity" | "opencode" | "hermes";
export const AGENT_IDS: AgentId[] = ["claude-code", "codex", "antigravity", "opencode", "hermes"];
export type Scope = "proyecto" | "global";

interface Places {
  proyecto: string | null;
  global: string | null;
}

const PLACES: Record<AgentId, Places> = {
  "claude-code": { proyecto: ".claude/skills", global: ".claude/skills" },
  codex: { proyecto: ".agents/skills", global: ".agents/skills" },
  // the global place of Antigravity and the project one of Hermes are not confirmed
  antigravity: { proyecto: ".agents/skills", global: null },
  opencode: { proyecto: ".opencode/skills", global: ".config/opencode/skills" },
  hermes: { proyecto: null, global: ".hermes/skills" },
};

export function skillsFolder(
  agent: AgentId,
  scope: Scope,
  projectRoot: string | null,
  home: string = homedir(),
): string | null {
  const rel = PLACES[agent][scope];
  if (rel === null) return null;
  if (scope === "global") return join(home, rel);
  return projectRoot === null ? null : join(projectRoot, rel);
}

export interface InstallOutcome {
  agente: AgentId;
  carpeta: string;
  resultado: "instalada" | "sin-cambios" | "reemplazada" | "no-aplica" | "existe";
  detalle?: string;
}

function linkTarget(path: string): string | null {
  try {
    return lstatSync(path).isSymbolicLink() ? resolve(dirname(path), readlinkSync(path)) : null;
  } catch {
    return null;
  }
}

/** Refuses a skill whose audit is missing or no longer matches its folder. */
export function requireApproved(
  libraryDir: string,
  name: string,
): { path: string; estado: AuditState } {
  const skill = findSkill(libraryDir, name);
  if (skill.error)
    throw new UserError(`La skill «${name}» está rota (${skill.error}); no se instala.`);
  const estado = auditState(skill, readManifest(libraryDir).skills[name]);
  if (estado !== "aprobada" && estado !== "con-avisos")
    throw new UserError(
      `La skill «${name}» está ${AUDIT_LABEL[estado]}: instalar es aprobar primero (evol skills audit y evol skills approve).`,
    );
  return { path: skill.dir, estado };
}

export interface InstallOptions {
  libraryDir: string;
  name: string;
  agents: AgentId[];
  scope: Scope;
  projectRoot: string | null;
  /** Replace what is there instead of leaving it; a real folder is moved aside, never deleted. */
  replace?: boolean;
  home?: string;
}

export function installSkill(opts: InstallOptions): InstallOutcome[] {
  const { path } = requireApproved(opts.libraryDir, opts.name);
  const outcomes: InstallOutcome[] = [];
  const done = new Set<string>();
  for (const agent of opts.agents) {
    const folder = skillsFolder(agent, opts.scope, opts.projectRoot, opts.home);
    if (folder === null) {
      outcomes.push({
        agente: agent,
        carpeta: "",
        resultado: "no-aplica",
        detalle:
          opts.scope === "proyecto" && opts.projectRoot === null
            ? "no estás dentro de un proyecto de evol"
            : `no hay una carpeta de skills ${opts.scope === "global" ? "global" : "de proyecto"} confirmada para ${agent}`,
      });
      continue;
    }
    // Codex and Antigravity read the same folder: one link serves both
    if (done.has(folder)) {
      outcomes.push({
        agente: agent,
        carpeta: folder,
        resultado: "sin-cambios",
        detalle: "misma carpeta que otro agente",
      });
      continue;
    }
    done.add(folder);
    const link = join(folder, opts.name);
    const present = existsSync(link) || linkTarget(link) !== null;
    if (present && linkTarget(link) === path) {
      outcomes.push({ agente: agent, carpeta: folder, resultado: "sin-cambios" });
      continue;
    }
    if (present && !opts.replace) {
      outcomes.push({
        agente: agent,
        carpeta: folder,
        resultado: "existe",
        detalle: `ya hay algo distinto en ${link}; con --reemplazar se aparta y se pone el enlace`,
      });
      continue;
    }
    mkdirSync(folder, { recursive: true });
    if (present) {
      if (linkTarget(link) !== null) rmSync(link);
      else renameSync(link, join(folder, `.${opts.name}.previa-${Date.now()}`));
    }
    symlinkSync(path, link, "dir");
    outcomes.push({
      agente: agent,
      carpeta: folder,
      resultado: present ? "reemplazada" : "instalada",
    });
  }
  return outcomes;
}

export interface InstalledRow {
  agente: AgentId;
  carpeta: string;
  skill: string;
  estado: AuditState | "ajena";
}

/** The links in each agent's folder that point into the library, and whether their audit still holds. */
export function installedSkills(
  libraryDir: string,
  scope: Scope,
  projectRoot: string | null,
  home?: string,
): InstalledRow[] {
  const manifest = readManifest(libraryDir);
  const rows: InstalledRow[] = [];
  const seen = new Set<string>();
  for (const agent of AGENT_IDS) {
    const folder = skillsFolder(agent, scope, projectRoot, home);
    if (folder === null || seen.has(folder) || !existsSync(folder)) continue;
    seen.add(folder);
    for (const name of readdirSync(folder).sort()) {
      const target = linkTarget(join(folder, name));
      if (target === null || dirname(target) !== resolve(libraryDir)) continue;
      let estado: InstalledRow["estado"];
      try {
        estado = auditState(findSkill(libraryDir, name), manifest.skills[name]);
      } catch {
        estado = "sin-auditar";
      }
      rows.push({ agente: agent, carpeta: folder, skill: name, estado });
    }
  }
  return rows;
}

export interface UninstallOutcome {
  agente: AgentId;
  carpeta: string;
  resultado: "quitada" | "no-instalada" | "ajena" | "no-aplica";
  detalle?: string;
}

export interface UninstallOptions {
  libraryDir: string;
  name: string;
  agents: AgentId[];
  scope: Scope;
  projectRoot: string | null;
  home?: string;
}

/**
 * Removes the link `install` made. It only ever removes a symbolic link that points into the
 * library: a real folder, or a link somebody else made, is left exactly as it is.
 */
export function uninstallSkill(opts: UninstallOptions): UninstallOutcome[] {
  const outcomes: UninstallOutcome[] = [];
  const done = new Set<string>();
  for (const agent of opts.agents) {
    const folder = skillsFolder(agent, opts.scope, opts.projectRoot, opts.home);
    if (folder === null) {
      outcomes.push({ agente: agent, carpeta: "", resultado: "no-aplica" });
      continue;
    }
    if (done.has(folder)) {
      outcomes.push({
        agente: agent,
        carpeta: folder,
        resultado: "no-instalada",
        detalle: "misma carpeta que otro agente",
      });
      continue;
    }
    done.add(folder);
    const link = join(folder, opts.name);
    const target = linkTarget(link);
    if (target === null) {
      outcomes.push(
        existsSync(link)
          ? {
              agente: agent,
              carpeta: folder,
              resultado: "ajena",
              detalle: `${link} no es un enlace de evol; no se tocó`,
            }
          : { agente: agent, carpeta: folder, resultado: "no-instalada" },
      );
      continue;
    }
    if (dirname(target) !== resolve(opts.libraryDir)) {
      outcomes.push({
        agente: agent,
        carpeta: folder,
        resultado: "ajena",
        detalle: `${link} apunta fuera de la biblioteca; no se tocó`,
      });
      continue;
    }
    rmSync(link);
    outcomes.push({ agente: agent, carpeta: folder, resultado: "quitada" });
  }
  return outcomes;
}
