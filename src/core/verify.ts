import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import YAML from "yaml";
import type { Artifact, Discipline, Format } from "./disciplines.js";
import { appliesIn, verificationAppliesIn } from "./disciplines.js";
import type { Phase } from "./phases.js";
import { comprobarParte } from "../docs/check.js";
import { encabezados, normalizar } from "../docs/markdown.js";
import { leerDocumento, nombreSeguro } from "../docs/lectura.js";
import { blockers, scan } from "../security/scan.js";

export interface Finding {
  modulo: string;
  disciplina: string;
  mensaje: string;
  /** A warning is shown and recorded but does not stop anything; without a level it blocks. */
  nivel?: "bloqueo" | "aviso";
}

export type Verdict = "PASS" | "WARN" | "BLOCK";

export const isBlocking = (f: Finding): boolean => f.nivel !== "aviso";

/** BLOCK if anything blocks, WARN if there are only warnings, PASS if nothing is left to say. */
export function verdictOfFindings(findings: Finding[]): Verdict {
  if (findings.some(isBlocking)) return "BLOCK";
  return findings.length > 0 ? "WARN" : "PASS";
}

export type CommandRunner = (command: string, cwd: string) => { ok: boolean; output: string };

export const defaultRunner: CommandRunner = (command, cwd) => {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .trim()
    .split("\n")
    .slice(-15)
    .join("\n");
  return { ok: result.status === 0, output };
};

/** Runs the security scan on a module and says what blocks it (nothing: it passes). */
export type SecurityScanner = (moduleRoot: string) => string[];

/**
 * Read-only on purpose: a verification must not touch the files an approval is pinned to, or
 * checking a phase would invalidate its own approval. `evol security scan` is what writes the report.
 */
export const defaultSecurityScan: SecurityScanner = (moduleRoot) => blockers(scan(moduleRoot));

export interface VerifyContext {
  moduleName: string;
  /** Absolute root of the module; artifact paths are relative to it. */
  moduleRoot: string;
  phase: Phase;
  run?: CommandRunner;
  securityScan?: SecurityScanner;
}

/** Files matching `pattern` (relative to `cwd`), never descending into node_modules. */
export function matchFiles(pattern: string, cwd: string): string[] {
  if (!existsSync(cwd)) return [];
  const skip = (entry: string | { name: string }): boolean =>
    (typeof entry === "string" ? entry.split("/").pop() : entry.name) === "node_modules";
  return globSync(pattern, { cwd, exclude: skip })
    .filter((rel) => statSync(join(cwd, rel)).isFile())
    .sort();
}

/**
 * Templates mark what the author still has to write; a gate must not pass over it. Exported so the
 * tests of this very check can refer to it instead of embedding the literal themselves — the TDD
 * discipline scans `tests/*.test.ts` for this same marker, and a test file that writes it as plain
 * text would wrongly flag itself as unfinished.
 */
export const PLACEHOLDER_TEXT = "[[COMPLETAR]]";
const PLACEHOLDER = new RegExp(PLACEHOLDER_TEXT.replace(/[[\]]/g, "\\$&"));
const FEATURE_HEADER = /^\s*(Feature|Funcionalidad|Característica|Caracteristica)\s*:/m;
const FEATURE_SCENARIO =
  /^\s*(Scenario|Scenario Outline|Scenario Template|Escenario|Esquema del escenario)\s*:/m;

/** Returns an error message if `content` is not valid for `format`, otherwise null. */
export function validateFormat(format: Format, content: string): string | null {
  if (content.trim() === "") return "está vacío";
  if (PLACEHOLDER.test(content))
    return `tiene secciones sin completar (marcador ${PLACEHOLDER_TEXT})`;
  switch (format) {
    case "json":
    case "avsc":
      try {
        JSON.parse(content);
        return null;
      } catch (error) {
        return `no es JSON válido (${(error as Error).message})`;
      }
    case "yaml": {
      const doc = YAML.parseDocument(content);
      return doc.errors.length > 0
        ? `no es YAML válido (${doc.errors[0]?.message ?? "error"})`
        : null;
    }
    case "feature":
      return FEATURE_HEADER.test(content) ? null : "no declara «Feature:»";
    case "puml":
      return /@startuml/i.test(content) ? null : "no contiene «@startuml»";
    default:
      return null;
  }
}

function checkArtifact(artifact: Artifact, ctx: VerifyContext, d: Discipline): Finding[] {
  const finding = (mensaje: string, nivel?: "bloqueo" | "aviso"): Finding => ({
    modulo: ctx.moduleName,
    disciplina: d.id,
    mensaje,
    ...(nivel ? { nivel } : {}),
  });
  const files = matchFiles(artifact.patron, ctx.moduleRoot);
  const findings: Finding[] = [];
  if (files.length < artifact.min) {
    findings.push(
      finding(
        `falta el artefacto «${artifact.patron}» (se esperaba al menos ${artifact.min}, hay ${files.length})`,
      ),
    );
  }
  for (const rel of files) {
    const problem = validateFormat(
      artifact.formato,
      readFileSync(join(ctx.moduleRoot, rel), "utf8"),
    );
    if (problem) findings.push(finding(`«${rel}» ${problem}`));
  }
  return findings;
}

