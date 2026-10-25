import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { diffSkills } from "../src/release/release.js";
import { syncLibrary, syncSummary } from "../src/release/update.js";
import { readSkill } from "../src/skills/skill.js";
import { pendingApprovals, readManifest, writeManifest } from "../src/skills/manifest.js";
import { listSkills } from "../src/skills/library.js";
import { cli, isolateUserConfig, tempDir, write } from "./helpers.js";
import { skill } from "./release-helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});
const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });

/** A library with the given skills (a skill called «constructor» is the real-world troublemaker). */
function library(names: string[]): string {
  const dir = tempDir("evol-lib-");
  for (const n of names) write(dir, `${n}/SKILL.md`, skill(n));
  return dir;
}

describe("una skill que se llama como una propiedad de Object (constructor)", () => {
  it("evol skills list llega hasta el final y la lista incluye a «constructor»", () => {
    const dir = library(["alfa", "constructor", "zeta"]);
    const r = cli(["skills", "list", "--dir", dir], { cwd: tempDir(), env: env() });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).not.toContain("TypeError");
    expect(r.stdout).toMatch(/^constructor\s+sin auditar/m);
    expect(r.stdout).toMatch(/^zeta\s+sin auditar/m);
  });

  it("sin entrada en el manifiesto, «constructor» no existe: no es la propiedad heredada", () => {
    const dir = library(["constructor"]);
    expect(readManifest(dir).skills["constructor"]).toBeUndefined();
    expect(readManifest(dir).skills["toString"]).toBeUndefined();
  });

  it("el changelog la cuenta como nueva o cambiada según corresponda, no siempre como cambiada", () => {
    expect(diffSkills({}, { constructor: "1", otra: "1" })).toEqual({
      nuevas: ["constructor", "otra"],
      cambiadas: [],
      quitadas: [],
    });
    expect(diffSkills({ constructor: "1" }, { constructor: "2" })).toEqual({
      nuevas: [],
      cambiadas: ["constructor"],
      quitadas: [],
    });
    expect(diffSkills({ constructor: "1" }, {}).quitadas).toEqual(["constructor"]);
  });
});

