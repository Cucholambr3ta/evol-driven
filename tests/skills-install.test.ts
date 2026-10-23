import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readSkill } from "../src/skills/skill.js";
import { readManifest, writeManifest } from "../src/skills/manifest.js";
import {
  installedSkills,
  installSkill,
  skillsFolder,
  uninstallSkill,
} from "../src/skills/install.js";
import { cli, isolateUserConfig, makeProject, tempDir, write } from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

/** A library with one skill, audited (or not) the way `evol skills approve` leaves it. */
function library(
  state: "aprobada" | "con-avisos" | "sin-auditar" | "modificada" = "aprobada",
): string {
  const dir = tempDir("evol-lib-");
  write(
    dir,
    "demo/SKILL.md",
    "---\nname: demo\ndescription: Una skill de prueba\n---\n\nHaz algo.\n",
  );
  if (state !== "sin-auditar") {
    const manifest = readManifest(dir);
    const huella = readSkill(join(dir, "demo")).huella;
    manifest.skills["demo"] = {
      alcance: "personal",
      fases: [],
      auditoria: {
        estado: state === "con-avisos" ? "con-avisos" : "aprobada",
        huella,
        fecha: "2026-10-23",
      },
    };
    writeManifest(dir, manifest);
    if (state === "modificada")
      write(
        dir,
        "demo/SKILL.md",
        "---\nname: demo\ndescription: Una skill de prueba\n---\n\nCambiada.\n",
      );
  }
  return dir;
}
const target = (p: string): string => readlinkSync(p);

