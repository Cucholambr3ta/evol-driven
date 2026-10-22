import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appliesIn, DisciplineSchema, loadDisciplines } from "../src/core/disciplines.js";
import type { Discipline } from "../src/core/disciplines.js";
import type { Phase } from "../src/core/phases.js";
import { validateFormat, verifyDiscipline } from "../src/core/verify.js";
import type { CommandRunner } from "../src/core/verify.js";
import { REPO, tempDir, write, writeValidArtifacts } from "./helpers.js";

const registry = loadDisciplines();
const ok: CommandRunner = () => ({ ok: true, output: "" });
const fail: CommandRunner = () => ({ ok: false, output: "boom" });

function verify(d: Discipline, root: string, phase: Phase, run: CommandRunner = ok) {
  return verifyDiscipline(d, { moduleName: "app", moduleRoot: root, phase, run });
}

describe("registro de disciplinas (criterio 6)", () => {
  it("carga las 31 definiciones: 9 base y 22 extendidas", () => {
    const all = registry.all();
    expect(all).toHaveLength(31);
    expect(all.filter((d) => d.tipo === "base")).toHaveLength(9);
    expect(all.filter((d) => d.tipo === "extendida")).toHaveLength(22);
  });

  it("hay un archivo por disciplina y el id coincide con su nombre", () => {
    const files = readdirSync(join(REPO, "disciplines")).filter((f) => f.endsWith(".json"));
    expect(files.map((f) => f.replace(".json", "")).sort()).toEqual(
      registry
        .all()
        .map((d) => d.id)
        .sort(),
    );
  });

  it.each(registry.all().map((d) => [d.id, d] as const))(
    "%s declara fase, artefactos y valida contra el esquema",
    (_id, d) => {
      expect(DisciplineSchema.safeParse(d).success).toBe(true);
      expect(d.fases.length).toBeGreaterThan(0);
      expect(d.artefactos.length).toBeGreaterThan(0);
      expect(d.artefactos.some((a) => a.min >= 1)).toBe(true);
    },
  );

  it("rechaza una definición con una fase inexistente", () => {
    const bad = { ...registry.get("TDD"), fases: ["desarrollo"] };
    expect(DisciplineSchema.safeParse(bad).success).toBe(false);
  });
});

describe("cada disciplina se puede satisfacer y se puede incumplir", () => {
  it.each(registry.all().map((d) => [d.id, d] as const))(
    "%s: pasa con artefactos válidos y falla sin ellos",
    (_id, d) => {
      for (const phase of d.fases) {
        const valid = tempDir();
        writeValidArtifacts(valid, d.id);
        expect(verify(d, valid, phase), `${d.id} en ${phase}`).toEqual([]);
        expect(verify(d, tempDir(), phase).length, `${d.id} vacío en ${phase}`).toBeGreaterThan(0);
      }
    },
  );

  it("una disciplina no verifica en fases donde no aplica", () => {
    const tdd = registry.get("TDD") as Discipline;
    expect(appliesIn(tdd, "build")).toBe(true);
    expect(verify(tdd, tempDir(), "qa")).toEqual([]);
  });

  it("SDD es transversal: aplica desde spec en adelante", () => {
    const sdd = registry.get("SDD") as Discipline;
    expect(appliesIn(sdd, "briefing")).toBe(false);
    for (const phase of ["spec", "plan", "build", "qa", "retro"] as const)
      expect(appliesIn(sdd, phase)).toBe(true);
  });
});

