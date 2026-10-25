import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { userConfigDir } from "../core/paths.js";
import { libraryDir } from "../skills/library.js";
import { readManifest } from "../skills/manifest.js";
import { compareVersions } from "./version.js";

/**
 * Whether there is a signed version newer than the one running, checked at most once a day (the
 * result is cached in `aviso-version.json`) and never at the cost of a slow or stuck `doctor`
 * (criterio 145): without network it fails silently and returns within a couple of seconds.
 */
const CACHE_FILE = "aviso-version.json";

const CacheSchema = z.object({
  consultadoEl: z.string(),
  versionNueva: z.string().optional(),
});

export interface UpdateNotice {
  versionNueva: string;
  firmaValida: boolean;
  skillsQuePerderianAprobacion: string[];
}

function cachePath(configDir: string): string {
  return join(configDir, CACHE_FILE);
}

function readCache(configDir: string): { consultadoEl: string; versionNueva?: string } | null {
  const file = cachePath(configDir);
  if (!existsSync(file)) return null;
  try {
    const parsed = CacheSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCache(configDir: string, versionNueva: string | null, now: Date): void {
  writeFileSync(
    cachePath(configDir),
    JSON.stringify({
      consultadoEl: now.toISOString(),
      ...(versionNueva ? { versionNueva } : {}),
    }),
  );
}

const sameDay = (iso: string, now: Date): boolean =>
  iso.slice(0, 10) === now.toISOString().slice(0, 10);

/** `actualizaciones.aviso` in the user's `config.json`; on by default. */
export function noticeEnabled(configDir: string = userConfigDir()): boolean {
  const file = join(configDir, "config.json");
  if (!existsSync(file)) return true;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as {
      actualizaciones?: { aviso?: boolean };
    };
    return parsed.actualizaciones?.aviso !== false;
  } catch {
    return true;
  }
}

function git(
  cwd: string,
  args: string[],
  timeoutMs: number,
): { ok: boolean; out: string; err: string } {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    env: {
      ...process.env,
      // never let an unreachable host or a credential prompt hold doctor up
      GIT_SSH_COMMAND: "ssh -o ConnectTimeout=2 -o BatchMode=yes -o StrictHostKeyChecking=no",
      GIT_TERMINAL_PROMPT: "0",
    },
  });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

/** The newest signed tag of `repo`, if any, fetched into a scratch clone that is removed afterwards. */
function fetchFromNetwork(
  repo: string,
  currentVersion: string,
  timeoutMs: number,
): UpdateNotice | null {
  const scratch = mkdtempSync(join(tmpdir(), "evol-aviso-"));
  try {
    const src = join(scratch, "src");
    const clone = git(scratch, ["clone", "--quiet", "--no-checkout", repo, "src"], timeoutMs);
    if (!clone.ok) return null;
    const tags = git(src, ["tag", "--list", "v*"], timeoutMs);
    if (!tags.ok) return null;
    const versions = tags.out
      .split("\n")
      .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
      .sort(compareVersions);
    const tag = versions[versions.length - 1];
    if (!tag || compareVersions(tag.slice(1), currentVersion) <= 0) return null;

    // only a version that carries a cryptographic signature is worth surfacing (criterio 145:
    // «firmada»); whether the person already trusts that specific key is decided later, at
    // `evol update`, which does require it in `allowed_signers`
    const tagObject = git(src, ["cat-file", "-p", tag], timeoutMs);
    const signed = tagObject.ok && /-----BEGIN (SSH|PGP) SIGNATURE-----/.test(tagObject.out);
    if (!signed) return null;

    const releaseJson = git(src, ["show", `${tag}:release.json`], timeoutMs);
    const skillsAtTag = releaseJson.ok
      ? ((JSON.parse(releaseJson.out) as { skills?: Record<string, string> }).skills ?? {})
      : {};
    const manifest = readManifest(libraryDir());
    const atRisk = Object.keys(manifest.skills)
      .filter((name) => {
        const approved = manifest.skills[name]?.auditoria?.huella;
        const next = skillsAtTag[name];
        return approved && next && approved !== next;
      })
      .sort();

    return {
      versionNueva: tag.slice(1),
      firmaValida: true,
      skillsQuePerderianAprobacion: atRisk,
    };
  } catch {
    return null;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Checks for a newer signed version of `repo`, respecting the once-a-day cache and the person's
 * `actualizaciones.aviso` switch. `null` means nothing to show (disabled, up to date, or no network).
 */
export function checkUpdateNotice(
  repo: string | null,
  currentVersion: string,
  opts: { configDir?: string; now?: Date; timeoutMs?: number } = {},
): UpdateNotice | null {
  const configDir = opts.configDir ?? userConfigDir();
  if (!noticeEnabled(configDir)) return null;
  const now = opts.now ?? new Date();
  const cached = readCache(configDir);
  if (cached && sameDay(cached.consultadoEl, now))
    return cached.versionNueva
      ? { versionNueva: cached.versionNueva, firmaValida: true, skillsQuePerderianAprobacion: [] }
      : null;
  if (!repo) return null;
  const notice = fetchFromNetwork(repo, currentVersion, opts.timeoutMs ?? 1_500);
  writeCache(configDir, notice?.versionNueva ?? null, now);
  return notice;
}
