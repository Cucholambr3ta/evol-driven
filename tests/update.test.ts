import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { release } from "../src/release/release.js";
import { makeWritable, verifyIntegrity } from "../src/release/integrity.js";
import {
  currentLink,
  inspectUpdate,
  previousLink,
  rollback,
  update,
  versionsDir,
} from "../src/release/update.js";
import { readInstallRecord, versionInfo } from "../src/release/version.js";
import { readManifest, writeManifest } from "../src/skills/manifest.js";
import { cli, isolateUserConfig, tempDir, write } from "./helpers.js";
import { git, origin, signersOf, skill } from "./release-helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

// installed versions are read-only on purpose: open them again so the temporary folders can be removed
const homes: string[] = [];
afterAll(() => {
  for (const h of homes) if (existsSync(h)) makeWritable(h);
});

const fakeBuild = (dir: string): void => {
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "dist/cli.js"), "#!/usr/bin/env node\nconsole.log('evol')\n");
};

/** A remote with two signed releases, and a machine with nothing installed. */
function scenario() {
  const remote = origin();
  release({ root: remote, version: "0.3.0", ci: null });
  const machine = {
    home: (() => {
      const h = tempDir("evol-home-");
      homes.push(h);
      return h;
    })(),
    bin: join(tempDir("evol-bin-"), "evol"),
    library: tempDir("evol-lib-"),
    signers: signersOf(remote),
  };
  const deps = (confirm: (s: string) => Promise<boolean> = () => Promise.resolve(true)) => ({
    repo: remote,
    home: machine.home,
    signers: machine.signers,
    binLink: machine.bin,
    build: fakeBuild,
    confirm,
  });
  const publish = (version: string, change: () => void) => {
    change();
    git(remote, "add", "-A");
    git(remote, "commit", "-q", "-m", `cambios de ${version}`);
    release({ root: remote, version, ci: null });
  };
  return { remote, machine, deps, publish };
}

