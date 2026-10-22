import { beforeAll, describe, expect, it } from "vitest";
import {
  coverageReport,
  parseCriteria,
  parseScenarios,
  parseTestTitles,
} from "../src/core/coverage.js";
import { buildExport, ExportSchema, EXPORT_SCHEMA } from "../src/core/export.js";
import { loadContext, verifyPhase } from "../src/core/pipeline.js";
import { riskReport } from "../src/core/risk.js";
import { baseConfig, cli, copyFixture, isolateUserConfig, makeProject, write } from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

const SPEC = `# Spec

## Criterios de aceptación

- CA-1: el usuario inicia sesión
- **CA-2** El usuario cierra sesión
| CA-3 | Se registra el acceso |
`;

const FEATURE = `@CA-1
Feature: Sesión

  @CA-1 @CA-2
  Scenario: entra y sale
    Given algo

  Scenario: sin etiqueta
    Given otra cosa
`;

function projectWithCriteria(overrides = {}): string {
  const root = makeProject(["SDD", "BDD"], overrides);
  write(root, "docs/specs/SPEC.md", SPEC);
  write(root, "tests/features/sesion.feature", FEATURE);
  write(
    root,
    "tests/unit/sesion.test.ts",
    `import { it } from "vitest";\nit("CA-2: cierra la sesión", () => {});\n`,
  );
  return root;
}

describe("lectura de criterios, escenarios y pruebas", () => {
  it("reconoce CA-n en listas, negritas y tablas", () => {
    expect(parseCriteria(SPEC)).toEqual([
      { id: "CA-1", texto: "el usuario inicia sesión" },
      { id: "CA-2", texto: "El usuario cierra sesión" },
      { id: "CA-3", texto: "Se registra el acceso" },
    ]);
  });

  it("las etiquetas de la Feature se heredan y las del escenario no pasan al siguiente", () => {
    expect(parseScenarios(FEATURE)).toEqual([
      { nombre: "entra y sale", criterios: ["CA-1", "CA-2"] },
      { nombre: "sin etiqueta", criterios: ["CA-1"] },
    ]);
  });

  it("encuentra los títulos de prueba que nombran un criterio", () => {
    const source = `describe("CA-1 y CA-3", () => { it("otra", () => {}); test.concurrent("CA-2", () => {}); });`;
    expect(parseTestTitles(source)).toEqual([
      { nombre: "CA-1 y CA-3", criterios: ["CA-1", "CA-3"] },
      { nombre: "CA-2", criterios: ["CA-2"] },
    ]);
  });
});

describe("evol coverage (criterio 33)", () => {
  it("detecta un criterio sin escenario y otro sin prueba", () => {
    const report = coverageReport(loadContext(projectWithCriteria()));
    expect(report.criterios.map((c) => c.id)).toEqual(["CA-1", "CA-2", "CA-3"]);
    expect(report.sinEscenario).toEqual(["app/CA-3"]);
    expect(report.sinPrueba).toEqual(["app/CA-1", "app/CA-3"]);
    expect(report.criterios[1]?.pruebas).toEqual([
      { archivo: "tests/unit/sesion.test.ts", nombre: "CA-2: cierra la sesión" },
    ]);
  });

  it("avisa de referencias a criterios que el SPEC no define", () => {
    const root = projectWithCriteria();
    write(root, "tests/unit/otra.test.ts", `it("CA-9", () => {});\n`);
    expect(coverageReport(loadContext(root)).huerfanos).toEqual(["CA-9"]);
  });

  it("en QA solo exige cobertura total si qa.requireCriteriaCoverage está activo", async () => {
    const lax = loadContext(projectWithCriteria());
    const laxFindings = await verifyPhase(lax, "qa");
    expect(laxFindings.some((f) => f.disciplina === "COVERAGE")).toBe(false);

    const strict = loadContext(
      projectWithCriteria({
        qa: { requireTestsForChangedSymbols: false, requireCriteriaCoverage: true },
      }),
    );
    const messages = (await verifyPhase(strict, "qa"))
      .filter((f) => f.disciplina === "COVERAGE")
      .map((f) => f.mensaje);
    expect(messages).toEqual([
      "el criterio app/CA-3 no tiene ningún escenario (@CA-n)",
      "el criterio app/CA-1 no tiene ninguna prueba que lo nombre",
      "el criterio app/CA-3 no tiene ninguna prueba que lo nombre",
    ]);
  });

  it("--estricto sale con 1 si hay huecos y --json imprime el informe", () => {
    const root = projectWithCriteria();
    const env = { EVOL_CONFIG_DIR: userConfig };
    const strict = cli(["coverage", "--json", "--estricto"], { cwd: root, env });
    expect(strict.status).toBe(1);
    expect(JSON.parse(strict.stdout).sinEscenario).toEqual(["app/CA-3"]);
    expect(cli(["coverage"], { cwd: root, env }).status).toBe(0);
  });
});

describe("evol risk (criterio 32)", () => {
  const root = copyFixture("sample");
  const entries = riskReport(root, baseConfig([]));

  it("ordena por alcance × falta de pruebas", () => {
    expect(entries.map((e) => [e.archivo, e.alcance, e.riesgo])).toEqual([
      ["src/b.ts", 2, 2],
      ["src/a.ts", 1, 1],
      ["src/c.ts", 0, 0],
    ]);
  });

  it("no cuenta los tests como dependientes ni como código", () => {
    expect(entries.some((e) => e.archivo.startsWith("tests/"))).toBe(false);
  });

  it("falla con un mensaje claro si el proveedor no es el nativo", () => {
    expect(() => riskReport(root, baseConfig([], { codeIntel: "gitnexus" }))).toThrow(
      /solo está disponible con el indexador nativo/,
    );
  });

  it("--json lo imprime desde la CLI y --top limita", () => {
    const project = makeProject(["SDD"]);
    write(project, "src/x.ts", "export function x(): number {\n  return 1;\n}\n");
    write(
      project,
      "src/y.ts",
      'import { x } from "./x.js";\nexport const y = (): number => x();\n',
    );
    const r = cli(["risk", "--json", "--top", "1"], {
      cwd: project,
      env: { EVOL_CONFIG_DIR: userConfig },
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toHaveLength(1);
  });
});

describe("evol export (criterio 36)", () => {
  it("cumple el esquema versionado y es determinista", () => {
    const ctx = loadContext(projectWithCriteria());
    const data = buildExport(ctx);
    expect(ExportSchema.parse(data).schema).toBe(EXPORT_SCHEMA);
    expect(buildExport(ctx)).toEqual(data);
    expect(data.cobertura.criterios).toHaveLength(3);
    expect(data.aprobaciones.integra).toBe(true);
  });

  it("no incluye claves, firmas ni nonces", () => {
    const text = JSON.stringify(buildExport(loadContext(projectWithCriteria())));
    expect(text).not.toMatch(/signature|nonce|previous_hash/);
  });

  it("indica que el riesgo no está disponible en vez de fallar", () => {
    const ctx = loadContext(projectWithCriteria({ codeIntel: "gitnexus" }));
    const { riesgo } = buildExport(ctx);
    expect(riesgo.disponible).toBe(false);
    expect(riesgo.motivo).toMatch(/indexador nativo/);
  });

  it("--json lo imprime desde la CLI", () => {
    const root = projectWithCriteria();
    const r = cli(["export", "--json"], { cwd: root, env: { EVOL_CONFIG_DIR: userConfig } });
    expect(r.status).toBe(0);
    expect(ExportSchema.safeParse(JSON.parse(r.stdout)).success).toBe(true);
  });
});
