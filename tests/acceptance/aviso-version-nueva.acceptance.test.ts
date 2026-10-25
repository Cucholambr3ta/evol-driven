import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { release } from "../../src/release/release.js";
import { writeManifest } from "../../src/skills/manifest.js";
import { cli, isolateUserConfig, tempDir, write } from "../helpers.js";
import { git, origin } from "../release-helpers.js";

const env = (dir: string) => ({ EVOL_CONFIG_DIR: dir });

/** The hash `evol release` recorded for `skillId` in `root`'s release.json for `version`. */
function hashOf(root: string, version: string, skillId: string): string {
  const show = git(root, "show", `v${version}:release.json`).stdout;
  const record = JSON.parse(show) as { skills: Record<string, string> };
  const hash = record.skills[skillId];
  if (!hash) throw new Error(`release.json de v${version} no tiene la skill «${skillId}»`);
  return hash;
}

/** A library (EVOL_CONFIG_DIR/skills) with `skillId` installed and approved at `approvedHash`. */
function approveSkillLocally(
  config: string,
  skillId: string,
  body: string,
  approvedHash: string,
): void {
  const skillsDir = join(config, "skills");
  mkdirSync(join(skillsDir, skillId), { recursive: true });
  writeFileSync(join(skillsDir, skillId, "SKILL.md"), body);
  writeManifest(skillsDir, {
    version: 1,
    skills: {
      [skillId]: {
        alcance: "paquete",
        fases: [],
        auditoria: { estado: "aprobada", huella: approvedHash, fecha: "2026-10-01" },
      },
    },
  });
}

describe("saber cuándo hay una versión nueva", () => {
  it("CA-145: doctor avisa de una versión nueva firmada y de las skills que perderían aprobación", () => {
    const upstream = origin({ signing: true });
    const originalSkill = readFileSync(join(upstream, "skills", "tdd", "SKILL.md"), "utf8");
    release({ root: upstream, version: "0.3.0", ci: null });
    const approvedHash = hashOf(upstream, "0.3.0", "tdd");

    // la versión 0.4.0 cambia el contenido de la skill «tdd»: su hash ya no es el que se aprobó
    write(upstream, "skills/tdd/SKILL.md", `${originalSkill}\n<!-- ajuste en 0.4.0 -->\n`);
    git(upstream, "add", "-A");
    git(upstream, "commit", "-q", "-m", "ajusta tdd");
    release({ root: upstream, version: "0.4.0", ci: null });

    const config = isolateUserConfig();
    approveSkillLocally(config, "tdd", originalSkill, approvedHash);
    const project = tempDir("evol-aviso-");

    const result = cli(["doctor"], {
      cwd: project,
      env: { ...env(config), EVOL_UPDATE_REPO: upstream },
    });

    expect(result.stdout).toMatch(/0\.4\.0/);
    expect(result.stdout).toMatch(/evol update/);
    expect(result.stdout).toMatch(/tdd/);
    expect(result.stdout).toMatch(/perder(ía|ían)|sin aprobar|vuelve a pedir aprobaci/i);
  });

  it("CA-145: el aviso no repite la consulta de red dentro del mismo día", () => {
    const config = isolateUserConfig();
    writeFileSync(
      join(config, "aviso-version.json"),
      JSON.stringify({ consultadoEl: new Date().toISOString(), versionNueva: "0.9.9" }),
    );
    const project = tempDir("evol-aviso-cache-");

    const result = cli(["doctor"], {
      cwd: project,
      env: { ...env(config), EVOL_UPDATE_REPO: "ssh://no-deberia-llamarse.invalid/repo" },
    });

    expect(result.status).toBe(0);
    // el aviso guardado en caché (0.9.9) aparece aunque el repositorio configurado no se pueda alcanzar
    expect(result.stdout).toMatch(/0\.9\.9/);
  });

  it("CA-145: sin red, doctor no falla y termina en menos de 3 segundos", () => {
    const config = isolateUserConfig();
    const project = tempDir("evol-aviso-sin-red-");
    const started = Date.now();

    const result = cli(["doctor"], {
      cwd: project,
      env: { ...env(config), EVOL_UPDATE_REPO: "ssh://host-inexistente.invalid/no-existe" },
    });

    expect(Date.now() - started).toBeLessThan(3_000);
    expect(result.status).toBe(0);
  });

  it("CA-145: la persona puede apagar el aviso", () => {
    const config = isolateUserConfig();
    writeFileSync(
      join(config, "config.json"),
      JSON.stringify({ actualizaciones: { aviso: false } }),
    );
    const upstream = origin({ signing: true });
    release({ root: upstream, version: "0.4.0", ci: null });
    const project = tempDir("evol-aviso-apagado-");

    const result = cli(["doctor"], {
      cwd: project,
      env: { ...env(config), EVOL_UPDATE_REPO: upstream },
    });

    expect(result.stdout).not.toMatch(/versión nueva/i);
  });
});
