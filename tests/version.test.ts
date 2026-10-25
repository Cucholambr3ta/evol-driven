import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  hashFiles,
  makeReadOnly,
  makeWritable,
  verifyIntegrity,
  writeIntegrity,
} from "../src/release/integrity.js";
import {
  compareVersions,
  describeVersion,
  INSTALL_FILE,
  versionInfo,
} from "../src/release/version.js";
import { loadState } from "../src/core/state.js";
import { cli, isolateUserConfig, makeProject, tempDir, write } from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

/** A folder that looks like an installed copy: package.json, dist and skills, plus its install record. */
function installedCopy(): string {
  const root = tempDir("evol-estable-");
  write(root, "package.json", JSON.stringify({ name: "evol-driven", version: "0.3.0" }));
  write(root, "dist/cli.js", "console.log('hola')\n");
  write(root, "skills/tdd/SKILL.md", "---\nname: tdd\n---\n");
  write(root, "disciplines/TDD.json", "{}\n");
  return root;
}
const record = {
  version: "0.3.0",
  etiqueta: "v0.3.0",
  commit: "a1b2c3d4e5f6",
  instaladaEn: "2026-10-23T12:00:00Z",
  repositorio: "git@github.com:Cucholambr3ta/evol-driven.git",
  firmaVerificada: true,
};

describe("qué evol es: origen o estable", () => {
  it("una copia con INSTALACION.json es la estable, y dice su etiqueta y commit", () => {
    const root = installedCopy();
    writeFileSync(join(root, INSTALL_FILE), JSON.stringify(record));
    const info = versionInfo(root);
    expect(info).toMatchObject({
      version: "0.3.0",
      canal: "estable",
      etiqueta: "v0.3.0",
      commit: "a1b2c3d",
      sucio: false,
    });
    expect(describeVersion(info)).toBe("0.3.0 (estable, v0.3.0, a1b2c3d)");
  });

  it("un checkout de git es el origen; avisa de la rama y de los cambios sin guardar", () => {
    const root = installedCopy();
    const run = (...a: string[]) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
    run("init", "-q", "-b", "trabajo");
    run("-c", "user.email=a@b.c", "-c", "user.name=a", "add", "-A");
    run("-c", "user.email=a@b.c", "-c", "user.name=a", "commit", "-q", "-m", "x");
    const clean = versionInfo(root);
    expect(clean).toMatchObject({ canal: "origen", rama: "trabajo", sucio: false });
    write(root, "dist/otro.js", "x\n");
    const dirty = versionInfo(root);
    expect(dirty.sucio).toBe(true);
    expect(describeVersion(dirty)).toContain("rama trabajo");
    expect(describeVersion(dirty)).toContain("con cambios sin guardar");
  });

  it("sin git ni registro de instalación es «desconocido», y un registro roto no cuenta", () => {
    const root = installedCopy();
    expect(versionInfo(root).canal).toBe("desconocido");
    writeFileSync(join(root, INSTALL_FILE), "{roto");
    expect(versionInfo(root).canal).toBe("desconocido");
  });

  it("compara versiones por número, no por texto", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBe(1);
    expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.2.0", "0.3.0")).toBe(-1);
    expect(compareVersions("1.0.0-rc1", "1.0.0")).toBe(0);
  });

  it("evol version y --json lo cuentan; --version sigue siendo solo el número", () => {
    const plain = cli(["--version"], { cwd: tempDir(), env: { EVOL_CONFIG_DIR: userConfig } });
    expect(plain.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    const r = cli(["version"], { cwd: tempDir(), env: { EVOL_CONFIG_DIR: userConfig } });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/^evol \d+\.\d+\.\d+ \(origen/);
    const json = JSON.parse(
      cli(["version", "--json"], { cwd: tempDir(), env: { EVOL_CONFIG_DIR: userConfig } }).stdout,
    ) as { canal: string };
    expect(json.canal).toBe("origen");
  });
});

describe("integridad y solo lectura de la copia instalada", () => {
  it("detecta un archivo cambiado, uno que falta y uno nuevo", () => {
    const root = installedCopy();
    const count = writeIntegrity(root);
    expect(count).toBe(Object.keys(hashFiles(root)).length);
    expect(verifyIntegrity(root)).toMatchObject({ ok: true });
    writeFileSync(join(root, "dist/cli.js"), "console.log('cambiado')\n");
    write(root, "skills/tdd/extra.md", "nuevo\n");
    rmSync(join(root, "disciplines/TDD.json"));
    const r = verifyIntegrity(root);
    expect(r.ok).toBe(false);
    expect(r.modificados).toEqual(["dist/cli.js"]);
    expect(r.nuevos).toEqual(["skills/tdd/extra.md"]);
    expect(r.faltan).toEqual(["disciplines/TDD.json"]);
  });

  it("sin registro no puede comparar y lo dice", () => {
    expect(verifyIntegrity(installedCopy())).toMatchObject({ ok: false, sinRegistro: true });
  });

  it("solo lectura: editar un archivo falla, y se puede volver a abrir para borrar", () => {
    const root = installedCopy();
    makeReadOnly(root);
    expect(() => writeFileSync(join(root, "dist/cli.js"), "x")).toThrow();
    expect(() => writeFileSync(join(root, "dist/nuevo.js"), "x")).toThrow();
    expect(statSync(join(root, "dist/cli.js")).mode & 0o222).toBe(0);
    makeWritable(root);
    writeFileSync(join(root, "dist/cli.js"), "x");
    expect(readFileSync(join(root, "dist/cli.js"), "utf8")).toBe("x");
  });
});

describe("doctor y los proyectos", () => {
  it("un proyecto nuevo guarda con qué evol se creó", () => {
    const root = makeProject(["FDD"]);
    const state = loadState(root);
    expect(state.creadoCon).toMatchObject({
      version: expect.stringMatching(/^\d+\.\d+\.\d+$/) as string,
      canal: "origen",
    });
  });

  it("doctor avisa si el proyecto lo creó una versión más nueva, y de que se usa el origen", () => {
    const root = makeProject(["FDD"]);
    const file = join(root, ".evol/state.json");
    const state = JSON.parse(readFileSync(file, "utf8")) as { creadoCon: { version: string } };
    state.creadoCon.version = "99.0.0";
    writeFileSync(file, JSON.stringify(state));
    const r = cli(["doctor"], { cwd: root, env: { EVOL_CONFIG_DIR: userConfig } });
    expect(r.stdout).toMatch(/! Versión con la que se creó el proyecto: 99\.0\.0 .* es más nueva/);
    expect(r.stdout).toContain("estás usando el origen del framework");
    const quiet = cli(["doctor"], {
      cwd: root,
      env: { EVOL_CONFIG_DIR: userConfig, EVOL_ORIGIN_OK: "1" },
    });
    expect(quiet.stdout).not.toContain("estás usando el origen");
  });

  it("un proyecto anterior al campo no da error", () => {
    const root = makeProject(["FDD"]);
    const file = join(root, ".evol/state.json");
    const state = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    delete state["creadoCon"];
    writeFileSync(file, JSON.stringify(state));
    expect(loadState(root).creadoCon).toBeUndefined();
    expect(existsSync(file)).toBe(true);
    mkdirSync(join(root, "x"), { recursive: true });
    chmodSync(join(root, "x"), 0o755);
  });
});