describe("qué hay que aprobar después de actualizar", () => {
  /** A library with `tdd` approved (with its real fingerprint) and `bdd` never audited, and a newer source. */
  function scenario() {
    const lib = library(["tdd", "bdd"]);
    const manifest = readManifest(lib);
    manifest.skills["tdd"] = {
      alcance: "personal",
      fases: [],
      auditoria: { estado: "aprobada", huella: readSkill(join(lib, "tdd")).huella, fecha: "x" },
    };
    writeManifest(lib, manifest);
    const source = tempDir("evol-src-");
    write(source, "tdd/SKILL.md", skill("tdd", "Versión nueva."));
    write(source, "bdd/SKILL.md", skill("bdd", "Otra versión."));
    write(source, "nueva/SKILL.md", skill("nueva"));
    return { lib, source };
  }

  it("recuerda las skills cuya aprobación se perdió, y no las que nunca estuvieron aprobadas", () => {
    const { lib, source } = scenario();
    const r = syncLibrary(source, lib, new Date("2026-10-25T12:00:00Z"));
    expect(r.cambiadas).toEqual(["bdd", "tdd"]);
    expect(r.nuevas).toEqual(["nueva"]);
    expect(r.perdieronAprobacion).toEqual(["tdd"]);
    const manifest = readManifest(lib);
    expect(manifest.skills["tdd"]?.auditoria).toBeUndefined();
    expect(manifest.skills["tdd"]?.aprobacionPerdida).toBe("2026-10-25T12:00:00.000Z");
    expect(manifest.skills["bdd"]?.aprobacionPerdida).toBeUndefined();
  });

  it("pendingApprovals pone primero las que tenías aprobadas y explica el motivo", () => {
    const { lib, source } = scenario();
    syncLibrary(source, lib);
    const pending = pendingApprovals(listSkills(lib), readManifest(lib));
    expect(pending.map((p) => `${p.id}:${p.motivo}`)).toEqual([
      "tdd:perdio-aprobacion",
      "bdd:sin-auditar",
      "nueva:sin-auditar",
    ]);
  });

  it("una skill cambiada tras aprobarla (sin actualizar) figura como «cambió»", () => {
    const lib = library(["tdd"]);
    const manifest = readManifest(lib);
    manifest.skills["tdd"] = {
      alcance: "personal",
      fases: [],
      auditoria: { estado: "aprobada", huella: "a".repeat(64), fecha: "x" },
    };
    writeManifest(lib, manifest);
    expect(pendingApprovals(listSkills(lib), readManifest(lib))[0]?.motivo).toBe("cambio");
  });

  it("una aprobación vigente quita la marca: ya no figura como pendiente", () => {
    const { lib, source } = scenario();
    syncLibrary(source, lib);
    const manifest = readManifest(lib);
    const current = readSkill(join(lib, "tdd")).huella;
    const entry = manifest.skills["tdd"];
    if (entry) entry.auditoria = { estado: "aprobada", huella: current, fecha: "y" };
    writeManifest(lib, manifest);
    expect(pendingApprovals(listSkills(lib), readManifest(lib)).map((p) => p.id)).not.toContain(
      "tdd",
    );
  });

  it("el aviso de evol update nombra cada skill con los dos comandos para aprobarla otra vez", () => {
    const lines = syncSummary(
      {
        nuevas: ["x"],
        cambiadas: ["tdd", "evol"],
        iguales: ["a", "b"],
        perdieronAprobacion: ["tdd", "evol"],
      },
      "/lib",
    );
    const text = lines.join("\n");
    expect(text).toContain("1 nuevas, 2 cambiadas, 2 sin cambios");
    expect(text).toContain("Pierden la aprobación que habías dado (2)");
    expect(text).toContain("evol skills audit /lib/tdd --propia --subproceso");
    expect(text).toContain("evol skills approve evol");
    expect(text).toContain("evol skills list --pendientes");
  });

  it("evol skills list --pendientes muestra los grupos y los comandos; --json lo da estructurado", () => {
    const { lib, source } = scenario();
    syncLibrary(source, lib);
    const r = cli(["skills", "list", "--pendientes", "--dir", lib], { cwd: tempDir(), env: env() });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("Pendientes de aprobar");
    expect(r.stdout).toContain("Perdieron la aprobación que habías dado");
    expect(r.stdout).toContain(`evol skills approve tdd`);
    expect(r.stdout).toContain("Nunca auditadas (2)");
    const json = cli(["skills", "list", "--pendientes", "--json", "--dir", lib], {
      cwd: tempDir(),
      env: env(),
    });
    expect((JSON.parse(json.stdout) as { pendientes: { id: string }[] }).pendientes[0]?.id).toBe(
      "tdd",
    );
    const clean = cli(["skills", "list", "--pendientes", "--dir", library([])], {
      cwd: tempDir(),
      env: env(),
    });
    expect(clean.stdout).toContain("está aprobado");
  });

  it("evol doctor avisa de las que perdieron la aprobación", () => {
    const { lib, source } = scenario();
    syncLibrary(source, lib);
    // doctor reads the user's library: put this one where it looks
    const home = tempDir("evol-doctor-cfg-");
    const target = join(home, "skills");
    const cp = cli(["skills", "list", "--dir", lib], { cwd: tempDir(), env: env() });
    expect(cp.status).toBe(0);
    for (const n of ["tdd", "bdd", "nueva"]) write(target, `${n}/SKILL.md`, readSkillText(lib, n));
    write(target, "manifest.json", readManifestText(lib));
    const r = cli(["doctor"], { cwd: tempDir(), env: { EVOL_CONFIG_DIR: home } });
    const line = r.stdout.split("\n").find((l) => l.includes("Skills:")) ?? "";
    expect(line).toContain("1 perdieron tu aprobación tras actualizar (tdd)");
    expect(line.startsWith("✗")).toBe(false);
  }, 90_000);
});

const readSkillText = (dir: string, name: string): string =>
  readFileSync(join(dir, name, "SKILL.md"), "utf8");
const readManifestText = (dir: string): string => readFileSync(join(dir, "manifest.json"), "utf8");
