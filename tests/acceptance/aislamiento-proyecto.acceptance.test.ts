import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig, makeProject } from "../helpers.js";

const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];

/** A fake HOME with a global framework already installed, the way gentle-ai leaves it. */
function fakeHomeWithGlobalFramework(): string {
  const home = isolateUserConfig(); // reuses the isolated dir as a stand-in HOME root
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(
    join(home, ".claude", "settings.json"),
    JSON.stringify(
      {
        outputStyle: "Gentleman",
        permissions: { defaultMode: "bypassPermissions", deny: [] },
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: "gentle-ai review stop-hook" }] }],
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(home, ".claude", "CLAUDE.md"), "# Instrucciones globales de otro framework\n");
  return home;
}

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

describe("las reglas del proyecto por encima de las globales", () => {
  it("CA-135: aislar el proyecto no cambia nada fuera de él", () => {
    const home = fakeHomeWithGlobalFramework();
    const globalSettings = join(home, ".claude", "settings.json");
    const beforeHash = sha256(globalSettings);
    const root = makeProject(DISC);

    const result = cli(["agents"], { cwd: root, env: { HOME: home, EVOL_CONFIG_DIR: home } });

    expect(result.status).toBe(0);
    expect(sha256(globalSettings)).toBe(beforeHash);
    const claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(claudeMd).toMatch(/Reglas de este proyecto \(prevalecen sobre las globales\)/);
  });

  it("CA-135: solo se apagan los plugins que de verdad están activados", () => {
    const home = isolateUserConfig();
    const root = makeProject(DISC);

    cli(["agents"], { cwd: root, env: { HOME: home, EVOL_CONFIG_DIR: home } });

    const settings = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8")) as {
      enabledPlugins?: Record<string, boolean>;
    };
    expect(settings.enabledPlugins).toBeUndefined();
  });

  it("CA-136: doctor nombra un hook global no anulable", () => {
    const home = fakeHomeWithGlobalFramework();
    const root = makeProject(DISC);
    cli(["agents"], { cwd: root, env: { HOME: home, EVOL_CONFIG_DIR: home } });

    const result = cli(["doctor"], { cwd: root, env: { HOME: home, EVOL_CONFIG_DIR: home } });

    expect(result.stdout).toMatch(/no anulable/);
    expect(result.stdout).toMatch(/gentle-ai review stop-hook/);
  });

  it("CA-136: doctor avisa de bypassPermissions activo", () => {
    const home = fakeHomeWithGlobalFramework();
    const root = makeProject(DISC);

    const result = cli(["doctor"], { cwd: root, env: { HOME: home, EVOL_CONFIG_DIR: home } });

    expect(result.stdout).toMatch(/bypassPermissions|sin preguntar/);
  });

  it("CA-136: doctor marca cada protección como impuesta o declarativa", () => {
    const home = isolateUserConfig();
    const root = makeProject(DISC);
    cli(["agents"], { cwd: root, env: { HOME: home, EVOL_CONFIG_DIR: home } });

    const result = cli(["doctor"], { cwd: root, env: { HOME: home, EVOL_CONFIG_DIR: home } });

    // cada regla de bloqueo lleva su propia etiqueta: al menos tantas apariciones de «impuesta»
    // o «declarativa» como rutas protegidas (.ssh, .env, .pem, .key, aws, gate, ciclo…), no una
    // mención genérica suelta.
    const etiquetas = (result.stdout.match(/\b(impuesta|declarativa)\b/g) ?? []).length;
    expect(etiquetas).toBeGreaterThanOrEqual(5);
  });
});
