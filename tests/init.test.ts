import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { detectLayout } from "../src/core/adopt.js";
import { loadConfig } from "../src/core/config.js";
import { loadDisciplines } from "../src/core/disciplines.js";
import { loadContext, verifyPhase } from "../src/core/pipeline.js";
import { loadState } from "../src/core/state.js";
import type { CommandRunner } from "../src/core/verify.js";
import { sanitizeName } from "../src/commands/init.js";
import {
  CLI,
  cli,
  isolateUserConfig,
  legacyProject,
  makeProject,
  tempDir,
  write,
} from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });
const init = (root: string, ...args: string[]) =>
  cli(["init", root, "--no-memory", ...args], { cwd: root, env: env() });

function hashes(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      if (entry === ".git" || entry === "node_modules") continue;
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out[relative(dir, full)] = createHash("sha256").update(readFileSync(full)).digest("hex");
    }
  };
  walk(dir);
  return out;
}

describe("evol init sobre un proyecto existente (criterio 19)", () => {
  it("no modifica ningún archivo existente; solo añade los suyos", () => {
    const root = legacyProject();
    const before = hashes(root);
    const r = init(root);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const after = hashes(root);

    // Los archivos del proyecto que evol solo extiende con entradas propias:
    const extended = new Set([".gitignore", "CLAUDE.md", ".claude/settings.json"]);
    for (const [file, hash] of Object.entries(before)) {
      if (extended.has(file)) continue;
      expect(after[file], `${file} no debe cambiar`).toBe(hash);
    }
    expect(Object.keys(after)).toEqual(
      expect.arrayContaining(["evol.config.json", ".evol/state.json"]),
    );
  });

  it("conserva lo que ya había en los archivos que extiende", () => {
    const root = legacyProject();
    init(root);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toContain("No usar any.");
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toContain("node_modules");
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toContain(".evol/codegraph.sqlite*");
    const settings = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8")) as {
      permissions: { allow: string[] };
      hooks: { SessionStart: { hooks: { command: string }[] }[] };
    };
    expect(settings.permissions.allow).toEqual(["Bash(npm test)"]);
    const commands = settings.hooks.SessionStart.flatMap((e) => e.hooks.map((h) => h.command));
    expect(commands).toEqual(["echo hola", "evol hook session-start"]);
  });

  it("deriva el nombre del package.json sin el scope", () => {
    const root = legacyProject();
    init(root);
    expect(loadConfig(root).name).toBe("erp-ventas");
    expect(loadConfig(root).memory.wing).toBe("erp_ventas");
  });

  it("funciona en un proyecto que no es de Node (lo reconoce como Python, criterio 128)", () => {
    const root = tempDir("evol-nonode-");
    write(root, "main.py", "print('hola')\n");
    const r = init(root, "--name", "python-app");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("Lenguaje detectado: python");
  });

  it("detecta documentos en otra ruta y comando de pruebas distinto (criterio 20)", () => {
    const root = legacyProject();
    init(root);
    const module = loadConfig(root).modules[0];
    expect(module?.rutas).toEqual({
      "docs/specs/SPEC.md": "SPEC.md",
      "docs/features/FEATURES.md": "FEATURES.md",
      "docs/specs/DOMAIN.md": "DOMAIN.md",
    });
    expect(module?.comandos).toEqual({ ATDD: "npm test", TDD: "npm test", STDD: "npm test" });
  });

  it("la verificación usa las rutas y comandos reasignados", async () => {
    const root = legacyProject();
    init(root);
    const asked: string[] = [];
    const run: CommandRunner = (command) => {
      asked.push(command);
      return { ok: true, output: "" };
    };
    // Briefing: FEATURES.md (en la raíz) ya cuenta; faltan los .feature y las pruebas de aceptación.
    let problems = (await verifyPhase(loadContext(root, { run }), "briefing")).map(
      (f) => f.mensaje,
    );
    expect(problems.some((m) => m.includes("FEATURES.md"))).toBe(false);
    expect(problems.some((m) => m.includes("tests/features/*.feature"))).toBe(true);

    write(
      root,
      "tests/features/v.feature",
      "Feature: ventas\n  Scenario: total\n    Given dos números\n",
    );
    write(root, "tests/acceptance/v.acceptance.test.ts", "export {};\n");
    problems = (await verifyPhase(loadContext(root, { run }), "briefing")).map((f) => f.mensaje);
    expect(problems).toEqual([]);

    // QA ejecuta las pruebas de aceptación con «npm test», no con vitest.
    await verifyPhase(loadContext(root, { run }), "qa");
    expect(asked).toContain("npm test");
    expect(asked.some((c) => c.includes("vitest"))).toBe(false);
  });

  it("sin package.json ni Vitest avisa y no inventa comandos", () => {
    const registry = loadDisciplines();
    const noPkg = tempDir();
    expect(detectLayout(noPkg, ["TDD"], registry).comandos).toEqual({});
    const vitest = tempDir();
    write(vitest, "package.json", '{ "devDependencies": { "vitest": "^5" } }');
    expect(detectLayout(vitest, ["TDD"], registry).comandos).toEqual({});
    const placeholder = tempDir();
    write(
      placeholder,
      "package.json",
      '{ "scripts": { "test": "echo \\"Error: no test specified\\" && exit 1" } }',
    );
    expect(detectLayout(placeholder, ["TDD"], registry).comandos).toEqual({});
  });

  it("respeta las rutas estándar cuando ya existen", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "# s\n");
    write(root, "SPEC.md", "# otra\n");
    expect(detectLayout(root, ["SDD"], loadDisciplines()).rutas).toEqual({});
  });
});

