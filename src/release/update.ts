import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { UserError } from "../core/errors.js";
import { readManifest, writeManifest } from "../skills/manifest.js";
import { readSkill, SKILL_FILE } from "../skills/skill.js";
import { makeReadOnly, makeWritable, writeIntegrity } from "./integrity.js";
import { INSTALL_FILE, compareVersions, versionInfo } from "./version.js";
import type { InstallRecord } from "./version.js";

/**
 * Installing a version of the framework: it comes from the signed tag of the repository, is built in
 * a folder of its own, checked, made read-only and only then does the `evol` command point to it. The
 * previous version stays, so going back is changing a link. Nothing happens without the person saying yes.
 */
export const homeDir = (): string =>
  process.env["EVOL_HOME"] ?? join(homedir(), ".local", "share", "evol");
export const versionsDir = (home: string = homeDir()): string => join(home, "versiones");
export const currentLink = (home: string = homeDir()): string => join(home, "actual");
export const previousLink = (home: string = homeDir()): string => join(home, "anterior");
const sourceDir = (home: string): string => join(home, "fuente");

export interface UpdateDeps {
  /** Where updates come from. */
  repo: string;
  home?: string;
  /** The file with the public keys allowed to sign releases. */
  signers: string;
  /** `~/.local/bin/evol`, the command people type. */
  binLink: string;
  /** Builds the checked-out sources in `dir` (npm ci and the build); injected so tests need no network. */
  build: (dir: string) => void;
  /** Shows what the new version brings and asks; false cancels. */
  confirm: (summary: string) => Promise<boolean>;
  log?: (line: string) => void;
  now?: Date;
}

function run(
  cwd: string,
  cmd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): { ok: boolean; out: string; err: string } {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 256 * 1024 * 1024,
    ...(env ? { env } : {}),
  });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

export function listTags(src: string): string[] {
  const r = run(src, "git", ["tag", "--list", "v*"]);
  return r.out
    .split("\n")
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
    .sort(compareVersions);
}

/** Clones the repository once and fetches its tags afterwards. */
export function fetchSource(repo: string, home: string): string {
  const src = sourceDir(home);
  mkdirSync(home, { recursive: true });
  if (!existsSync(join(src, ".git")) && !existsSync(join(src, "HEAD"))) {
    const r = run(home, "git", ["clone", "--quiet", "--no-checkout", repo, src]);
    if (!r.ok) throw new UserError(`No se pudo clonar ${repo}: ${r.err}`);
  } else {
    const set = run(src, "git", ["remote", "set-url", "origin", repo]);
    if (!set.ok) throw new UserError(`No se pudo apuntar a ${repo}: ${set.err}`);
    const r = run(src, "git", ["fetch", "--quiet", "--tags", "--force", "origin"]);
    if (!r.ok) throw new UserError(`No se pudieron traer las versiones de ${repo}: ${r.err}`);
  }
  return src;
}

/** True only if the tag carries a signature by one of the allowed keys. */
export function verifyTag(
  src: string,
  tag: string,
  signers: string,
): { ok: boolean; detail: string } {
  if (!existsSync(signers))
    return {
      ok: false,
      detail: `no existe ${signers}: ahí van las claves públicas autorizadas a firmar versiones (evol setup lo prepara)`,
    };
  const r = run(src, "git", [
    "-c",
    "gpg.format=ssh",
    "-c",
    `gpg.ssh.allowedSignersFile=${signers}`,
    "verify-tag",
    tag,
  ]);
  return {
    ok: r.ok,
    detail: r.ok ? "firma válida" : r.err || "la etiqueta no está firmada por una clave autorizada",
  };
}

export interface Candidate {
  etiqueta: string;
  version: string;
  firma: { ok: boolean; detail: string };
  cambios: string;
}

function changelogOf(src: string, tag: string, version: string): string {
  const r = run(src, "git", ["show", `${tag}:CHANGELOG.md`]);
  if (!r.ok) return "(sin changelog)";
  const start = r.out.indexOf(`## ${version}`);
  if (start === -1) return "(sin changelog para esta versión)";
  const next = r.out.indexOf("\n## ", start + 3);
  return r.out.slice(start, next === -1 ? undefined : next).trim();
}

