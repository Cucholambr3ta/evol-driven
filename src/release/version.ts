import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { packageRoot } from "../core/paths.js";

/**
 * Which evol this is. There are two kinds: the **origin** (the git checkout where the framework is
 * edited) and an **installed** copy (built from a signed release tag, read-only). They never mix:
 * the installed copy says what it is in INSTALACION.json, and the origin has a .git folder.
 */
export const INSTALL_FILE = "INSTALACION.json";

export const InstallRecordSchema = z.object({
  version: z.string().min(1),
  etiqueta: z.string().min(1),
  commit: z.string().min(1),
  instaladaEn: z.string().min(1),
  /** Where updates come from. */
  repositorio: z.string().min(1),
  /** Whether the tag's signature was checked against the person's allowed signers. */
  firmaVerificada: z.boolean(),
});
export type InstallRecord = z.infer<typeof InstallRecordSchema>;

export type Channel = "origen" | "estable" | "desconocido";

export interface VersionInfo {
  version: string;
  canal: Channel;
  commit: string | null;
  rama: string | null;
  etiqueta: string | null;
  /** Origin only: there are changes that are not committed. */
  sucio: boolean;
  raiz: string;
}

function git(root: string, args: string[]): string | null {
  const r = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", timeout: 15_000 });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function readInstallRecord(root: string): InstallRecord | null {
  const file = join(root, INSTALL_FILE);
  if (!existsSync(file)) return null;
  try {
    const parsed = InstallRecordSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function versionInfo(root: string = packageRoot()): VersionInfo {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
  const record = readInstallRecord(root);
  if (record)
    return {
      version: pkg.version,
      canal: "estable",
      commit: record.commit.slice(0, 7),
      rama: null,
      etiqueta: record.etiqueta,
      sucio: false,
      raiz: root,
    };
  if (existsSync(join(root, ".git"))) {
    const status = git(root, ["status", "--porcelain"]);
    return {
      version: pkg.version,
      canal: "origen",
      commit: git(root, ["rev-parse", "--short", "HEAD"]),
      rama: git(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
      etiqueta: git(root, ["describe", "--tags", "--exact-match"]),
      sucio: status !== null && status !== "",
      raiz: root,
    };
  }
  return {
    version: pkg.version,
    canal: "desconocido",
    commit: null,
    rama: null,
    etiqueta: null,
    sucio: false,
    raiz: root,
  };
}

/** One line a person can read: «0.3.0 (estable, v0.3.0, a1b2c3d)». */
export function describeVersion(info: VersionInfo): string {
  const parts: string[] = [info.canal];
  if (info.etiqueta) parts.push(info.etiqueta);
  if (info.rama && info.canal === "origen") parts.push(`rama ${info.rama}`);
  if (info.commit) parts.push(info.commit);
  if (info.sucio) parts.push("con cambios sin guardar");
  return `${info.version} (${parts.join(", ")})`;
}

/** -1, 0 or 1 comparing two x.y.z versions; a missing part counts as 0 and a suffix is ignored. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .replace(/^v/, "")
      .split("-")[0]!
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
