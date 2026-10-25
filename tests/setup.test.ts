import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { findTool, COMPONENTS } from "../src/setup/catalog.js";
import { nodeOk, seedLibrary, setupReader, setupTools } from "../src/setup/steps.js";
import type { Prompter } from "../src/setup/steps.js";
import { auditorConfigPath, readAuditorConfig } from "../src/skills/auditor/config.js";
import { readManifest, writeManifest } from "../src/skills/manifest.js";
import { readSkill } from "../src/skills/skill.js";
import { cli, git, isolateUserConfig, REPO, tempDir, write } from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

const saved: Record<string, string | undefined> = {};
function setEnv(name: string, value: string): void {
  if (!(name in saved)) saved[name] = process.env[name];
  process.env[name] = value;
}
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
    delete saved[k];
  }
});

const yes: Prompter = { yesNo: () => Promise.resolve(true) };
const no: Prompter = { yesNo: () => Promise.resolve(false) };
const exe = (dir: string, name: string, body = "#!/bin/sh\nexit 0\n"): string => {
  const file = join(dir, name);
  writeFileSync(file, body);
  chmodSync(file, 0o755);
  return file;
};
const envName = (id: string): string => `EVOL_TOOL_${id.toUpperCase().replaceAll("-", "_")}`;
/** Every component present, as a stub, except the ones named. */
function allPresentExcept(...absent: string[]): string {
  const dir = tempDir("evol-tools-");
  for (const c of COMPONENTS) setEnv(envName(c.id), absent.includes(c.id) ? "" : exe(dir, c.bin));
  return dir;
}

describe("evol setup: herramientas (autorizando una a una)", () => {
  it("Node 24 o superior", () => {
    expect(nodeOk("24.0.0")).toBe(true);
    expect(nodeOk("26.12.0")).toBe(true);
    expect(nodeOk("22.11.0")).toBe(false);
  });

  it("detecta por el ejecutable, y una variable vacía significa «no instalada»", () => {
    const dir = tempDir();
    setEnv("EVOL_TOOL_SEMGREP", exe(dir, "semgrep"));
    expect(findTool({ id: "semgrep", bin: "semgrep" })).toBe(join(dir, "semgrep"));
    setEnv("EVOL_TOOL_SEMGREP", "");
    expect(findTool({ id: "semgrep", bin: "semgrep" })).toBeNull();
  });

  it("si todo está, no pregunta ni instala nada", async () => {
    allPresentExcept();
    const lines: string[] = [];
    const asked: string[] = [];
    const out = await setupTools((l) => lines.push(l), {
      yesNo: (q) => (asked.push(q), Promise.resolve(true)),
    });
    expect(out.every((o) => o.estado === "ya-estaba")).toBe(true);
    expect(asked).toEqual([]);
  });

  it("instala una herramienta de usuario solo si se responde que sí, con el comando exacto", async () => {
    const dir = allPresentExcept("semgrep");
    const log = join(dir, "uv.log");
    // the stand-in for uv records how it was called and creates the tool it was asked for
    setEnv(
      "EVOL_TOOL_UV",
      exe(
        dir,
        "uv",
        `#!/bin/sh\necho "$@" >> "${log}"\ntouch "${join(dir, "semgrep-instalada")}"\nchmod +x "${join(dir, "semgrep-instalada")}"\n`,
      ),
    );
    setEnv("EVOL_TOOL_SEMGREP", join(dir, "semgrep-instalada"));
    const questions: string[] = [];
    const lines: string[] = [];
    const out = await setupTools((l) => lines.push(l), {
      yesNo: (q) => (questions.push(q), Promise.resolve(true)),
    });
    expect(questions).toHaveLength(1);
    expect(questions[0]).toContain("uv tool install semgrep==1.182.0");
    expect(out.find((o) => o.id === "semgrep")?.estado).toBe("instalada");
    expect(readFileSync(log, "utf8").trim()).toBe("tool install semgrep==1.182.0");
  });

  it("si se responde que no, no ejecuta nada", async () => {
    const dir = allPresentExcept("semgrep");
    const log = join(dir, "uv.log");
    setEnv("EVOL_TOOL_UV", exe(dir, "uv", `#!/bin/sh\necho llamado >> "${log}"\n`));
    const out = await setupTools(() => {}, no);
    expect(out.find((o) => o.id === "semgrep")?.estado).toBe("omitida");
    expect(existsSync(log)).toBe(false);
  });

  it("lo que pide administrador solo se describe: nunca ejecuta sudo ni pregunta", async () => {
    allPresentExcept("gitleaks", "graphviz");
    const lines: string[] = [];
    const asked: string[] = [];
    const out = await setupTools((l) => lines.push(l), {
      yesNo: (q) => (asked.push(q), Promise.resolve(true)),
    });
    expect(out.find((o) => o.id === "gitleaks")).toMatchObject({ estado: "manual" });
    expect(asked).toEqual([]);
    const text = lines.join("\n");
    expect(text).toContain("sudo pacman -S gitleaks");
    expect(text).toContain("sudo pacman -S graphviz");
    expect(text).toContain("instálala tú");
  });

  it("sin uv, las herramientas de Python quedan para después y lo dice", async () => {
    allPresentExcept("uv", "mempalace");
    const lines: string[] = [];
    const out = await setupTools((l) => lines.push(l), yes);
    expect(out.find((o) => o.id === "mempalace")?.estado).toBe("manual");
    expect(lines.join("\n")).toContain("necesita uv");
  });

  it("si la instalación falla lo cuenta y no la da por hecha", async () => {
    const dir = allPresentExcept("bandit");
    setEnv("EVOL_TOOL_UV", exe(dir, "uv", "#!/bin/sh\nexit 3\n"));
    const lines: string[] = [];
    const out = await setupTools((l) => lines.push(l), yes);
    expect(out.find((o) => o.id === "bandit")).toMatchObject({ estado: "fallo" });
    expect(lines.join("\n")).toContain("no se pudo instalar bandit (código 3)");
  });
});

