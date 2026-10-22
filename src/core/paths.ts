import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CONFIG_FILE = "evol.config.json";
export const EVOL_DIR = ".evol";

/** Root of the installed package (where package.json, disciplines/ and templates/ live). */
export function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as { name?: string };
      if (pkg.name === "evol-driven") return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("No se encontró la raíz del paquete evol-driven");
    dir = parent;
  }
}

/** The only place the version is written is package.json; everything else reads it here. */
export function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

/** Per-user config (gate keys live here, never inside a project). */
export function userConfigDir(): string {
  if (process.env["EVOL_CONFIG_DIR"]) return resolve(process.env["EVOL_CONFIG_DIR"]);
  const xdg = process.env["XDG_CONFIG_HOME"];
  return join(xdg ? resolve(xdg) : join(homedir(), ".config"), "evol");
}

/** Walks up from `start` looking for evol.config.json. */
export function findProjectRoot(start: string = process.cwd()): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function evolPath(root: string, ...parts: string[]): string {
  return join(root, EVOL_DIR, ...parts);
}
