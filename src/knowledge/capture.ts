import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { UserError } from "../core/errors.js";

const SKIP = new Set([".git", "node_modules"]);

/** Every regular file under `dir` (relative, with «/», sorted). Symbolic links are never followed. */
export function filesOf(dir: string, base = ""): string[] {
  return readdirSync(join(dir, base))
    .sort()
    .flatMap((name) => {
      const rel = base ? `${base}/${name}` : name;
      if (SKIP.has(name)) return [];
      const stat = lstatSync(join(dir, rel));
      if (stat.isSymbolicLink()) return [];
      return stat.isDirectory() ? filesOf(dir, rel) : stat.isFile() ? [rel] : [];
    });
}

/** The same tree always gives the same hash, and any change to a path or a byte changes it. */
export function hashTree(dir: string): { hash: string; archivos: number } {
  const files = filesOf(dir);
  const h = createHash("sha256");
  for (const f of files) {
    h.update(
      `${f}\0${createHash("sha256")
        .update(readFileSync(join(dir, f)))
        .digest("hex")}\n`,
    );
  }
  return { hash: h.digest("hex"), archivos: files.length };
}

export function copyLocal(from: string, dest: string): void {
  if (!existsSync(from) || !lstatSync(from).isDirectory())
    throw new UserError(`«${from}» no es una carpeta.`);
  mkdirSync(dest, { recursive: true });
  cpSync(from, dest, {
    recursive: true,
    filter: (src) => !SKIP.has(src.split("/").pop() ?? "") && !lstatSync(src).isSymbolicLink(),
  });
}

/**
 * Fetches exactly one commit of a repository (no history, no branch that could move) and leaves the
 * tree without `.git`. Only the listed protocols are allowed: `https` for people, `file` for tests.
 */
export function captureGit(
  url: string,
  commit: string,
  dest: string,
  protocols: readonly string[] = ["https"],
): void {
  if (!/^[0-9a-f]{40}$/.test(commit))
    throw new UserError(
      "El commit debe ser el hash completo de 40 caracteres, no una rama ni una etiqueta.",
    );
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(url)?.[1]?.toLowerCase();
  if (!scheme || !protocols.includes(scheme))
    throw new UserError(`Solo se aceptan repositorios por ${protocols.join(" o ")}.`);
  mkdirSync(dest, { recursive: true });
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const git = (...args: string[]): string => {
    const r = spawnSync(
      "git",
      [
        "-c",
        "protocol.allow=never",
        ...protocols.flatMap((p) => ["-c", `protocol.${p}.allow=always`]),
        "-C",
        dest,
        ...args,
      ],
      { encoding: "utf8", timeout: 600_000, env },
    );
    if (r.status !== 0)
      throw new UserError(
        `git ${args[0]} falló: ${(r.stderr || r.stdout).trim().split("\n")[0] ?? ""}`,
      );
    return r.stdout.trim();
  };
  try {
    git("init", "-q");
    git("remote", "add", "origin", url);
    git("fetch", "-q", "--depth", "1", "origin", commit);
    git("checkout", "-q", "--detach", "FETCH_HEAD");
    if (git("rev-parse", "HEAD") !== commit)
      throw new UserError("El commit descargado no coincide con el pedido.");
  } catch (error) {
    rmSync(dest, { recursive: true, force: true });
    throw error;
  }
  rmSync(join(dest, ".git"), { recursive: true, force: true });
}