/** What there is to install, without installing anything. */
export function inspectUpdate(
  deps: Pick<UpdateDeps, "repo" | "home" | "signers">,
  wanted?: string,
): {
  actual: string;
  candidata: Candidate | null;
  etiquetas: string[];
} {
  const home = deps.home ?? homeDir();
  const src = fetchSource(deps.repo, home);
  const etiquetas = listTags(src);
  const current = existsSync(currentLink(home))
    ? versionInfo(resolve(home, readlinkSync(currentLink(home)))).version
    : "0.0.0";
  const tag = wanted
    ? wanted.startsWith("v")
      ? wanted
      : `v${wanted}`
    : etiquetas[etiquetas.length - 1];
  if (!tag || !etiquetas.includes(tag)) {
    if (wanted)
      throw new UserError(
        `No existe la versión ${wanted} en ${deps.repo}. Hay: ${etiquetas.join(", ") || "ninguna"}.`,
      );
    return { actual: current, candidata: null, etiquetas };
  }
  const version = tag.slice(1);
  return {
    actual: current,
    etiquetas,
    candidata: {
      etiqueta: tag,
      version,
      firma: verifyTag(src, tag, deps.signers),
      cambios: changelogOf(src, tag, version),
    },
  };
}

/* ------------------------------------ skills ------------------------------------ */

export interface SyncResult {
  nuevas: string[];
  cambiadas: string[];
  iguales: string[];
  /** The changed ones the person had approved: the approval is gone and they must give it again. */
  perdieronAprobacion: string[];
}

/** What to tell the person after an update: what lost their approval, with the commands to give it again. */
export function syncSummary(result: SyncResult, library: string, limit = 8): string[] {
  const lines = [
    `Skills: ${result.nuevas.length} nuevas, ${result.cambiadas.length} cambiadas, ${result.iguales.length} sin cambios (las nuevas y las cambiadas llegan sin aprobar).`,
  ];
  if (result.perdieronAprobacion.length > 0) {
    lines.push(
      `Pierden la aprobación que habías dado (${result.perdieronAprobacion.length}); apruébalas otra vez:`,
    );
    for (const name of result.perdieronAprobacion.slice(0, limit))
      lines.push(
        `  ${name}`,
        `    evol skills audit ${library}/${name} --propia --subproceso`,
        `    evol skills approve ${name}`,
      );
    if (result.perdieronAprobacion.length > limit)
      lines.push(`  … y ${result.perdieronAprobacion.length - limit} más`);
  }
  lines.push("Todo lo pendiente de aprobar, con sus motivos: evol skills list --pendientes");
  return lines;
}

/**
 * Brings the skills of a version into the person's library. A changed skill replaces the old one,
 * which is set aside (never deleted), and arrives without approval: the approval was of other bytes.
 */
export function syncLibrary(
  source: string,
  libraryDir: string,
  now: Date = new Date(),
): SyncResult {
  const result: SyncResult = { nuevas: [], cambiadas: [], iguales: [], perdieronAprobacion: [] };
  if (!existsSync(source)) return result;
  mkdirSync(libraryDir, { recursive: true });
  const manifest = readManifest(libraryDir);
  const sourceManifest = readManifest(source);
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
    // the approval the person had given to the bytes that are about to be replaced, if any
    const before = manifest.skills[name];
    let lostApproval: string | undefined = before?.aprobacionPerdida;
    if (existsSync(to)) {
      const old = readSkill(to);
      if (old.huella === readSkill(from).huella) {
        result.iguales.push(name);
        continue;
      }
      if (before?.auditoria && before.auditoria.huella === old.huella) {
        result.perdieronAprobacion.push(name);
        lostApproval = now.toISOString();
      }
      makeWritable(to);
      renameSync(to, join(libraryDir, `.${name}.previa-${now.getTime()}`));
      result.cambiadas.push(name);
    } else result.nuevas.push(name);
    cpSync(from, to, { recursive: true });
    makeWritable(to);
    // the entry keeps its place in the pipeline but never its approval (that was of other bytes);
    // what it does keep is the fact that the person had approved it, until they approve the new one
    const entry = sourceManifest.skills[name];
    manifest.skills[name] = {
      alcance: entry?.alcance ?? "paquete",
      fases: entry?.fases ?? [],
      ...(entry?.disciplina ? { disciplina: entry.disciplina } : {}),
      ...(entry?.origen ? { origen: entry.origen } : {}),
      ...(lostApproval ? { aprobacionPerdida: lostApproval } : {}),
    };
  }
  writeManifest(libraryDir, manifest);
  return result;
}

/* ------------------------------------ installing ------------------------------------ */

function atomicLink(target: string, link: string): void {
  const tmp = `${link}.nuevo`;
  rmSync(tmp, { force: true });
  symlinkSync(target, tmp);
  renameSync(tmp, link);
}

export interface UpdateResult {
  estado: "instalada" | "cancelada" | "al-dia";
  version?: string;
  skills?: SyncResult;
  devLink?: string;
}