describe("evol update", () => {
  it("instala la versión firmada: solo lectura, con integridad, enlazada y con las skills sin aprobar", async () => {
    const { machine, deps } = scenario();
    let shown = "";
    const r = await update(
      deps((s) => ((shown = s), Promise.resolve(true))),
      machine.library,
    );
    expect(r).toMatchObject({ estado: "instalada", version: "0.3.0" });
    expect(shown).toContain("Versión 0.3.0");
    expect(shown).toContain("firma verificada");

    const installed = join(versionsDir(machine.home), "0.3.0");
    expect(readInstallRecord(installed)).toMatchObject({
      version: "0.3.0",
      etiqueta: "v0.3.0",
      firmaVerificada: true,
    });
    expect(versionInfo(installed).canal).toBe("estable");
    expect(verifyIntegrity(installed).ok).toBe(true);
    expect(() => writeFileSync(join(installed, "dist/cli.js"), "x")).toThrow();
    expect(resolve(machine.home, readlinkSync(currentLink(machine.home)))).toBe(installed);
    expect(resolve(join(machine.bin, ".."), readlinkSync(machine.bin))).toBe(
      join(currentLink(machine.home), "dist/cli.js"),
    );
    expect(existsSync(join(machine.library, "tdd/SKILL.md"))).toBe(true);
    expect(readManifest(machine.library).skills["tdd"]?.auditoria).toBeUndefined();
  });

  it("si respondes que no, no se instala nada", async () => {
    const { machine, deps } = scenario();
    expect(
      await update(
        deps(() => Promise.resolve(false)),
        machine.library,
      ),
    ).toEqual({ estado: "cancelada" });
    expect(existsSync(versionsDir(machine.home))).toBe(false);
    expect(existsSync(machine.bin)).toBe(false);
  });

  it("no instala una etiqueta sin firma, ni una firmada por una clave que no es tuya", async () => {
    const { remote, machine, deps } = scenario();
    write(remote, "x.txt", "x\n");
    git(remote, "add", "-A");
    git(remote, "commit", "-q", "-m", "x");
    git(remote, "tag", "-a", "v0.4.0", "-m", "sin firma");
    await expect(update(deps(), machine.library, "0.4.0")).rejects.toThrow(/no se instala/);

    const other = join(tempDir("evol-otra-"), "id");
    spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", other]);
    git(remote, "-c", `user.signingkey=${other}.pub`, "tag", "-s", "v0.5.0", "-m", "ajena");
    await expect(update(deps(), machine.library, "0.5.0")).rejects.toThrow(/no se instala/);
    expect(existsSync(versionsDir(machine.home))).toBe(false);
  });

  it("sin el archivo de firmantes no instala nada y dice cómo se prepara", async () => {
    const { machine, deps } = scenario();
    await expect(
      update({ ...deps(), signers: join(tempDir(), "no-existe") }, machine.library),
    ).rejects.toThrow(/allowed_signers|claves públicas/);
  });

  it("repetir no reinstala: ya estás al día", async () => {
    const { machine, deps } = scenario();
    await update(deps(), machine.library);
    expect(await update(deps(), machine.library)).toMatchObject({ estado: "al-dia" });
  });

  it("una versión nueva conserva la anterior; sus skills cambiadas llegan sin aprobar y la vieja se aparta", async () => {
    const { remote, machine, deps, publish } = scenario();
    await update(deps(), machine.library);
    // the person approved tdd in the library
    const manifest = readManifest(machine.library);
    manifest.skills["tdd"] = {
      alcance: "personal",
      fases: [],
      auditoria: { estado: "aprobada", huella: "a".repeat(64), fecha: "x" },
    };
    writeManifest(machine.library, manifest);
    publish("0.4.0", () => write(remote, "skills/tdd/SKILL.md", skill("tdd", "Versión nueva.")));
    const r = await update(deps(), machine.library);
    expect(r).toMatchObject({ estado: "instalada", version: "0.4.0" });
    expect(r.skills?.cambiadas).toEqual(["tdd"]);
    expect(readFileSync(join(machine.library, "tdd/SKILL.md"), "utf8")).toContain("Versión nueva.");
    expect(readManifest(machine.library).skills["tdd"]?.auditoria).toBeUndefined();
    expect(readdirSync(machine.library).some((n) => n.startsWith(".tdd.previa-"))).toBe(true);
    // the previous version is still on disk and linked as «anterior»
    expect(existsSync(join(versionsDir(machine.home), "0.3.0/package.json"))).toBe(true);
    expect(resolve(machine.home, readlinkSync(previousLink(machine.home)))).toBe(
      join(versionsDir(machine.home), "0.3.0"),
    );
  });

  it("volver cambia solo los enlaces", async () => {
    const { remote, machine, deps, publish } = scenario();
    await update(deps(), machine.library);
    publish("0.4.0", () => write(remote, "y.txt", "y\n"));
    await update(deps(), machine.library);
    expect(rollback(machine.bin, machine.home)).toBe("0.3.0");
    expect(
      versionInfo(resolve(machine.home, readlinkSync(currentLink(machine.home)))).version,
    ).toBe("0.3.0");
    expect(existsSync(join(versionsDir(machine.home), "0.4.0"))).toBe(true);
    expect(rollback(machine.bin, machine.home)).toBe("0.4.0");
    expect(() => rollback(machine.bin, tempDir())).toThrow(/No hay una versión anterior/);
  });

  it("si `evol` apuntaba al origen, esa copia no se pierde: pasa a llamarse evol-dev", async () => {
    const { machine, deps } = scenario();
    const checkout = tempDir("evol-checkout-");
    mkdirSync(join(checkout, "dist"), { recursive: true });
    writeFileSync(join(checkout, "dist/cli.js"), "x");
    mkdirSync(join(machine.bin, ".."), { recursive: true });
    symlinkSync(join(checkout, "dist/cli.js"), machine.bin);
    const r = await update(deps(), machine.library);
    expect(r.devLink).toBe(join(machine.bin, "..", "evol-dev"));
    expect(readlinkSync(r.devLink as string)).toBe(join(checkout, "dist/cli.js"));
  });

  it("si `evol` es un archivo que no es un enlace, no lo toca", async () => {
    const { machine, deps } = scenario();
    mkdirSync(join(machine.bin, ".."), { recursive: true });
    writeFileSync(machine.bin, "mío\n");
    await expect(update(deps(), machine.library)).rejects.toThrow(/no es un enlace/);
    expect(readFileSync(machine.bin, "utf8")).toBe("mío\n");
    expect(lstatSync(machine.bin).isFile()).toBe(true);
  });

  it("inspectUpdate lista las versiones y rechaza una que no existe", () => {
    const { remote, machine } = scenario();
    const info = inspectUpdate({ repo: remote, home: machine.home, signers: machine.signers });
    expect(info.etiquetas).toEqual(["v0.3.0"]);
    expect(info.candidata).toMatchObject({ version: "0.3.0", firma: { ok: true } });
    expect(info.candidata?.cambios).toContain("## 0.3.0");
    expect(() =>
      inspectUpdate({ repo: remote, home: machine.home, signers: machine.signers }, "9.9.9"),
    ).toThrow(/No existe la versión/);
  });
});

describe("evol update desde la línea de órdenes", () => {
  it("--comprobar solo mira: dice la firma y los cambios, sin instalar", () => {
    const { remote, machine } = scenario();
    copyFileSync(machine.signers, join(userConfig, "allowed_signers"));
    const env = { EVOL_CONFIG_DIR: userConfig, EVOL_HOME: machine.home };
    const r = cli(["update", "--comprobar", "--repositorio", remote], { cwd: tempDir(), env });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("Última: 0.3.0, firma: válida");
    expect(r.stdout).toContain("Solo se ha comprobado");
    expect(existsSync(versionsDir(machine.home))).toBe(false);
  });

  it("sin terminal no instala y lo dice", () => {
    const { remote, machine } = scenario();
    const r = cli(["update", "--repositorio", remote], {
      cwd: tempDir(),
      env: { EVOL_CONFIG_DIR: userConfig, EVOL_HOME: machine.home },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("pide tu confirmación");
  });
});
