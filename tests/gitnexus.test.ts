import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GitNexusProvider } from "../src/codeintel/gitnexus.js";
import { ProviderUnavailableError } from "../src/codeintel/provider.js";
import { cli, makeProject, REPO, write } from "./helpers.js";

const FAKE = join(REPO, "tests", "fixtures", "fake-gitnexus.mjs");
const withFake = { EVOL_GITNEXUS_CMD: `${process.execPath} ${FAKE}` };
const absent = { EVOL_GITNEXUS_CMD: "evol-test-no-gitnexus" };

function gitnexusProject() {
  const root = makeProject([], { codeIntel: "gitnexus" });
  write(root, "src/b.ts", "export function greet(): string {\n  return 'hi';\n}\n");
  return root;
}

async function withEnv<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const previous = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("con GitNexus ausente (criterio 15)", () => {
  it("evol impact falla con un mensaje claro y NO recurre al indexador propio", () => {
    const root = gitnexusProject();
    for (const command of ["impact", "trace"]) {
      const r = cli([command, "greet"], { cwd: root, env: absent });
      expect(r.status, command).toBe(1);
      expect(r.stderr).toContain("gitnexus");
      expect(r.stderr).toContain("no está disponible");
      expect(r.stderr).toContain("PolyForm Noncommercial");
    }
    expect(existsSync(join(root, ".evol", "codegraph.sqlite"))).toBe(false);
  });

  it("el proveedor lo declara no disponible sin lanzar", async () => {
    const availability = await withEnv(absent, () => new GitNexusProvider().available());
    expect(availability.ok).toBe(false);
    await expect(withEnv(absent, () => new GitNexusProvider().impact("x"))).rejects.toThrow(
      ProviderUnavailableError,
    );
  });

  it("doctor avisa si el proveedor configurado es GitNexus y no está", () => {
    const root = gitnexusProject();
    const r = cli(["doctor"], {
      cwd: root,
      env: { ...absent, EVOL_MEMPALACE_CMD: "evol-test-no-such-command" },
    });
    expect(r.stdout).toContain("✗ GitNexus (proveedor configurado)");
  });
});

describe("con un GitNexus presente (servidor MCP de prueba)", () => {
  it("impact y trace llaman a sus herramientas y devuelven su salida", () => {
    const root = gitnexusProject();
    const impact = cli(["impact", "greet"], { cwd: root, env: withFake });
    expect(impact.status, impact.stderr).toBe(0);
    expect(impact.stdout).toContain("proveedor gitnexus");
    expect(impact.stdout).toContain("blast radius of greet: 3 callers");
    const trace = cli(["trace", "greet"], { cwd: root, env: withFake });
    expect(trace.status, trace.stderr).toBe(0);
    expect(trace.stdout).toContain("context for greet: calls helper()");
    expect(existsSync(join(root, ".evol", "codegraph.sqlite"))).toBe(false);
  });

  it("findSymbol interpreta una respuesta JSON y available() lee la versión", async () => {
    const provider = new GitNexusProvider();
    const found = await withEnv(withFake, async () => ({
      availability: await provider.available(),
      symbols: await provider.findSymbol("greet"),
    }));
    expect(found.availability).toEqual({
      ok: true,
      detail: expect.stringContaining("fake-gitnexus 0.0.0"),
    });
    expect(found.symbols).toEqual([
      { id: "fake#greet", kind: "function", name: "greet", file: "fake.ts", line: 7 },
    ]);
  });

  it("si su MCP no ofrece la herramienta, lo dice", async () => {
    await expect(
      withEnv({ ...withFake, FAKE_GITNEXUS_TOOLS: "query" }, () =>
        new GitNexusProvider().impact("x"),
      ),
    ).rejects.toThrow(/no ofrece la herramienta «impact»/);
  });
});

describe("el paquete no contiene código de GitNexus", () => {
  const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as Record<
    string,
    Record<string, string>
  >;

  it("no lo declara como dependencia de ningún tipo", () => {
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      expect(Object.keys(pkg[field] ?? {}).filter((n) => /gitnexus/i.test(n))).toEqual([]);
    }
  });

  it("el código compilado nunca importa un módulo gitnexus", () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".js")) files.push(full);
      }
    };
    walk(join(REPO, "dist"));
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /(from|import|require\()\s*\(?["']gitnexus/,
      );
    }
  });

  it("lo que se publica solo trae el proveedor propio que habla con él", () => {
    const r = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: REPO,
      encoding: "utf8",
    });
    expect(r.status, r.stderr).toBe(0);
    const [info] = JSON.parse(r.stdout) as { files: { path: string }[] }[];
    const paths = (info?.files ?? []).map((f) => f.path);
    expect(
      paths.filter((p) => /gitnexus/i.test(p) && !p.startsWith("dist/codeintel/gitnexus")),
    ).toEqual([]);
    expect(paths.some((p) => p.startsWith("node_modules/"))).toBe(false);
    expect(paths).toContain("disciplines/TDD.json");
    expect(paths).toContain("templates/project/package.json");
  });

  it("DEPENDENCIES.md declara a GitNexus como opcional y con su licencia", () => {
    const text = readFileSync(join(REPO, "DEPENDENCIES.md"), "utf8");
    expect(text).toMatch(/GitNexus/);
    expect(text).toMatch(/PolyForm Noncommercial/);
    expect(text).toMatch(/opcional/i);
  });
});
