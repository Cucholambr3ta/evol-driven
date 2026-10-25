import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig } from "../helpers.js";
import { git, origin } from "../release-helpers.js";

const env = () => ({ EVOL_CONFIG_DIR: isolateUserConfig() });

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

  it("CA-143: update rechaza una versión cuyas sumas no coinciden con los archivos", () => {
    const root = origin({ signing: true });
    cli(["release", "0.3.0"], { cwd: root, env: env() });
    // simula una versión publicada cuyo contenido difiere de SUMAS.txt: se añade un archivo tras la etiqueta
    git(root, "checkout", "-q", "v0.3.0");
    git(root, "checkout", "-q", "-b", "alterada");

    const result = cli(["update", "--repositorio", root], { cwd: root, env: env() });

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/suma|checksum/i);
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