const CRITICAL_OPEN = /^\s*[-*]\s*\[ \]\s*.*\b(CRITICAL|CR[IÍ]TIC[OA])\b/im;

/** Verifies one discipline for one module in one phase. Returns the problems found. */
/** A verification type that no `case` handles would verify nothing: this makes that a compile error. */
function sinCaso(v: never): never {
  throw new Error(`verificación sin implementar: ${JSON.stringify(v)}`);
}

export function verifyDiscipline(d: Discipline, ctx: VerifyContext): Finding[] {
  if (!appliesIn(d, ctx.phase)) return [];
  const finding = (mensaje: string, nivel?: "bloqueo" | "aviso"): Finding => ({
    modulo: ctx.moduleName,
    disciplina: d.id,
    mensaje,
    ...(nivel ? { nivel } : {}),
  });
  const findings: Finding[] = [];
  for (const artifact of d.artefactos) findings.push(...checkArtifact(artifact, ctx, d));

  for (const v of d.verificaciones) {
    if (!verificationAppliesIn(v, ctx.phase)) continue;
    switch (v.tipo) {
      case "contiene": {
        const file = join(ctx.moduleRoot, v.archivo);
        if (!existsSync(file)) break; // a missing file is already reported as a missing artifact
        if (!new RegExp(v.patron, v.flags).test(readFileSync(file, "utf8"))) {
          findings.push(finding(v.mensaje));
        }
        break;
      }
      case "escenarios": {
        for (const artifact of d.artefactos.filter((a) => a.formato === "feature")) {
          for (const rel of matchFiles(artifact.patron, ctx.moduleRoot)) {
            const content = readFileSync(join(ctx.moduleRoot, rel), "utf8");
            if (!FEATURE_SCENARIO.test(content))
              findings.push(finding(`«${rel}» no tiene ningún escenario`));
          }
        }
        break;
      }
      case "documentos": {
        for (const h of comprobarParte(v.comprobacion, ctx.moduleRoot))
          findings.push(
            finding(`${h.archivo}: ${h.mensaje}`, h.nivel === "aviso" ? "aviso" : undefined),
          );
        break;
      }
      case "secciones": {
        for (const rel of matchFiles(v.patron, ctx.moduleRoot)) {
          const nombre = nombreSeguro(rel);
          const lectura = leerDocumento(join(ctx.moduleRoot, rel));
          if (!lectura.ok) {
            findings.push(finding(`«${nombre}»: ${lectura.motivo}`));
            continue;
          }
          const titulos = new Set(encabezados(lectura.texto).map((h) => normalizar(h.titulo)));
          for (const seccion of v.secciones) {
            if (titulos.has(normalizar(seccion.nombre))) continue;
            const motivo = seccion.motivo ? `: ${seccion.motivo}` : "";
            findings.push(
              finding(`«${nombre}» no tiene la sección «${seccion.nombre}»${motivo}`, v.nivel),
            );
          }
        }
        break;
      }
      case "sqlPar": {
        for (const dir of globSync(v.base, { cwd: ctx.moduleRoot, exclude: () => false })) {
          if (!statSync(join(ctx.moduleRoot, dir)).isDirectory()) continue;
          for (const name of ["up.sql", "down.sql"]) {
            if (!existsSync(join(ctx.moduleRoot, dir, name))) {
              findings.push(finding(`la migración «${dir}» no tiene ${name}`));
            }
          }
        }
        break;
      }
      case "sinCriticos": {
        const file = join(ctx.moduleRoot, v.archivo);
        if (existsSync(file) && CRITICAL_OPEN.test(readFileSync(file, "utf8"))) {
          findings.push(finding(`«${v.archivo}» tiene hallazgos críticos abiertos`));
        }
        break;
      }
      case "escaneoSeguridad": {
        // in this process, not through a shell: `evol` does not have to be on the PATH
        for (const reason of (ctx.securityScan ?? defaultSecurityScan)(ctx.moduleRoot))
          findings.push(finding(`escaneo de seguridad: ${reason}`));
        break;
      }
      case "comando": {
        const result = (ctx.run ?? defaultRunner)(v.comando, ctx.moduleRoot);
        if (!result.ok) {
          findings.push(
            finding(`falló «${v.comando}»${result.output ? `:\n${result.output}` : ""}`),
          );
        }
        break;
      }
      default:
        return sinCaso(v);
    }
  }
  return findings;
}

/** Every file (relative to `moduleRoot`) that the discipline's artifact patterns match. */
export function artifactFiles(d: Discipline, moduleRoot: string): string[] {
  const files = new Set<string>();
  for (const artifact of d.artefactos) {
    for (const rel of matchFiles(artifact.patron, moduleRoot)) files.add(rel);
  }
  return [...files].sort();
}