export async function update(
  deps: UpdateDeps,
  libraryDir: string,
  wanted?: string,
): Promise<UpdateResult> {
  const log = deps.log ?? (() => {});
  const home = deps.home ?? homeDir();
  const info = inspectUpdate(deps, wanted);
  const c = info.candidata;
  if (!c) throw new UserError(`${deps.repo} no tiene ninguna versión publicada (etiquetas v*).`);
  if (!wanted && compareVersions(c.version, info.actual) <= 0) {
    log(`Ya tienes la última versión (${info.actual}).`);
    return { estado: "al-dia", version: info.actual };
  }
  if (!c.firma.ok)
    throw new UserError(`La etiqueta ${c.etiqueta} no se instala: ${c.firma.detail}.`);
  const summary = `Versión ${c.version} (de ${info.actual}), firma verificada.\n\n${c.cambios}`;
  if (!(await deps.confirm(summary))) return { estado: "cancelada" };

  const src = sourceDir(home);
  const final = join(versionsDir(home), c.version);
  const tmp = `${final}.tmp`;
  if (existsSync(tmp)) {
    makeWritable(tmp);
    rmSync(tmp, { recursive: true, force: true });
  }
  mkdirSync(tmp, { recursive: true });
  log(`→ extrayendo ${c.etiqueta}`);
  const archive = spawnSync("git", ["-C", src, "archive", "--format=tar", c.etiqueta], {
    maxBuffer: 512 * 1024 * 1024,
  });
  if (archive.status !== 0) throw new UserError(`git archive falló: ${String(archive.stderr)}`);
  const untar = spawnSync("tar", ["-x", "-C", tmp], { input: archive.stdout });
  if (untar.status !== 0)
    throw new UserError(`No se pudo extraer la versión: ${String(untar.stderr)}`);
  log("→ compilando");
  deps.build(tmp);

  const commit = run(src, "git", ["rev-list", "-n", "1", c.etiqueta]).out;
  const record: InstallRecord = {
    version: c.version,
    etiqueta: c.etiqueta,
    commit,
    instaladaEn: (deps.now ?? new Date()).toISOString(),
    repositorio: deps.repo,
    firmaVerificada: true,
  };
  writeFileSync(join(tmp, INSTALL_FILE), `${JSON.stringify(record, null, 2)}\n`);
  const files = writeIntegrity(tmp);
  log(`→ registro de integridad (${files} archivos) y solo lectura`);
  makeReadOnly(tmp);
  if (existsSync(final)) {
    makeWritable(final);
    rmSync(final, { recursive: true, force: true });
  }
  renameSync(tmp, final);

  // the previous version is kept; the links change last, so a failure above leaves the old one in place
  if (existsSync(currentLink(home)) || lstatSyncOrNull(currentLink(home))) {
    const old = resolve(home, readlinkSync(currentLink(home)));
    if (old !== final) atomicLink(old, previousLink(home));
  }
  atomicLink(final, currentLink(home));
  const devLink = relinkCommand(deps.binLink, currentLink(home));
  const skills = syncLibrary(join(final, "skills"), libraryDir, deps.now);
  return { estado: "instalada", version: c.version, skills, ...(devLink ? { devLink } : {}) };
}

function lstatSyncOrNull(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Points the `evol` command at the installed version. If it pointed at a checkout of the origin,
 * that checkout is not lost: it becomes `evol-dev`.
 */
export function relinkCommand(binLink: string, current: string): string | null {
  mkdirSync(dirname(binLink), { recursive: true });
  let devLink: string | null = null;
  if (lstatSyncOrNull(binLink)) {
    if (!lstatSync(binLink).isSymbolicLink())
      throw new UserError(
        `${binLink} existe y no es un enlace: no lo toco. Muévelo y vuelve a ejecutar.`,
      );
    const old = resolve(dirname(binLink), readlinkSync(binLink));
    const dev = join(dirname(binLink), "evol-dev");
    if (
      !old.startsWith(resolve(current)) &&
      old.endsWith(join("dist", "cli.js")) &&
      !lstatSyncOrNull(dev)
    ) {
      symlinkSync(old, dev);
      devLink = dev;
    }
  }
  atomicLink(join(current, "dist", "cli.js"), binLink);
  return devLink;
}

/** Goes back to the previous version: only the links change. */
export function rollback(binLink: string, home: string = homeDir()): string {
  if (!lstatSyncOrNull(previousLink(home)))
    throw new UserError("No hay una versión anterior a la que volver.");
  const previous = resolve(home, readlinkSync(previousLink(home)));
  const now = lstatSyncOrNull(currentLink(home))
    ? resolve(home, readlinkSync(currentLink(home)))
    : null;
  atomicLink(previous, currentLink(home));
  if (now) atomicLink(now, previousLink(home));
  relinkCommand(binLink, currentLink(home));
  return versionInfo(previous).version;
}