describe("evol setup: lector de la auditoría", () => {
  it("con Claude Code instalado ofrece configurarlo, y el archivo es válido", async () => {
    const file = auditorConfigPath();
    expect(existsSync(file)).toBe(false);
    expect(await setupReader(() => {}, no, "/usr/bin/claude")).toBe("omitido");
    expect(existsSync(file)).toBe(false);
    expect(await setupReader(() => {}, yes, "/usr/bin/claude")).toBe("creado");
    expect(readAuditorConfig()?.lectores[0]).toMatchObject({
      id: "claude-code",
      tipo: "cli",
      adaptador: "claude-code",
    });
    expect(await setupReader(() => {}, yes, "/usr/bin/claude")).toBe("ya-configurado");
  });

  it("sin ninguna opción enseña cómo configurarlo y no escribe nada", async () => {
    writeFileSync(auditorConfigPath(), "");
    const { rmSync } = await import("node:fs");
    rmSync(auditorConfigPath());
    const lines: string[] = [];
    expect(await setupReader((l) => lines.push(l), yes, null)).toBe("sin-opciones");
    expect(lines.join("\n")).toContain("auditor.json");
    expect(existsSync(auditorConfigPath())).toBe(false);
  });
});

describe("evol setup: biblioteca de skills", () => {
  function pack(approvedBy?: string, withReport = true): { source: string; huella: string } {
    const source = tempDir("evol-pack-");
    write(
      source,
      "demo/SKILL.md",
      "---\nname: demo\ndescription: Una skill de prueba para el paquete\n---\n\nHaz algo.\n",
    );
    write(
      source,
      "otra/SKILL.md",
      "---\nname: otra\ndescription: Otra skill de prueba para el paquete\n---\n\nHaz otra cosa.\n",
    );
    const huella = readSkill(join(source, "demo")).huella;
    const report = join(source, "informe.json");
    if (withReport) writeFileSync(report, "{}");
    const manifest = readManifest(source);
    manifest.skills["demo"] = {
      alcance: "paquete",
      fases: ["build"],
      ...(approvedBy
        ? {
            auditoria: {
              estado: "aprobada",
              huella,
              fecha: "2026-10-23",
              informe: report,
              aprobadaPor: approvedBy,
            },
          }
        : {}),
    };
    manifest.skills["otra"] = { alcance: "paquete", fases: [] };
    writeManifest(source, manifest);
    return { source, huella };
  }

  it("copia todas las skills y ninguna llega aprobada si nadie la aprobó aquí", () => {
    const { source } = pack("alguien-mas");
    const lib = tempDir("evol-lib-");
    const r = seedLibrary(source, lib, "ana");
    expect(r.copiadas.sort()).toEqual(["demo", "otra"]);
    expect(r.aprobacionesConservadas).toEqual([]);
    expect(readManifest(lib).skills["demo"]?.auditoria).toBeUndefined();
    expect(readManifest(lib).skills["demo"]).toMatchObject({
      alcance: "paquete",
      fases: ["build"],
    });
  });

  it("conserva la aprobación solo si es de este usuario, de los mismos bytes y con su informe en esta máquina", () => {
    const { source } = pack("ana");
    const lib = tempDir("evol-lib-");
    expect(seedLibrary(source, lib, "ana").aprobacionesConservadas).toEqual(["demo"]);
    expect(readManifest(lib).skills["demo"]?.auditoria?.aprobadaPor).toBe("ana");

    const sinInforme = pack("ana", false);
    const lib2 = tempDir("evol-lib-");
    expect(seedLibrary(sinInforme.source, lib2, "ana").aprobacionesConservadas).toEqual([]);

    const cambiada = pack("ana");
    write(cambiada.source, "demo/extra.md", "cambiado después de aprobar\n");
    const lib3 = tempDir("evol-lib-");
    expect(seedLibrary(cambiada.source, lib3, "ana").aprobacionesConservadas).toEqual([]);
  });

  it("no pisa una skill tuya con el mismo nombre y otro contenido, y repetir no cambia nada", () => {
    const { source } = pack();
    const lib = tempDir("evol-lib-");
    write(
      lib,
      "demo/SKILL.md",
      "---\nname: demo\ndescription: La mía, que no debe tocarse nunca\n---\n\nmía\n",
    );
    const r = seedLibrary(source, lib, "ana");
    expect(r.distintas).toEqual(["demo"]);
    expect(r.copiadas).toEqual(["otra"]);
    expect(readFileSync(join(lib, "demo/SKILL.md"), "utf8")).toContain("mía");
    const again = seedLibrary(source, lib, "ana");
    expect(again.copiadas).toEqual([]);
    expect(again.iguales).toEqual(["otra"]);
  });

  it("las skills del propio paquete se pueden sembrar (las del paquete, 45 o más) y ninguna llega aprobada de otro usuario", () => {
    const lib = tempDir("evol-lib-");
    const r = seedLibrary(join(REPO, "skills"), lib, "usuario-que-no-aprobo-nada");
    expect(r.copiadas.length).toBeGreaterThanOrEqual(45);
    expect(r.aprobacionesConservadas).toEqual([]);
  });
});

