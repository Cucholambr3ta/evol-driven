import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { UserError } from "../core/errors.js";
import { listSkills } from "../skills/library.js";
import { compareVersions } from "./version.js";

/**
 * Publishing a version of the framework: bump the number, write the changelog (with the skills
 * whose content changed), run the full CI, record the release, commit it and sign the tag. Nothing
 * is pushed: sending it to GitHub is for the person to do.
 */
export const RELEASE_FILE = "release.json";
export const CHANGELOG = "CHANGELOG.md";

const ReleaseSchema = z.object({
  version: z.string(),
  fecha: z.string(),
  skills: z.record(z.string(), z.string()),
});
export type ReleaseRecord = z.infer<typeof ReleaseSchema>;

function git(
  root: string,
  args: string[],
  input?: string,
): { ok: boolean; out: string; err: string } {
  const r = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    timeout: 120_000,
    ...(input ? { input } : {}),
  });
  return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() };
}

export function lastTag(root: string): string | null {
  const r = git(root, ["describe", "--tags", "--abbrev=0", "--match", "v*"]);
  return r.ok ? r.out : null;
}

function releaseAt(root: string, tag: string): ReleaseRecord | null {
  const r = git(root, ["show", `${tag}:${RELEASE_FILE}`]);
  if (!r.ok) return null;
  try {
    const parsed = ReleaseSchema.safeParse(JSON.parse(r.out));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The hash of every skill folder in this checkout. */
export function skillHashes(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of listSkills(join(root, "skills"))) out[s.id] = s.huella;
  return out;
}

export interface SkillChanges {
  nuevas: string[];
  cambiadas: string[];
  quitadas: string[];
}

export function diffSkills(
  before: Record<string, string>,
  after: Record<string, string>,
): SkillChanges {
  // own keys only: `"constructor" in {}` is true, and a skill is called exactly that
  const has = (map: Record<string, string>, name: string): boolean => Object.hasOwn(map, name);
  return {
    nuevas: Object.keys(after)
      .filter((n) => !has(before, n))
      .sort(),
    cambiadas: Object.keys(after)
      .filter((n) => has(before, n) && before[n] !== after[n])
      .sort(),
    quitadas: Object.keys(before)
      .filter((n) => !has(after, n))
      .sort(),
  };
}

/** Whether git can sign a tag here, and if not, exactly what to set. */
export function signingProblem(root: string): string | null {
  const format = git(root, ["config", "--get", "gpg.format"]).out || "openpgp";
  const key = git(root, ["config", "--get", "user.signingkey"]).out;
  if (!key)
    return [
      "No hay clave de firma configurada para git. Las versiones se firman con tu clave SSH:",
      "  git config gpg.format ssh",
      "  git config user.signingkey ~/.ssh/id_ed25519.pub",
      "  git config gpg.ssh.allowedSignersFile ~/.config/evol/allowed_signers",
      "(evol setup deja el archivo allowed_signers con tu clave pública; la privada nunca se lee).",
    ].join("\n");
  if (format !== "ssh" && format !== "openpgp")
    return `gpg.format = «${format}» no es válido para firmar etiquetas.`;
  return null;
}

export function changelogEntry(
  version: string,
  date: string,
  subjects: string[],
  changes: SkillChanges,
): string {
  const lines = [`## ${version} — ${date}`, ""];
  if (subjects.length === 0) lines.push("- (sin cambios registrados)");
  for (const s of subjects) lines.push(`- ${s}`);
  // in the shape Prettier writes (a blank line, no indent): the project checks its own formatting in CI
  const skillLines = [
    ...changes.nuevas.map((n) => `- nueva: ${n}`),
    ...changes.cambiadas.map((n) => `- cambiada (vuelve a «sin auditar»): ${n}`),
    ...changes.quitadas.map((n) => `- quitada: ${n}`),
  ];
  if (skillLines.length > 0) lines.push("", "Skills:", "", ...skillLines);
  return `${lines.join("\n")}\n`;
}

export interface ReleaseOptions {
  root: string;
  version: string;
  /** The command that proves the build is good; null skips it (tests only). */
  ci: string[] | null;
  now?: Date;
  log?: (line: string) => void;
}

export interface ReleaseResult {
  etiqueta: string;
  commit: string;
  cambios: SkillChanges;
}

export function release(opts: ReleaseOptions): ReleaseResult {
  const { root, version } = opts;
  const log = opts.log ?? (() => {});
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new UserError(`La versión «${version}» debe tener la forma x.y.z.`);
  const tag = `v${version}`;
  if (!existsSync(join(root, ".git")))
    throw new UserError("Una versión se publica desde el origen (un checkout de git).");

  const pkgFile = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8")) as { version: string };
  if (compareVersions(version, pkg.version) <= 0)
    throw new UserError(`La versión ${version} no es mayor que la actual (${pkg.version}).`);
  if (git(root, ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]).ok)
    throw new UserError(`La etiqueta ${tag} ya existe.`);
  const dirty = git(root, ["status", "--porcelain"]).out;
  if (dirty !== "")
    throw new UserError(
      "Hay cambios sin guardar: guárdalos (commit) antes de publicar una versión.",
    );
  const problem = signingProblem(root);
  if (problem) throw new UserError(problem);

  if (opts.ci) {
    log(`→ ${opts.ci.join(" ")}`);
    const run = spawnSync(opts.ci[0] as string, opts.ci.slice(1), { cwd: root, stdio: "inherit" });
    if (run.status !== 0)
      throw new UserError("El CI falló: no se publica una versión que no pasa sus pruebas.");
  }

  const previous = lastTag(root);
  const before = previous ? (releaseAt(root, previous)?.skills ?? {}) : {};
  const after = skillHashes(root);
  const changes = diffSkills(before, after);
  const range = previous ? [`${previous}..HEAD`] : ["HEAD"];
  const subjects = git(root, ["log", ...range, "--pretty=%s", "--no-merges"])
    .out.split("\n")
    .filter(Boolean);
  const date = (opts.now ?? new Date()).toISOString().slice(0, 10);

  pkg.version = version;
  writeFileSync(
    pkgFile,
    `${JSON.stringify({ ...JSON.parse(readFileSync(pkgFile, "utf8")), version }, null, 2)}\n`,
  );
  const lock = join(root, "package-lock.json");
  const touched = ["package.json"];
  if (existsSync(lock)) {
    const parsed = JSON.parse(readFileSync(lock, "utf8")) as {
      version?: string;
      packages?: Record<string, { version?: string }>;
    };
    parsed.version = version;
    if (parsed.packages?.[""]) parsed.packages[""].version = version;
    writeFileSync(lock, `${JSON.stringify(parsed, null, 2)}\n`);
    touched.push("package-lock.json");
  }
  const changelogFile = join(root, CHANGELOG);
  const head = "# Cambios\n\n";
  const old = existsSync(changelogFile)
    ? readFileSync(changelogFile, "utf8").replace(/^# Cambios\n+/, "")
    : "";
  writeFileSync(
    changelogFile,
    `${head}${changelogEntry(version, date, subjects, changes)}\n${old}`,
  );
  const record: ReleaseRecord = { version, fecha: date, skills: after };
  writeFileSync(join(root, RELEASE_FILE), `${JSON.stringify(record, null, 2)}\n`);
  touched.push(CHANGELOG, RELEASE_FILE);

  const add = git(root, ["add", ...touched]);
  if (!add.ok) throw new UserError(`git add falló: ${add.err}`);
  const commit = git(root, ["commit", "-q", "-m", `release: v${version}`]);
  if (!commit.ok) throw new UserError(`No se pudo guardar la versión: ${commit.err}`);
  const signed = git(root, ["tag", "-s", tag, "-m", `evol-driven ${version}`]);
  if (!signed.ok) {
    // leave the repository as it was: the commit is undone, the files return to their state
    git(root, ["reset", "-q", "--hard", "HEAD~1"]);
    throw new UserError(
      `No se pudo firmar la etiqueta ${tag}: ${signed.err}\nSe deshizo el commit de la versión.`,
    );
  }
  return {
    etiqueta: tag,
    commit: git(root, ["rev-parse", "--short", "HEAD"]).out,
    cambios: changes,
  };
}