describe("instalar una skill (criterios 54 y 60)", () => {
  it("rechaza una skill sin auditar, o cuya huella cambió, y no crea nada", () => {
    for (const state of ["sin-auditar", "modificada"] as const) {
      const root = tempDir();
      expect(() =>
        installSkill({
          libraryDir: library(state),
          name: "demo",
          agents: ["claude-code"],
          scope: "proyecto",
          projectRoot: root,
        }),
      ).toThrow(/instalar es aprobar primero/);
      expect(existsSync(join(root, ".claude"))).toBe(false);
    }
  });

  it("instala un enlace simbólico a la biblioteca, no una copia", () => {
    const lib = library();
    const root = tempDir();
    const [o] = installSkill({
      libraryDir: lib,
      name: "demo",
      agents: ["claude-code"],
      scope: "proyecto",
      projectRoot: root,
    });
    expect(o?.resultado).toBe("instalada");
    const link = join(root, ".claude", "skills", "demo");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(target(link)).toBe(join(lib, "demo"));
  });

  it("acepta una aprobada con avisos", () => {
    const [o] = installSkill({
      libraryDir: library("con-avisos"),
      name: "demo",
      agents: ["opencode"],
      scope: "proyecto",
      projectRoot: tempDir(),
    });
    expect(o?.resultado).toBe("instalada");
  });

  it("es idempotente", () => {
    const lib = library();
    const root = tempDir();
    const opts = {
      libraryDir: lib,
      name: "demo",
      agents: ["claude-code" as const],
      scope: "proyecto" as const,
      projectRoot: root,
    };
    installSkill(opts);
    expect(installSkill(opts)[0]?.resultado).toBe("sin-cambios");
  });

  it("no pisa lo que ya hay sin --reemplazar; con él, aparta la carpeta real en vez de borrarla", () => {
    const lib = library();
    const root = tempDir();
    write(root, ".claude/skills/demo/SKILL.md", "la mía\n");
    const opts = {
      libraryDir: lib,
      name: "demo",
      agents: ["claude-code" as const],
      scope: "proyecto" as const,
      projectRoot: root,
    };
    expect(installSkill(opts)[0]?.resultado).toBe("existe");
    expect(lstatSync(join(root, ".claude/skills/demo")).isSymbolicLink()).toBe(false);
    expect(installSkill({ ...opts, replace: true })[0]?.resultado).toBe("reemplazada");
    expect(lstatSync(join(root, ".claude/skills/demo")).isSymbolicLink()).toBe(true);
    const kept = readdirSync(join(root, ".claude/skills")).find((n) =>
      n.startsWith(".demo.previa-"),
    );
    expect(kept).toBeDefined();
    expect(existsSync(join(root, ".claude/skills", kept ?? "", "SKILL.md"))).toBe(true);
  });

  it("un enlace a otra parte tampoco se pisa sin --reemplazar", () => {
    const lib = library();
    const root = tempDir();
    mkdirSync(join(root, ".claude/skills"), { recursive: true });
    symlinkSync(tempDir(), join(root, ".claude/skills/demo"), "dir");
    const opts = {
      libraryDir: lib,
      name: "demo",
      agents: ["claude-code" as const],
      scope: "proyecto" as const,
      projectRoot: root,
    };
    expect(installSkill(opts)[0]?.resultado).toBe("existe");
    expect(installSkill({ ...opts, replace: true })[0]?.resultado).toBe("reemplazada");
    expect(target(join(root, ".claude/skills/demo"))).toBe(join(lib, "demo"));
  });

  it("Codex y Antigravity comparten carpeta: un solo enlace", () => {
    const root = tempDir();
    const out = installSkill({
      libraryDir: library(),
      name: "demo",
      agents: ["codex", "antigravity"],
      scope: "proyecto",
      projectRoot: root,
    });
    expect(out.map((o) => o.resultado)).toEqual(["instalada", "sin-cambios"]);
    expect(readdirSync(join(root, ".agents/skills"))).toEqual(["demo"]);
  });

  it("lo no confirmado no se adivina: Hermes en proyecto y Antigravity en global", () => {
    const home = tempDir("evol-home-");
    const lib = library();
    const a = installSkill({
      libraryDir: lib,
      name: "demo",
      agents: ["hermes"],
      scope: "proyecto",
      projectRoot: tempDir(),
      home,
    });
    expect(a[0]?.resultado).toBe("no-aplica");
    const b = installSkill({
      libraryDir: lib,
      name: "demo",
      agents: ["antigravity"],
      scope: "global",
      projectRoot: null,
      home,
    });
    expect(b[0]?.resultado).toBe("no-aplica");
    expect(readdirSync(home)).toEqual([]);
  });

  it("en global usa la carpeta de cada IDE bajo el home", () => {
    const home = tempDir("evol-home-");
    expect(skillsFolder("claude-code", "global", null, home)).toBe(join(home, ".claude/skills"));
    expect(skillsFolder("opencode", "global", null, home)).toBe(
      join(home, ".config/opencode/skills"),
    );
    expect(skillsFolder("hermes", "global", null, home)).toBe(join(home, ".hermes/skills"));
    installSkill({
      libraryDir: library(),
      name: "demo",
      agents: ["hermes"],
      scope: "global",
      projectRoot: null,
      home,
    });
    expect(existsSync(join(home, ".hermes/skills/demo/SKILL.md"))).toBe(true);
  });

  it("una skill que se modifica después queda marcada como sin auditar en el estado", () => {
    const lib = library();
    const root = tempDir();
    installSkill({
      libraryDir: lib,
      name: "demo",
      agents: ["claude-code"],
      scope: "proyecto",
      projectRoot: root,
    });
    expect(installedSkills(lib, "proyecto", root)).toEqual([
      {
        agente: "claude-code",
        carpeta: join(root, ".claude/skills"),
        skill: "demo",
        estado: "aprobada",
      },
    ]);
    writeFileSync(
      join(lib, "demo/SKILL.md"),
      "---\nname: demo\ndescription: otra\n---\n\ncambiada\n",
    );
    expect(installedSkills(lib, "proyecto", root)[0]?.estado).toBe("modificada");
  });
});