describe("lenguaje del proyecto (criterio 128)", () => {
  const registry = loadDisciplines();

  it("un pyproject.toml remapea TDD a pytest", () => {
    const root = tempDir();
    write(root, "pyproject.toml", "[project]\nname = 'demo'\n");
    const d = detectLayout(root, ["TDD"], registry);
    expect(d.rutas).toEqual({ "tests/unit/*.test.ts": "tests/unit/test_*.py" });
    expect(d.comandos).toEqual({ TDD: "python -m pytest tests/unit" });
  });

  it("un .sh en la raíz remapea TDD a bats", () => {
    const root = tempDir();
    write(root, "deploy.sh", "#!/bin/sh\n");
    const d = detectLayout(root, ["TDD"], registry);
    expect(d.rutas).toEqual({ "tests/unit/*.test.ts": "tests/unit/*.bats" });
    expect(d.comandos).toEqual({ TDD: "bats tests/unit" });
  });

  it("--lenguaje manda sobre la detección automática", () => {
    const root = tempDir();
    write(root, "pyproject.toml", "[project]\nname = 'demo'\n");
    write(root, "deploy.sh", "#!/bin/sh\n");
    const d = detectLayout(root, ["TDD"], registry, { lenguaje: "shell" });
    expect(d.comandos).toEqual({ TDD: "bats tests/unit" });
  });

  it("sin TDD activo, un proyecto Python no remapea nada", () => {
    const root = tempDir();
    write(root, "pyproject.toml", "[project]\nname = 'demo'\n");
    const d = detectLayout(root, ["SDD"], registry);
    expect(d.comandos).toEqual({});
  });

  it("nada reconocido avisa de que no se detectó lenguaje, sin inventar nada", () => {
    const root = tempDir();
    write(root, "README.md", "# demo\n");
    const d = detectLayout(root, ["TDD"], registry);
    expect(d.comandos).toEqual({});
    expect(d.notes.some((n) => /no se detectó un lenguaje/.test(n))).toBe(true);
  });
});

describe("proyectos que usan Prettier", () => {
  it("evol.config.json y .evol quedan fuera de su comprobación de formato", () => {
    const root = tempDir();
    write(root, "package.json", '{ "name": "p", "devDependencies": { "prettier": "^3" } }');
    write(root, ".prettierignore", "dist");
    const r = init(root);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("Prettier detectado");
    expect(readFileSync(join(root, ".prettierignore"), "utf8")).toBe(
      "dist\n\n# evol\nevol.config.json\n.evol\n",
    );
  });

  it("no toca nada si el proyecto no usa Prettier, y no se repite", () => {
    const root = legacyProject();
    init(root);
    expect(existsSync(join(root, ".prettierignore"))).toBe(false);
  });
});

describe("módulos propios", () => {
  it("--modulo define raíces y disciplinas por módulo", () => {
    const root = tempDir("evol-erp-");
    write(root, "modules/ventas/package.json", '{ "name": "ventas" }');
    write(root, "modules/stock/package.json", '{ "name": "stock" }');
    const r = init(
      root,
      "--name",
      "erp",
      "--modulo",
      "ventas=modules/ventas:SDD,TDD",
      "--modulo",
      "stock=modules/stock:SDD,MDD",
    );
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const modules = loadConfig(root, loadDisciplines()).modules;
    expect(modules.map((m) => [m.name, m.root, m.disciplinas])).toEqual([
      ["ventas", "modules/ventas", ["SDD", "TDD"]],
      ["stock", "modules/stock", ["SDD", "MDD"]],
    ]);
  });

  it("--disciplinas cambia el conjunto para todos los módulos", () => {
    const root = tempDir();
    write(root, "a.txt", "x");
    expect(init(root, "--name", "solo", "--disciplinas", "SDD,FDD").status).toBe(0);
    expect(loadConfig(root).modules[0]?.disciplinas).toEqual(["SDD", "FDD"]);
  });
});

