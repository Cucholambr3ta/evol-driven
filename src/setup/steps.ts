import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { auditorConfigPath, EXAMPLE, readAuditorConfig } from "../skills/auditor/config.js";
import { readManifest, writeManifest } from "../skills/manifest.js";
import { readSkill, SKILL_FILE } from "../skills/skill.js";
import { COMPONENTS, findTool, offPath } from "./catalog.js";
import type { Component } from "./catalog.js";

/**
 * The steps of `evol setup`. Each one asks before it changes anything outside this folder, never
 * uses sudo, and never approves a skill: approving is for a person typing at a terminal.
 */
export interface Prompter {
  yesNo(question: string): Promise<boolean>;
}
export type Say = (line: string) => void;

/* ------------------------------ prerequisites and tools ------------------------------ */

export interface ToolOutcome {
  id: string;
  estado: "ya-estaba" | "instalada" | "fallo" | "manual" | "omitida";
  detalle?: string;
}

export function nodeOk(version: string = process.versions.node): boolean {
  return Number(version.split(".")[0]) >= 24;
}

/** Looks at every component; asks before installing the ones that go into the user's own folder. */
export async function setupTools(
  say: Say,
  prompter: Prompter,
  components: readonly Component[] = COMPONENTS,
): Promise<ToolOutcome[]> {
  const outcomes: ToolOutcome[] = [];
  for (const c of components) {
    const found = findTool(c);
    if (found) {
      outcomes.push({ id: c.id, estado: "ya-estaba" });
      say(`  ✓ ${c.id}${offPath(c) ? " (instalada, pero su carpeta no está en tu PATH)" : ""}`);
      continue;
    }
    const label = `${c.id} (${c.necesidad}: ${c.uso})`;
    if (c.instalar.tipo === "manual") {
      outcomes.push({ id: c.id, estado: "manual", detalle: c.instalar.comando });
      say(`  ! falta ${label}`);
      say(`      instálala tú (necesita permisos de administrador): ${c.instalar.comando}`);
      continue;
    }
    const [program, ...args] = c.instalar.argv;
    const bin = program === "uv" ? findTool({ id: "uv", bin: "uv" }) : program;
    if (!bin) {
      outcomes.push({
        id: c.id,
        estado: "manual",
        detalle: `primero instala uv; luego: ${c.instalar.argv.join(" ")}`,
      });
      say(`  ! falta ${label}`);
      say(`      necesita uv, que no está: instálalo y vuelve a ejecutar evol setup`);
      continue;
    }
    const command = c.instalar.argv.join(" ");
    if (!(await prompter.yesNo(`  falta ${label}. ¿Instalarla con «${command}»? [s/N] `))) {
      outcomes.push({ id: c.id, estado: "omitida" });
      continue;
    }
    const run = spawnSync(bin, args, { stdio: "inherit", timeout: 600_000 });
    if (run.status === 0 && findTool(c)) {
      outcomes.push({ id: c.id, estado: "instalada" });
      say(
        `  ✓ ${c.id} instalada${offPath(c) ? ` (añade ~/.local/bin a tu PATH para que otros programas la vean)` : ""}`,
      );
    } else {
      outcomes.push({
        id: c.id,
        estado: "fallo",
        detalle: `salió con código ${run.status ?? "?"}`,
      });
      say(
        `  × no se pudo instalar ${c.id} (código ${run.status ?? "?"}); revisa la salida de arriba`,
      );
    }
  }
  return outcomes;
}

/* ------------------------------------ the reader ------------------------------------ */

export type ReaderOutcome = "ya-configurado" | "creado" | "omitido" | "sin-opciones";

/** The skill audit needs a reader for its second pass. Offers the Claude Code one if it is installed. */
export async function setupReader(
  say: Say,
  prompter: Prompter,
  claudeBin: string | null,
): Promise<ReaderOutcome> {
  const config = readAuditorConfig();
  if (config) {
    say(`  ✓ lectores configurados: ${config.lectores.map((r) => r.id).join(", ")}`);
    return "ya-configurado";
  }
  if (!claudeBin) {
    say(`  ! no hay ningún lector para la segunda pasada de la auditoría, y no encontré «claude».`);
    say(`      crea ${auditorConfigPath()}, por ejemplo:`);
    for (const line of EXAMPLE.split("\n")) say(`      ${line}`);
    return "sin-opciones";
  }
  if (
    !(await prompter.yesNo(
      `  no hay lector para la auditoría. ¿Configurar Claude Code («${claudeBin}») como lector, sin herramientas? [s/N] `,
    ))
  )
    return "omitido";
  const file = auditorConfigPath();
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify({ version: 1, lectores: [{ id: "claude-code", tipo: "cli", adaptador: "claude-code", comando: "claude" }] }, null, 2)}\n`,
  );
  say(`  ✓ escrito ${file}. Compruébalo con: evol skills audit --autoprueba`);
  return "creado";
}

/* ------------------------------------ the library ------------------------------------ */

export interface SeedResult {
  copiadas: string[];
  iguales: string[];
  /** Same name, different content: left as it was. */
  distintas: string[];
  /** Approvals kept because this very person approved those exact bytes on this machine. */
  aprobacionesConservadas: string[];
}

/**
 * Copies the skills of the package into the person's library. Nothing arrives approved: an approval
 * written in a package says nothing about what this person read. The one exception is an approval
 * of the same bytes, recorded under this user's name, whose audit report is still on this machine.
 */
export function seedLibrary(source: string, libraryDir: string, user: string): SeedResult {
  const result: SeedResult = {
    copiadas: [],
    iguales: [],
    distintas: [],
    aprobacionesConservadas: [],
  };
  if (!existsSync(source)) return result;
  mkdirSync(libraryDir, { recursive: true });
  const sourceManifest = readManifest(source);
  const manifest = readManifest(libraryDir);
  const names = readdirSync(source)
    .filter(
      (n) =>
        !n.startsWith(".") &&
        statSync(join(source, n)).isDirectory() &&
        existsSync(join(source, n, SKILL_FILE)),
    )
    .sort();
  for (const name of names) {
    const from = join(source, name);
    const to = join(libraryDir, name);
    if (existsSync(to)) {
      if (readSkill(to).huella === readSkill(from).huella) result.iguales.push(name);
      else {
        result.distintas.push(name);
        continue;
      }
    } else {
      cpSync(from, to, { recursive: true });
      result.copiadas.push(name);
    }
    const entry = sourceManifest.skills[name];
    if (!entry || manifest.skills[name]) continue;
    const { auditoria, ...rest } = entry;
    const huella = readSkill(to).huella;
    const keep =
      auditoria !== undefined &&
      auditoria.huella === huella &&
      auditoria.aprobadaPor === user &&
      auditoria.informe !== undefined &&
      existsSync(auditoria.informe);
    manifest.skills[name] = keep ? { ...rest, auditoria } : rest;
    if (keep) result.aprobacionesConservadas.push(name);
  }
  writeManifest(libraryDir, manifest);
  return result;
}
