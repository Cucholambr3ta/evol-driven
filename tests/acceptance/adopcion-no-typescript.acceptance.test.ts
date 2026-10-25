import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig, makeProjectAt, tempDir, write } from "../helpers.js";

const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];

const env = () => ({ EVOL_CONFIG_DIR: isolateUserConfig() });

describe("adoptar un proyecto que no es TypeScript", () => {
  it("CA-128: evol init detecta un pyproject.toml y remapea TDD a pytest", () => {
    const root = tempDir("evol-python-");
    write(root, "pyproject.toml", "[project]\nname = 'demo'\n");
    write(root, "tests/unit/test_algo.py", "def test_algo():\n    assert True\n");

    const result = cli(["init", "--perfil", "base", "--name", "demo-python"], {
      cwd: root,
      env: env(),
    });

    expect(result.status).toBe(0);
    const config = JSON.parse(readFileSync(join(root, "evol.config.json"), "utf8")) as {
      modules: { comandos?: Record<string, string>; rutas?: Record<string, string> }[];
    };
    const app = config.modules[0]!;
    expect(app.comandos?.["TDD"]).toMatch(/pytest/);
    expect(Object.values(app.rutas ?? {})).toEqual(
      expect.arrayContaining([expect.stringContaining("test_*.py")]),
    );
  });

  it("CA-128: --lenguaje manda sobre la detección automática", () => {
    const root = tempDir("evol-mixto-");
    write(root, "pyproject.toml", "[project]\nname = 'demo'\n");
    write(root, "deploy.sh", "#!/bin/sh\necho hola\n");

    const result = cli(
      ["init", "--perfil", "base", "--name", "demo-shell", "--lenguaje", "shell"],
      {
        cwd: root,
        env: env(),
      },
    );

    expect(result.status).toBe(0);
    const config = JSON.parse(readFileSync(join(root, "evol.config.json"), "utf8")) as {
      modules: { comandos?: Record<string, string> }[];
    };
    expect(config.modules[0]!.comandos?.["TDD"]).toMatch(/bats/);
  });

  it("CA-129: en un proyecto Python, verify (en build) ejecuta el comando de pruebas y bloquea si falla", () => {
    // sin exigir pytest instalado en la máquina que corre esta prueba: un script de Python plano,
    // que ejecuta su propia prueba y se identifica al fallar, demuestra el mismo mecanismo (el
    // comando configurado corre de verdad y su fallo bloquea, nombrando lo que falló). Que el
    // comando por defecto de un proyecto Python real es «python -m pytest tests/unit» ya lo
    // confirma, como cadena, CA-128.
    const root = makeProjectAt("build", DISC, {
      modules: [
        {
          name: "app",
          root: ".",
          disciplinas: DISC,
          comandos: { TDD: "python3 tests/unit/test_ca_200.py" },
          rutas: { "tests/unit/*.test.ts": "tests/unit/test_*.py" },
        },
      ],
    });
    write(
      root,
      "tests/unit/test_ca_200.py",
      [
        "def test_ca_200_falla_a_proposito():",
        "    assert False",
        "",
        'if __name__ == "__main__":',
        "    import sys",
        "    try:",
        "        test_ca_200_falla_a_proposito()",
        "    except AssertionError:",
        '        print("FAILED: test_ca_200_falla_a_proposito")',
        "        sys.exit(1)",
        "",
      ].join("\n"),
    );

    const result = cli(["verify", "--json"], { cwd: root, env: env() });

    const report = JSON.parse(result.stdout) as {
      veredicto: string;
      problemas: { disciplina: string; mensaje: string }[];
    };
    expect(report.veredicto).toBe("BLOCK");
    const tdd = report.problemas.find((p) => p.disciplina === "TDD");
    expect(tdd?.mensaje).toMatch(/test_ca_200/);
  });

  it("CA-130: la cobertura reconoce un criterio citado en el nombre de una prueba de pytest", () => {
    const root = tempDir("evol-python-coverage-");
    write(root, "pyproject.toml", "[project]\nname = 'demo'\n");
    write(root, "docs/specs/SPEC.md", "## Criterios de aceptación\n\n1. **CA-200**: algo\n");
    write(
      root,
      "tests/unit/test_rechaza_vacio.py",
      "def test_ca_200_rechaza_un_pedido_vacio():\n    assert True\n",
    );
    cli(["init", "--perfil", "base", "--name", "demo-python", "--lenguaje", "python"], {
      cwd: root,
      env: env(),
    });

    const result = cli(["coverage", "--json"], { cwd: root, env: env() });

    const report = JSON.parse(result.stdout) as { criterios: { id: string; pruebas: unknown[] }[] };
    const ca200 = report.criterios.find((c) => c.id === "CA-200");
    expect(ca200?.pruebas.length).toBeGreaterThan(0);
  });

  it("CA-130: la cobertura reconoce un criterio citado en un @test de bats", () => {
    const root = tempDir("evol-shell-coverage-");
    write(root, "deploy.sh", "#!/bin/sh\necho hola\n");
    write(root, "docs/specs/SPEC.md", "## Criterios de aceptación\n\n1. **CA-201**: algo\n");
    write(
      root,
      "tests/unit/rechaza.bats",
      '@test "CA-201: rechaza un pedido vacío" {\n  true\n}\n',
    );
    cli(["init", "--perfil", "base", "--name", "demo-shell", "--lenguaje", "shell"], {
      cwd: root,
      env: env(),
    });

    const result = cli(["coverage", "--json"], { cwd: root, env: env() });

    const report = JSON.parse(result.stdout) as { criterios: { id: string; pruebas: unknown[] }[] };
    const ca201 = report.criterios.find((c) => c.id === "CA-201");
    expect(ca201?.pruebas.length).toBeGreaterThan(0);
  });

  it("CA-131: el perfil script solo activa BDD en el briefing", () => {
    const root = tempDir("evol-script-");
    write(root, "instala.sh", "#!/bin/sh\necho hola\n");

    cli(["init", "--perfil", "script", "--name", "demo-script"], { cwd: root, env: env() });
    const result = cli(["disciplines", "active", "--json"], { cwd: root, env: env() });

    const active = JSON.parse(result.stdout) as { disciplinas: { id: string }[] };
    const ids = active.disciplinas.map((d) => d.id);
    expect(ids).toEqual(["BDD"]);
  });
});