describe("rutas y comandos inválidos en la configuración", () => {
  const registry = loadDisciplines();
  const withModule = (extra: Record<string, unknown>) => {
    const root = makeProject(["SDD", "TDD"]);
    write(
      root,
      "evol.config.json",
      JSON.stringify({
        name: "demo",
        version: 1,
        memory: { wing: "demo", enabled: false },
        modules: [{ name: "app", root: ".", disciplinas: ["SDD", "TDD"], ...extra }],
      }),
    );
    return root;
  };

  it("rechaza una ruta que no es de ninguna disciplina del módulo", () => {
    expect(() => loadConfig(withModule({ rutas: { "docs/otra.md": "X.md" } }), registry)).toThrow(
      /no es un artefacto/,
    );
  });

  it("rechaza una ruta que sale del módulo", () => {
    expect(() =>
      loadConfig(withModule({ rutas: { "docs/specs/SPEC.md": "../afuera.md" } }), registry),
    ).toThrow(/dentro del módulo/);
    expect(() =>
      loadConfig(withModule({ rutas: { "docs/specs/SPEC.md": "/etc/passwd" } }), registry),
    ).toThrow(/dentro del módulo/);
  });

  it("rechaza un comando para una disciplina que no corre comandos o no está en el módulo", () => {
    expect(() => loadConfig(withModule({ comandos: { SDD: "npm test" } }), registry)).toThrow(
      /no ejecuta ningún comando/,
    );
    expect(() => loadConfig(withModule({ comandos: { BDD: "npm test" } }), registry)).toThrow(
      /no es una disciplina de este módulo/,
    );
  });

  it("acepta rutas y comandos válidos", () => {
    const root = withModule({
      rutas: { "docs/specs/SPEC.md": "SPEC.md" },
      comandos: { TDD: "npm test" },
    });
    expect(() => loadConfig(root, registry)).not.toThrow();
  });
});

describe("evol init falla sin dejar nada escrito", () => {
  const nothingWritten = (root: string): void => {
    expect(existsSync(join(root, "evol.config.json"))).toBe(false);
    expect(existsSync(join(root, ".evol"))).toBe(false);
  };

  it.each([
    ["una disciplina inexistente", ["--disciplinas", "NOEXISTE"], /disciplina desconocida/],
    ["un --modulo mal formado", ["--modulo", "sinruta"], /Formato: nombre=ruta/],
    ["la carpeta de un módulo inexistente", ["--modulo", "m=no/existe"], /no existe/],
    ["una fase inválida", ["--fase", "inventada"], /--fase debe ser/],
    ["un nombre que no se puede derivar", ["--name", "!!!"], /nombre válido/],
  ])("con %s", (_label, args, message) => {
    const root = legacyProject();
    const r = init(root, ...args);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(message);
    nothingWritten(root);
  });

  it("no inicializa dos veces ni dentro de otro proyecto evol", () => {
    const root = legacyProject();
    expect(init(root).status).toBe(0);
    const again = init(root);
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("ya es un proyecto evol");

    write(root, "sub/x.txt", "x");
    const nested = init(join(root, "sub"));
    expect(nested.status).toBe(1);
    expect(nested.stderr).toContain("está dentro del proyecto evol");
  });

  it("no existe la carpeta indicada", () => {
    const r = cli(["init", join(tempDir(), "no-existe"), "--no-memory"], {
      cwd: tempDir(),
      env: env(),
    });
    expect(r.status).toBe(1);
  });
});

describe("adoptar en una fase avanzada exige a una persona (criterio 21)", () => {
  it("sin terminal interactiva falla y no crea nada", () => {
    const root = legacyProject();
    const r = init(root, "--fase", "build");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("terminal interactiva");
    expect(existsSync(join(root, "evol.config.json"))).toBe(false);
    expect(existsSync(join(root, ".evol"))).toBe(false);
  });

  const hasScript = spawnSync("script", ["--version"], { encoding: "utf8" }).status === 0;

  function inTerminal(root: string, input: string) {
    const command = `${process.execPath} --disable-warning=ExperimentalWarning ${CLI} init ${root} --no-memory --fase build`;
    return spawnSync("script", ["-qec", command, "/dev/null"], {
      cwd: root,
      input,
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, ...env() },
    });
  }

  it.skipIf(!hasScript)("escribiendo la fase, adopta y marca las anteriores como adoptadas", () => {
    const root = legacyProject();
    const r = inTerminal(root, "build\n");
    expect(r.stdout).toContain("adoptado");
    const state = loadState(root);
    expect(state.currentPhase).toBe("build");
    expect(state.completed.map((c) => [c.phase, c.adopted])).toEqual([
      ["briefing", true],
      ["spec", true],
      ["plan", true],
    ]);
    const status = cli(["status"], { cwd: root, env: env() });
    expect(status.stdout).toContain("~briefing");
    expect(status.stdout).toContain("fase adoptada");
    expect(existsSync(join(root, ".evol", "gate-log.jsonl"))).toBe(false);
  });

  it.skipIf(!hasScript)("escribir otra cosa cancela sin crear nada", () => {
    const root = legacyProject();
    const r = inTerminal(root, "nada\n");
    expect(r.stdout + r.stderr).toContain("Cancelado");
    expect(existsSync(join(root, "evol.config.json"))).toBe(false);
  });
});

describe("nombres", () => {
  it.each([
    ["@acme/erp-ventas", "erp-ventas"],
    ["Mi App Genial", "mi-app-genial"],
    ["tienda_online", "tienda-online"],
    ["--x--", "x"],
  ])("%s → %s", (raw, expected) => {
    expect(sanitizeName(raw)).toBe(expected);
  });

  it("rechaza lo que no empieza con letra", () => {
    expect(() => sanitizeName("123")).toThrow();
    expect(() => sanitizeName("@@@")).toThrow();
  });
});