describe("tipos de verificación (criterio 7): cada uno falla con un artefacto inválido", () => {
  const sdd = registry.get("SDD") as Discipline;

  it("existe: falta el artefacto", () => {
    expect(verify(sdd, tempDir(), "spec")[0]?.mensaje).toContain("falta el artefacto");
  });

  it("no vacío", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "  \n");
    expect(
      verify(sdd, root, "spec")
        .map((f) => f.mensaje)
        .join(),
    ).toContain("está vacío");
  });

  it("marcador [[COMPLETAR]] sin resolver", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "## Criterios de aceptación\n[[COMPLETAR]]\n");
    expect(
      verify(sdd, root, "spec")
        .map((f) => f.mensaje)
        .join(),
    ).toContain("[[COMPLETAR]]");
  });

  it("contiene: SPEC sin criterios de aceptación", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "# Solo un título\n");
    expect(verify(sdd, root, "spec").map((f) => f.mensaje)).toContain(
      "SPEC.md debe incluir criterios de aceptación",
    );
  });

  it("JSON inválido", () => {
    expect(validateFormat("json", "{no es json")).toContain("no es JSON válido");
    expect(validateFormat("avsc", "[")).toContain("no es JSON válido");
    expect(validateFormat("json", '{"a":1}')).toBeNull();
  });

  it("YAML inválido", () => {
    expect(validateFormat("yaml", "a: [1, 2\nb: : :")).toContain("no es YAML válido");
    expect(validateFormat("yaml", "a: 1\nb: [1, 2]\n")).toBeNull();
  });

  it("feature: sin «Feature:» y sin escenarios", () => {
    expect(validateFormat("feature", "Scenario: huérfano")).toContain("Feature");
    const bdd = registry.get("BDD") as Discipline;
    const root = tempDir();
    write(root, "tests/features/a.feature", "Feature: sin escenarios\n  texto\n");
    expect(
      verify(bdd, root, "briefing")
        .map((f) => f.mensaje)
        .join(),
    ).toContain("no tiene ningún escenario");
    write(
      root,
      "tests/features/a.feature",
      "Feature: con escenario\n  Scenario: uno\n    Given algo\n",
    );
    expect(verify(bdd, root, "briefing")).toEqual([]);
  });

  it("feature en español", () => {
    expect(
      validateFormat("feature", "# language: es\nCaracterística: x\n  Escenario: y\n"),
    ).toBeNull();
  });

  it("puml sin @startuml", () => {
    expect(validateFormat("puml", "A -> B")).toContain("@startuml");
  });

  it("par up/down de migraciones", () => {
    const mdd = registry.get("MDD") as Discipline;
    const root = tempDir();
    write(root, "migrations/001/up.sql", "create table a(x int);");
    expect(verify(mdd, root, "plan").map((f) => f.mensaje)).toContain(
      "la migración «migrations/001» no tiene down.sql",
    );
    write(root, "migrations/001/down.sql", "drop table a;");
    expect(verify(mdd, root, "plan")).toEqual([]);
  });

  it("sin hallazgos críticos abiertos", () => {
    const sec = registry.get("SecDD") as Discipline;
    const root = tempDir();
    write(root, ".evol/qa/QA_REPORT.md", "# QA\n\n- [ ] CRITICAL: inyección SQL\n");
    expect(
      verify(sec, root, "qa")
        .map((f) => f.mensaje)
        .join(),
    ).toContain("hallazgos críticos abiertos");
    write(
      root,
      ".evol/qa/QA_REPORT.md",
      "# QA\n\n- [x] CRITICAL: inyección SQL\n- [ ] MEDIUM: algo menor\n",
    );
    expect(verify(sec, root, "qa")).toEqual([]);
  });

  it("comando que pasa o falla", () => {
    const tdd = registry.get("TDD") as Discipline;
    const root = tempDir();
    write(root, "tests/unit/a.test.ts", "export {};\n");
    expect(verify(tdd, root, "build", ok)).toEqual([]);
    expect(
      verify(tdd, root, "build", fail)
        .map((f) => f.mensaje)
        .join(),
    ).toContain("falló «npx vitest run tests/unit»");
  });

  it("los artefactos opcionales se validan solo si existen", () => {
    const odd = registry.get("ODD_API") as Discipline;
    const root = tempDir();
    write(root, "api/openapi.yaml", "openapi: 3.1.0\n");
    expect(verify(odd, root, "spec")).toEqual([]);
    write(root, "api/fragments/a.json", "{roto");
    expect(
      verify(odd, root, "spec")
        .map((f) => f.mensaje)
        .join(),
    ).toContain("no es JSON válido");
  });

  it("ignora node_modules al buscar artefactos", () => {
    const tdd = registry.get("TDD") as Discipline;
    const root = tempDir();
    write(root, "node_modules/pkg/tests/unit/a.test.ts", "x");
    expect(
      verify(tdd, root, "build", ok)
        .map((f) => f.mensaje)
        .join(),
    ).toContain("falta el artefacto");
  });
});
