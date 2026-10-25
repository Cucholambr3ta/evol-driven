import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { release } from "../../src/release/release.js";
import { cli, isolateUserConfig } from "../helpers.js";
import { git, origin, signersOf } from "../release-helpers.js";

const env = () => ({ EVOL_CONFIG_DIR: isolateUserConfig() });

/** Points `EVOL_CONFIG_DIR/allowed_signers` at the key `root` was released with. */
function trustSignerOf(root: string, configDir: string): void {
  copyFileSync(signersOf(root), join(configDir, "allowed_signers"));
}

describe("procedencia verificable de cada versión", () => {
  it("CA-142: el release incluye las sumas, el SBOM y la firma", () => {
    const root = origin({ signing: true });

    const result = cli(["release", "0.3.0"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    const show = (path: string) => git(root, "show", `v0.3.0:${path}`).stdout;
    expect(show("release/SUMAS.txt")).toMatch(/\S/);
    expect(show("release/sbom.spdx.json")).toMatch(/SPDXID/);
    expect(show("release/SUMAS.txt.sig")).toMatch(/SSH SIGNATURE/);
  });

  it("CA-143: update rechaza una versión cuyos archivos ya no coinciden con sus propias sumas", () => {
    const root = origin({ signing: true });
    release({ root, version: "0.3.0", ci: null });
    // una versión publicada, con su etiqueta y SUMAS.txt válidos, cuyo contenido se alteró después:
    // un commit nuevo cambia un archivo real sin tocar release/SUMAS.txt, y se etiqueta con la misma
    // clave (la firma de la etiqueta es válida; lo que falla es que las sumas ya no describen el árbol).
    git(root, "checkout", "-q", "v0.3.0");
    git(root, "checkout", "-q", "-b", "alterada");
    const skillPath = join(root, "skills", "tdd", "SKILL.md");
    const original = readFileSync(skillPath, "utf8");
    // se altera un archivo real sin regenerar release/SUMAS.txt
    writeFileSync(skillPath, `${original}\n<!-- contenido alterado tras la firma -->\n`);
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "manipulación");
    git(root, "tag", "-f", "-s", "v0.3.0", "-m", "evol-driven 0.3.0 (alterada)");
    const config = isolateUserConfig();
    trustSignerOf(root, config);

    const result = cli(["update", "--comprobar", "--repositorio", root], {
      cwd: root,
      env: { EVOL_CONFIG_DIR: config },
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/suma/i);
    expect(result.stdout + result.stderr).not.toMatch(/firma inválida|firma no válida/i);
  });

  it("CA-143: update rechaza una etiqueta cuya firma no es de una clave autorizada", () => {
    const root = origin({ signing: true });
    release({ root, version: "0.3.0", ci: null });
    // una segunda versión, firmada con una clave que el usuario nunca autorizó
    git(root, "checkout", "-q", "v0.3.0");
    git(root, "checkout", "-q", "-b", "siguiente");
    git(root, "commit", "-q", "--allow-empty", "-m", "0.3.1");
    git(root, "tag", "-f", "-s", "v0.3.0", "-m", "evol-driven 0.3.0 (otra clave)");
    const config = isolateUserConfig();
    // allowed_signers de otra clave, no la de `root`: la firma de la etiqueta no se reconoce
    const other = origin({ signing: true });
    trustSignerOf(other, config);

    const result = cli(["update", "--comprobar", "--repositorio", root], {
      cwd: root,
      env: { EVOL_CONFIG_DIR: config },
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/firma/i);
  });

  it("CA-143: ninguna opción de update salta la verificación de firma o integridad", () => {
    const result = cli(["update", "--help"], { cwd: origin(), env: env() });

    expect(result.stdout).not.toMatch(/--insecure|--sin-verificar|--saltar/);
  });

  it("CA-144: --sin-sbom publica sin SBOM y lo registra", () => {
    const root = origin({ signing: true });

    const result = cli(["release", "0.3.0", "--sin-sbom"], { cwd: root, env: env() });

    expect(result.status).toBe(0);
    const files = git(root, "ls-tree", "-r", "--name-only", "v0.3.0").stdout;
    expect(files).not.toMatch(/release\/sbom\.spdx\.json/);
    const releaseJson = JSON.parse(readFileSync(join(root, "release.json"), "utf8")) as {
      sbom?: string;
    };
    expect(releaseJson.sbom).toBe("omitido");
  });
});