describe("evol setup: la orden y el instalador", () => {
  it("--comprobar solo mira: sale 0 y lista lo que hay", () => {
    const r = cli(["setup", "--comprobar"], {
      cwd: tempDir(),
      env: { EVOL_CONFIG_DIR: userConfig },
    });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("Skills del paquete:");
    expect(r.stdout).toContain("Solo se ha comprobado");
  });

  it("sin terminal no instala nada y lo dice", () => {
    const r = cli(["setup"], { cwd: tempDir(), env: { EVOL_CONFIG_DIR: userConfig } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("ejecútalo en una terminal");
  });

  it("install.sh: sintaxis válida; --dev deja evol-dev y no toca evol; no pisa un archivo que no es un enlace", () => {
    const script = join(REPO, "install.sh");
    expect(spawnSync("bash", ["-n", script]).status).toBe(0);
    const run = (home: string, ...args: string[]) =>
      spawnSync("bash", [script, ...args], {
        env: { ...process.env, HOME: home },
        encoding: "utf8",
      });
    const home = tempDir("evol-home-");
    const ok = run(home, "--dev", "--sin-compilar", "--sin-setup");
    expect(ok.status, ok.stderr).toBe(0);
    expect(lstatSync(join(home, ".local/bin/evol-dev")).isSymbolicLink()).toBe(true);
    expect(existsSync(join(home, ".local/bin/evol"))).toBe(false);
    const other = tempDir("evol-home-");
    mkdirSync(join(other, ".local/bin"), { recursive: true });
    writeFileSync(join(other, ".local/bin/evol-dev"), "mío\n");
    const refused = run(other, "--dev", "--sin-compilar", "--sin-setup");
    expect(refused.status).toBe(1);
    expect(readFileSync(join(other, ".local/bin/evol-dev"), "utf8")).toBe("mío\n");
    expect(run(home, "--rara").status).toBe(2);
    expect(run(home, "--repositorio").status).toBe(2);
  });

  it("install.sh estable: sin una versión publicada no instala nada y explica cómo publicarla", () => {
    const repo = tempDir("evol-repo-");
    git(repo, "init", "-q", "-b", "main");
    const home = tempDir("evol-home-");
    const r = spawnSync(
      "bash",
      [join(REPO, "install.sh"), "--sin-compilar", "--sin-setup", "--repositorio", repo],
      { env: { ...process.env, HOME: home }, encoding: "utf8" },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no tiene ninguna versión publicada");
    expect(r.stderr).toContain("release x.y.z");
    expect(r.stderr).toContain("--dev");
    expect(existsSync(join(home, ".local/bin/evol"))).toBe(false);
  });
});

const hasScript = spawnSync("script", ["--version"], { encoding: "utf8" }).status === 0;

describe.skipIf(!hasScript)("evol setup en una terminal real (pty)", () => {
  it("pregunta, instala solo lo autorizado y siembra la biblioteca sin aprobar nada", () => {
    const dir = tempDir("evol-tools-");
    const config = tempDir("evol-setup-config-");
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      EVOL_CONFIG_DIR: config,
      EVOL_TOOL_CLAUDE: "",
      // no SSH keys here: the signers step must not ask about the real ones
      EVOL_SSH_DIR: tempDir("evol-no-ssh-"),
    };
    for (const c of COMPONENTS) env[envName(c.id)] = exe(dir, c.bin);
    const made = join(dir, "semgrep-nuevo");
    const log = join(dir, "uv.log");
    env["EVOL_TOOL_UV"] = exe(
      dir,
      "uv",
      `#!/bin/sh\necho "$@" >> "${log}"\ntouch "${made}"\nchmod +x "${made}"\n`,
    );
    env["EVOL_TOOL_SEMGREP"] = made; // not there yet: setup has to ask
    env["EVOL_TOOL_GITLEAKS"] = ""; // needs an administrator: only described
    const r = spawnSync(
      "script",
      [
        "-qec",
        `${process.execPath} --disable-warning=ExperimentalWarning ${join(REPO, "dist/cli.js")} setup`,
        "/dev/null",
      ],
      { cwd: tempDir(), input: "s\n", encoding: "utf8", timeout: 120_000, env },
    );
    expect(r.stdout).toContain("¿Instalarla con «uv tool install semgrep==1.182.0»?");
    expect(r.stdout).toContain("✓ semgrep instalada");
    expect(r.stdout).toContain("sudo pacman -S gitleaks");
    expect(r.stdout).toContain("no encontré «claude»");
    expect(r.stdout).toMatch(/\d+ copiadas a /);
    expect(r.stdout).toContain("Sin aprobar: ");
    expect(readFileSync(log, "utf8").trim()).toBe("tool install semgrep==1.182.0");
    // one that nobody has approved in the package arrives unapproved (the ones this very user approved here may keep theirs)
    expect(readManifest(join(config, "skills")).skills["readme"]?.auditoria).toBeUndefined();
    expect(existsSync(join(config, "skills", "tdd", "SKILL.md"))).toBe(true);
  });
});
