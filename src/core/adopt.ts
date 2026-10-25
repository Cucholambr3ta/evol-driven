import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { artifactPaths } from "./disciplines.js";
import type { DisciplineRegistry } from "./disciplines.js";
import { detectStack, STACKS } from "./stacks.js";
import type { StackId } from "./stacks.js";

/** Where projects that predate evol usually keep the documents evol expects under docs/. */
const ALTERNATIVES: Record<string, string[]> = {
  "docs/specs/SPEC.md": ["SPEC.md", "docs/SPEC.md"],
  "docs/features/FEATURES.md": ["FEATURES.md", "docs/FEATURES.md"],
  "docs/specs/DOMAIN.md": ["DOMAIN.md", "docs/DOMAIN.md"],
  "docs/specs/THREATS.md": ["THREATS.md", "docs/THREATS.md"],
  ".evol/qa/QA_REPORT.md": ["QA_REPORT.md", "docs/QA_REPORT.md", "docs/qa/REPORTE_QA.md"],
};

const TEST_DISCIPLINES = ["TDD", "ATDD", "STDD"];

export interface Detection {
  rutas: Record<string, string>;
  comandos: Record<string, string>;
  notes: string[];
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackage(dir: string): PackageJson | null {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Looks at an existing module and works out what has to be mapped for evol's disciplines to find
 * its documents and run its tests. It only reads; nothing is changed.
 */
export function detectLayout(
  moduleDir: string,
  disciplinas: string[],
  registry: DisciplineRegistry,
  opts: { lenguaje?: StackId } = {},
): Detection {
  const detection: Detection = { rutas: {}, comandos: {}, notes: [] };
  const wanted = artifactPaths(registry, disciplinas);

  for (const [standard, alternatives] of Object.entries(ALTERNATIVES)) {
    if (!wanted.has(standard) || existsSync(join(moduleDir, standard))) continue;
    const found = alternatives.find((alt) => existsSync(join(moduleDir, alt)));
    if (found) {
      detection.rutas[standard] = found;
      detection.notes.push(`documento existente «${found}» usado como «${standard}»`);
    }
  }

  const testing = disciplinas.filter((id) => TEST_DISCIPLINES.includes(id));
  if (testing.length > 0) {
    const stack = opts.lenguaje ?? detectStack(moduleDir);
    if (stack === "python" || stack === "shell") {
      const s = STACKS[stack];
      if (disciplinas.includes("TDD") && s.rutaPrueba && s.comando) {
        detection.rutas["tests/unit/*.test.ts"] = s.rutaPrueba;
        detection.comandos["TDD"] = s.comando;
      }
      detection.notes.push(
        `Lenguaje detectado: ${stack} — TDD ejecuta «${s.comando}» sobre «${s.rutaPrueba}»`,
      );
    } else if (stack === "generico") {
      detection.notes.push(
        "no se detectó un lenguaje de pruebas conocido: define «comandos» en evol.config.json o usa --lenguaje",
      );
    } else {
      const pkg = readPackage(moduleDir);
      const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
      const script = pkg?.scripts?.["test"];
      if (!pkg) {
        detection.notes.push(
          "no hay package.json: las pruebas usan «npx vitest run …» salvo que lo cambies en «comandos»",
        );
      } else if ("vitest" in deps) {
        detection.notes.push("Vitest detectado: se usan los comandos por defecto");
      } else if (script && !/no test specified/i.test(script)) {
        for (const id of testing) detection.comandos[id] = "npm test";
        detection.notes.push(`sin Vitest: ${testing.join(", ")} ejecutan «npm test» (${script})`);
      } else {
        detection.notes.push(
          "no se detectó un comando de pruebas: define «comandos» en evol.config.json",
        );
      }
    }
  }
  return detection;
}
