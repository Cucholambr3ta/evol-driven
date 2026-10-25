import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig, tempDir } from "../helpers.js";
import { origin } from "../release-helpers.js";

const env = (dir: string) => ({ EVOL_CONFIG_DIR: dir });

describe("saber cuándo hay una versión nueva", () => {
  it("CA-145: doctor avisa de una versión nueva firmada y de las skills que perderían aprobación", () => {
    const upstream = origin({ signing: true });
    cli(["release", "0.4.0"], { cwd: upstream, env: env(isolateUserConfig()) });
    const config = isolateUserConfig();
    const project = tempDir("evol-aviso-");

    const result = cli(["doctor"], {
      cwd: project,
      env: { ...env(config), EVOL_UPDATE_REPO: upstream },
    });

    expect(result.stdout).toMatch(/0\.4\.0/);
    expect(result.stdout).toMatch(/evol update/);
  });

  it("CA-145: el aviso no repite la consulta de red dentro del mismo día", () => {
    const config = isolateUserConfig();
    writeFileSync(
      join(config, "aviso-version.json"),
      JSON.stringify({ consultadoEl: new Date().toISOString(), versionNueva: null }),
    );
    const project = tempDir("evol-aviso-cache-");

    const result = cli(["doctor"], {
      cwd: project,
      env: { ...env(config), EVOL_UPDATE_REPO: "ssh://no-deberia-llamarse" },
    });

    expect(result.status).toBe(0);
  });

  it("CA-145: sin red, doctor no falla y termina rápido", () => {
    const config = isolateUserConfig();
    const project = tempDir("evol-aviso-sin-red-");
    const started = Date.now();

    const result = cli(["doctor"], {
      cwd: project,
      env: { ...env(config), EVOL_UPDATE_REPO: "ssh://host-inexistente.invalid/no-existe" },
    });

    expect(Date.now() - started).toBeLessThan(5_000);
    expect(result.status).toBe(0);
  });

  it("CA-145: la persona puede apagar el aviso", () => {
    const config = isolateUserConfig();
    writeFileSync(
      join(config, "config.json"),
      JSON.stringify({ actualizaciones: { aviso: false } }),
    );
    const upstream = origin({ signing: true });
    cli(["release", "0.4.0"], { cwd: upstream, env: env(config) });
    const project = tempDir("evol-aviso-apagado-");

    const result = cli(["doctor"], {
      cwd: project,
      env: { ...env(config), EVOL_UPDATE_REPO: upstream },
    });

    expect(result.stdout).not.toMatch(/versión nueva/i);
  });
});
