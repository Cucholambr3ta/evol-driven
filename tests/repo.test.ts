import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { packageVersion } from "../src/core/paths.js";
import { REPO } from "./helpers.js";

const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as {
  version: string;
  scripts: Record<string, string>;
};

function walk(dir: string, skip: Set<string>): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, skip));
    else out.push(full);
  }
  return out;
}

describe("una sola fuente de versión (criterio 16)", () => {
  it("packageVersion() lee package.json", () => {
    expect(packageVersion()).toBe(pkg.version);
  });

  it("el número de versión no está escrito en ningún otro archivo del repositorio", () => {
    const skip = new Set([
      "node_modules",
      "dist",
      ".git",
      "tests",
      "templates",
      "package-lock.json",
      "coverage",
    ]);
    const holders = walk(REPO, skip)
      .filter((f) => readFileSync(f, "utf8").includes(pkg.version))
      .map((f) => relative(REPO, f))
      .filter((f) => f !== "package.json");
    expect(holders).toEqual([]);
  });
});

describe("el CI no enmascara fallos (criterio 17)", () => {
  const ci = readFileSync(join(REPO, ".github", "workflows", "ci.yml"), "utf8");

  it("no usa || true, continue-on-error ni set +e", () => {
    expect(ci).not.toMatch(/\|\|\s*true/);
    expect(ci).not.toMatch(/continue-on-error/);
    expect(ci).not.toMatch(/set \+e/);
  });

  it("ejecuta lint, tipos, formato, build y pruebas", () => {
    expect(ci).toMatch(/npm run ci|npm test/);
    expect(pkg.scripts["ci"]).toContain("npm run lint");
    expect(pkg.scripts["ci"]).toContain("npm run typecheck");
    expect(pkg.scripts["ci"]).toContain("npm run build");
    expect(pkg.scripts["ci"]).toContain("npm test");
    expect(pkg.scripts["ci"]).not.toMatch(/\|\|/);
  });

  it("ningún script de package.json enmascara un fallo", () => {
    for (const [name, command] of Object.entries(pkg.scripts)) {
      expect(command, name).not.toMatch(/\|\|\s*(true|:|exit 0)/);
    }
  });

  it("no hay pruebas de relleno: ninguna prueba está saltada o es .todo en el repositorio", () => {
    const own = walk(join(REPO, "tests"), new Set(["fixtures"])).filter((f) =>
      f.endsWith(".test.ts"),
    );
    for (const file of own) {
      const text = readFileSync(file, "utf8");
      expect(text, relative(REPO, file)).not.toMatch(/\b(it|test|describe)\.(todo|skip|only)\(/);
      expect(text, relative(REPO, file)).not.toMatch(/expect\(true\)\.toBe\(true\)/);
    }
  });
});

describe("imagen Docker (criterio 18)", () => {
  it("el Dockerfile existe y construye desde cero ejecutando el CI dentro", () => {
    const dockerfile = readFileSync(join(REPO, "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/npm ci/);
    expect(dockerfile).toMatch(/npm run ci|npm test/);
    expect(existsSync(join(REPO, ".dockerignore"))).toBe(true);
  });

  it.skipIf(process.env["EVOL_TEST_DOCKER"] !== "1")(
    "docker build y evol funciona dentro",
    () => {
      const build = spawnSync("docker", ["build", "-q", "-t", "evol-driven:test", REPO], {
        encoding: "utf8",
        timeout: 900_000,
      });
      expect(build.status, build.stderr).toBe(0);
      const version = spawnSync("docker", ["run", "--rm", "evol-driven:test", "--version"], {
        encoding: "utf8",
      });
      expect(version.stdout.trim()).toBe(pkg.version);
    },
    900_000,
  );
});