describe("evol skills install", () => {
  const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });

  it("instala, repite sin cambios y rechaza lo no aprobado con código 1", () => {
    const lib = library();
    const root = makeProject(["FDD"]);
    const run = (...a: string[]) =>
      cli(["skills", "install", ...a, "--dir", lib], { cwd: root, env: env() });
    const first = run("demo", "--agente", "claude-code");
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("+ claude-code: instalada");
    expect(run("demo", "--agente", "claude-code").stdout).toContain("= claude-code: sin-cambios");
    expect(existsSync(join(root, ".claude/skills/demo/SKILL.md"))).toBe(true);
    const bad = run("noexiste");
    expect(bad.status).toBe(1);
    const unaudited = cli(["skills", "install", "demo", "--dir", library("sin-auditar")], {
      cwd: makeProject(["FDD"]),
      env: env(),
    });
    expect(unaudited.status).toBe(1);
    expect(unaudited.stderr).toContain("instalar es aprobar primero");
  });

  it("--estado sale con 1 si algo instalado dejó de estar auditado; un agente desconocido da error", () => {
    const lib = library();
    const root = makeProject(["FDD"]);
    cli(["skills", "install", "demo", "--dir", lib], { cwd: root, env: env() });
    expect(
      cli(["skills", "install", "--estado", "--dir", lib], { cwd: root, env: env() }).status,
    ).toBe(0);
    writeFileSync(join(lib, "demo/SKILL.md"), "---\nname: demo\ndescription: x\n---\n\ncambiada\n");
    const r = cli(["skills", "install", "--estado", "--dir", lib], { cwd: root, env: env() });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("× demo");
    const e = cli(["skills", "install", "demo", "--agente", "emacs", "--dir", lib], {
      cwd: root,
      env: env(),
    });
    expect(e.stderr).toContain("Agente desconocido «emacs»");
  });
});

describe("quitar una skill instalada", () => {
  const base = (root: string, lib: string) => ({
    libraryDir: lib,
    name: "demo",
    agents: ["claude-code" as const],
    scope: "proyecto" as const,
    projectRoot: root,
  });

  it("quita el enlace que puso install y deja intacta la skill de la biblioteca", () => {
    const lib = library();
    const root = tempDir();
    installSkill(base(root, lib));
    expect(uninstallSkill(base(root, lib))[0]?.resultado).toBe("quitada");
    expect(existsSync(join(root, ".claude/skills/demo"))).toBe(false);
    expect(existsSync(join(lib, "demo/SKILL.md"))).toBe(true);
    expect(uninstallSkill(base(root, lib))[0]?.resultado).toBe("no-instalada");
  });

  it("no toca una carpeta real ni un enlace que apunta a otra parte", () => {
    const lib = library();
    const root = tempDir();
    write(root, ".claude/skills/demo/SKILL.md", "la mía\n");
    expect(uninstallSkill(base(root, lib))[0]?.resultado).toBe("ajena");
    expect(existsSync(join(root, ".claude/skills/demo/SKILL.md"))).toBe(true);
    const root2 = tempDir();
    mkdirSync(join(root2, ".claude/skills"), { recursive: true });
    symlinkSync(tempDir(), join(root2, ".claude/skills/demo"), "dir");
    expect(uninstallSkill(base(root2, lib))[0]?.resultado).toBe("ajena");
    expect(lstatSync(join(root2, ".claude/skills/demo")).isSymbolicLink()).toBe(true);
  });

  it("evol skills uninstall: sale 0 al quitar y 1 si lo que hay no es de evol", () => {
    const lib = library();
    const root = makeProject(["FDD"]);
    const env = { EVOL_CONFIG_DIR: userConfig };
    cli(["skills", "install", "demo", "--dir", lib], { cwd: root, env });
    const ok = cli(["skills", "uninstall", "demo", "--dir", lib], { cwd: root, env });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain("- claude-code: quitada");
    write(root, ".claude/skills/demo/SKILL.md", "la mía\n");
    expect(cli(["skills", "uninstall", "demo", "--dir", lib], { cwd: root, env }).status).toBe(1);
  });
});
