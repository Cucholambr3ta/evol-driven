import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isTestPath, listSourceFiles } from "../codeintel/native/indexer.js";
import { resolveDiscipline } from "./disciplines.js";
import type { PipelineContext } from "./pipeline.js";
import { matchFiles } from "./verify.js";
import type { Finding } from "./verify.js";

export interface ScenarioRef {
  archivo: string;
  nombre: string;
}

export interface TestRef {
  archivo: string;
  nombre: string;
}

export interface CriterionCoverage {
  id: string;
  modulo: string;
  texto: string;
  escenarios: ScenarioRef[];
  pruebas: TestRef[];
}

export interface CoverageReport {
  criterios: CriterionCoverage[];
  sinEscenario: string[];
  sinPrueba: string[];
  /** CA-n referenced by a scenario or a test but not defined in any SPEC. */
  huerfanos: string[];
}

const CRITERION_LINE =
  /^\s*(?:[-*+]\s+|\d+[.)]\s+|\|\s*)?\**\s*(CA-\d+)\b\**\s*[:.)|–—-]*\s*(.*?)\s*\|?\s*$/;
const TAG = /@(CA-\d+)\b/g;
const TEST_TITLE = /\b(?:it|test|describe)(?:\.\w+)*\(\s*(["'`])(.*?)\1/g;
const CRITERION_ID = /\bCA-\d+\b/g;
const SCENARIO =
  /^\s*(?:Scenario Outline|Scenario Template|Scenario|Esquema del escenario|Escenario)\s*:\s*(.*)$/;
const FEATURE = /^\s*(?:Feature|Funcionalidad|Característica|Caracteristica)\s*:/;

/** Criteria declared as `CA-n` at the start of a list item, table row or line. */
export function parseCriteria(markdown: string): { id: string; texto: string }[] {
  const seen = new Map<string, string>();
  for (const line of markdown.split("\n")) {
    const match = CRITERION_LINE.exec(line);
    const id = match?.[1];
    if (id && !seen.has(id)) seen.set(id, match[2] ?? "");
  }
  return [...seen].map(([id, texto]) => ({ id, texto }));
}

/** Scenarios with the `@CA-n` tags that apply to them (their own or the Feature's). */
export function parseScenarios(content: string): { nombre: string; criterios: string[] }[] {
  const scenarios: { nombre: string; criterios: string[] }[] = [];
  let featureTags: string[] = [];
  let pending: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@")) {
      pending.push(...[...trimmed.matchAll(TAG)].map((m) => m[1] as string));
    } else if (FEATURE.test(line)) {
      featureTags = pending;
      pending = [];
    } else {
      const scenario = SCENARIO.exec(line);
      if (scenario) {
        scenarios.push({
          nombre: (scenario[1] ?? "").trim(),
          criterios: [...new Set([...featureTags, ...pending])],
        });
        pending = [];
      } else if (trimmed !== "" && !trimmed.startsWith("#")) {
        pending = [];
      }
    }
  }
  return scenarios;
}

/** Test and suite titles that mention a criterion. */
export function parseTestTitles(source: string): { nombre: string; criterios: string[] }[] {
  const titles: { nombre: string; criterios: string[] }[] = [];
  for (const match of source.matchAll(TEST_TITLE)) {
    const nombre = match[2] ?? "";
    const criterios = [...new Set(nombre.match(CRITERION_ID) ?? [])];
    if (criterios.length > 0) titles.push({ nombre, criterios });
  }
  return titles;
}

/** Acceptance criterion -> scenario -> test matrix, with its gaps. Reads files only. */
export function coverageReport(ctx: PipelineContext): CoverageReport {
  const criterios: CriterionCoverage[] = [];
  const defined = new Set<string>();
  const referenced = new Set<string>();

  for (const module of ctx.config.modules) {
    const moduleRoot = join(ctx.root, module.root);
    const sdd = ctx.registry.get("SDD");
    const specPatterns = sdd
      ? resolveDiscipline(sdd, module).artefactos.map((a) => a.patron)
      : ["docs/specs/SPEC.md"];
    const declared = specPatterns
      .flatMap((p) => matchFiles(p, moduleRoot))
      .flatMap((rel) => parseCriteria(readFileSync(join(moduleRoot, rel), "utf8")));

    const scenarios = matchFiles("**/*.feature", moduleRoot).flatMap((archivo) =>
      parseScenarios(readFileSync(join(moduleRoot, archivo), "utf8")).map((s) => ({
        archivo,
        ...s,
      })),
    );
    const tests = listSourceFiles(moduleRoot)
      .filter(isTestPath)
      .flatMap((archivo) =>
        parseTestTitles(readFileSync(join(moduleRoot, archivo), "utf8")).map((t) => ({
          archivo,
          ...t,
        })),
      );

    for (const s of scenarios) s.criterios.forEach((c) => referenced.add(c));
    for (const t of tests) t.criterios.forEach((c) => referenced.add(c));

    for (const { id, texto } of declared) {
      defined.add(id);
      criterios.push({
        id,
        modulo: module.name,
        texto,
        escenarios: scenarios
          .filter((s) => s.criterios.includes(id))
          .map(({ archivo, nombre }) => ({ archivo, nombre })),
        pruebas: tests
          .filter((t) => t.criterios.includes(id))
          .map(({ archivo, nombre }) => ({ archivo, nombre })),
      });
    }
  }

  const label = (c: CriterionCoverage): string => `${c.modulo}/${c.id}`;
  return {
    criterios,
    sinEscenario: criterios.filter((c) => c.escenarios.length === 0).map(label),
    sinPrueba: criterios.filter((c) => c.pruebas.length === 0).map(label),
    huerfanos: [...referenced].filter((id) => !defined.has(id)).sort(),
  };
}

/** QA gate: with `qa.requireCriteriaCoverage` every criterion needs a scenario and a test. */
export function coverageFindings(ctx: PipelineContext): Finding[] {
  const report = coverageReport(ctx);
  const finding = (mensaje: string): Finding => ({
    modulo: "-",
    disciplina: "COVERAGE",
    mensaje,
  });
  if (report.criterios.length === 0) {
    return [finding("no hay criterios CA-n en los SPEC: no se puede exigir cobertura")];
  }
  return [
    ...report.sinEscenario.map((c) =>
      finding(`el criterio ${c} no tiene ningún escenario (@CA-n)`),
    ),
    ...report.sinPrueba.map((c) =>
      finding(`el criterio ${c} no tiene ninguna prueba que lo nombre`),
    ),
  ];
}

export function renderCoverage(report: CoverageReport): string[] {
  if (report.criterios.length === 0) {
    return [
      "No hay criterios de aceptación con la convención CA-n en el SPEC.",
      "Escríbelos como «CA-1: …» y etiqueta los escenarios con @CA-1 y las pruebas con CA-1 en su nombre.",
    ];
  }
  const lines: string[] = [];
  for (const c of report.criterios) {
    const mark = (n: number): string => (n > 0 ? `✓${n}` : "✗");
    lines.push(
      `${c.modulo}/${c.id}  escenarios ${mark(c.escenarios.length)}  pruebas ${mark(c.pruebas.length)}  ${c.texto}`,
    );
    for (const s of c.escenarios) lines.push(`    escenario: ${s.archivo} — ${s.nombre}`);
    for (const t of c.pruebas) lines.push(`    prueba:    ${t.archivo} — ${t.nombre}`);
  }
  lines.push("");
  lines.push(
    `Sin escenario: ${report.sinEscenario.length ? report.sinEscenario.join(", ") : "ninguno"}`,
  );
  lines.push(`Sin prueba:    ${report.sinPrueba.length ? report.sinPrueba.join(", ") : "ninguno"}`);
  if (report.huerfanos.length > 0) {
    lines.push(`Referencias a criterios inexistentes: ${report.huerfanos.join(", ")}`);
  }
  return lines;
}
