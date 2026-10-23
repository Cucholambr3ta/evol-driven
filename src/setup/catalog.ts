import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

/**
 * What `evol setup` looks for. A tool that installs into the user's own folder (`uv tool install`)
 * can be installed after the person says so; anything that needs administrator rights is only
 * described, with the exact command, for the person to run: setup never uses sudo.
 */
export type Need = "obligatoria" | "recomendada" | "opcional";

export type Install = { tipo: "usuario"; argv: string[] } | { tipo: "manual"; comando: string };

export interface Component {
  id: string;
  /** The executable looked for on the PATH (and in the folder `uv tool` installs into). */
  bin: string;
  uso: string;
  necesidad: Need;
  instalar: Install;
}

export const COMPONENTS: readonly Component[] = [
  {
    id: "git",
    bin: "git",
    uso: "versiones y el registro de aprobaciones",
    necesidad: "obligatoria",
    instalar: { tipo: "manual", comando: "sudo pacman -S git" },
  },
  {
    id: "uv",
    bin: "uv",
    uso: "instala las herramientas de Python de este listado",
    necesidad: "obligatoria",
    instalar: { tipo: "manual", comando: "sudo pacman -S uv" },
  },
  {
    id: "semgrep",
    bin: "semgrep",
    uso: "analiza los scripts de una skill y el código del proyecto",
    necesidad: "obligatoria",
    instalar: { tipo: "usuario", argv: ["uv", "tool", "install", "semgrep==1.182.0"] },
  },
  {
    id: "gitleaks",
    bin: "gitleaks",
    uso: "busca secretos en las skills y en el proyecto",
    necesidad: "obligatoria",
    instalar: {
      tipo: "manual",
      comando: "sudo pacman -S gitleaks   (o https://github.com/gitleaks/gitleaks)",
    },
  },
  {
    id: "mempalace",
    bin: "mempalace-mcp",
    uso: "memoria persistente (evol memory)",
    necesidad: "recomendada",
    instalar: { tipo: "usuario", argv: ["uv", "tool", "install", "mempalace"] },
  },
  {
    id: "graphviz",
    bin: "dot",
    uso: "diagramas e informe del proyecto",
    necesidad: "recomendada",
    instalar: { tipo: "manual", comando: "sudo pacman -S graphviz" },
  },
  {
    id: "bandit",
    bin: "bandit",
    uso: "revisa scripts de Python",
    necesidad: "opcional",
    instalar: { tipo: "usuario", argv: ["uv", "tool", "install", "bandit"] },
  },
  {
    id: "shellcheck",
    bin: "shellcheck",
    uso: "revisa scripts de shell",
    necesidad: "opcional",
    instalar: { tipo: "manual", comando: "sudo pacman -S shellcheck" },
  },
  {
    id: "guarddog",
    bin: "guarddog",
    uso: "detecta paquetes maliciosos entre las dependencias",
    necesidad: "opcional",
    instalar: { tipo: "usuario", argv: ["uv", "tool", "install", "guarddog==3.2.0"] },
  },
  {
    id: "osv-scanner",
    bin: "osv-scanner",
    uso: "vulnerabilidades conocidas en las dependencias",
    necesidad: "opcional",
    instalar: {
      tipo: "manual",
      comando: "https://google.github.io/osv-scanner (según tu distribución)",
    },
  },
];

const envName = (id: string): string => `EVOL_TOOL_${id.toUpperCase().replaceAll("-", "_")}`;

/** Where the tool is, or null. Tests point a tool to a stub with EVOL_TOOL_<ID> (empty = not installed). */
export function findTool(
  c: Pick<Component, "id" | "bin">,
  home: string = homedir(),
): string | null {
  const override = process.env[envName(c.id)];
  const candidates =
    override !== undefined
      ? override === ""
        ? []
        : [override]
      : [...(process.env["PATH"] ?? "").split(delimiter), join(home, ".local", "bin")].map((d) =>
          join(d, c.bin),
        );
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* next */
    }
  }
  return null;
}

/** True when the tool exists but its folder is not on the PATH, so other programs will not find it. */
export function offPath(c: Pick<Component, "id" | "bin">): boolean {
  if (process.env[envName(c.id)] !== undefined) return false;
  return !(process.env["PATH"] ?? "").split(delimiter).some((d) => {
    try {
      accessSync(join(d, c.bin), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}
