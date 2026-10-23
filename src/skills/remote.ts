import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { UserError } from "../core/errors.js";

export interface RemoteSpec {
  url: string;
  sha: string;
}

const SHA = /^[0-9a-f]{40}$/;

/**
 * A remote skill is accepted only pinned to a full commit (`https://host/repo@<40 hex>`): a branch
 * or a tag can point somewhere else tomorrow, so what was audited would no longer be what is installed.
 * Returns null when `spec` is not a remote at all.
 */
export function parseRemote(
  spec: string,
  options: { allowFile?: boolean } = {},
): RemoteSpec | null {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(spec) && !/^git@/.test(spec)) return null;
  const scheme = options.allowFile && spec.startsWith("file://") ? "file://" : "https://";
  if (!spec.startsWith(scheme)) {
    throw new UserError(
      "Una skill remota debe venir por https:// (no se aceptan http://, ssh ni otros protocolos).",
    );
  }
  const at = spec.lastIndexOf("@");
  const sha = at > scheme.length ? spec.slice(at + 1) : "";
  if (!SHA.test(sha)) {
    throw new UserError(
      "Una skill remota debe ir fijada a un commit completo: https://…/repo@<sha de 40 caracteres>. Las ramas y las etiquetas cambian, y lo auditado dejaría de ser lo instalado.",
    );
  }
  return { url: spec.slice(0, at), sha };
}

/** Fetches exactly one commit into a temporary folder, with no hooks, no config and no submodules. */
export function fetchRemote(
  remote: RemoteSpec,
  options: { allowFile?: boolean } = {},
): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "evol-remote-"));
  const cleanup = (): void => rmSync(dir, { recursive: true, force: true });
  const env = {
    PATH: process.env["PATH"] ?? "",
    HOME: dir,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    GIT_ALLOW_PROTOCOL: options.allowFile ? "https:file" : "https",
  };
  const git = (...args: string[]): string => {
    const r = spawnSync(
      "git",
      ["-c", "core.hooksPath=/dev/null", "-c", "protocol.version=2", ...args],
      { cwd: dir, env, encoding: "utf8", timeout: 120_000 },
    );
    if (r.error || r.status !== 0) {
      cleanup();
      throw new UserError(
        `No se pudo descargar ${remote.url} en el commit ${remote.sha}: ${(r.stderr || r.error?.message || "").trim().split("\n")[0]}`,
      );
    }
    return r.stdout.trim();
  };
  git("init", "-q");
  git(
    "fetch",
    "-q",
    "--depth",
    "1",
    "--no-tags",
    "--no-recurse-submodules",
    remote.url,
    remote.sha,
  );
  git("-c", "advice.detachedHead=false", "checkout", "-q", "--detach", "FETCH_HEAD");
  if (git("rev-parse", "HEAD") !== remote.sha) {
    cleanup();
    throw new UserError("El commit descargado no coincide con el pedido.");
  }
  rmSync(join(dir, ".git"), { recursive: true, force: true });
  return { dir, cleanup };
}
