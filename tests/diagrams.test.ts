import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { journalAppend } from "../src/core/journal.js";
import { loadContext } from "../src/core/pipeline.js";
import { formatDuration, parseFeatureActors, timingSegments } from "../src/diagrams/behavior.js";
import { DIAGRAM_COUNT, generateDiagrams } from "../src/diagrams/index.js";
import type { Diagram } from "../src/diagrams/index.js";
import { graphvizVersion } from "../src/diagrams/layout.js";
import { rasterize } from "../src/diagrams/raster.js";
import { esc, n, textWidth } from "../src/diagrams/svg.js";
import { cli, makeProject, tempDir, write } from "./helpers.js";

// tests/setup-env.ts points EVOL_CONFIG_DIR at a temp folder before this file is collected.
const env = (): Record<string, string> => ({
  EVOL_CONFIG_DIR: process.env["EVOL_CONFIG_DIR"] ?? "",
});

const hasDot = graphvizVersion() !== null;
const hasVectorCraft =
  spawnSync("vectorcraft-cli", ["--help"], { encoding: "utf8" }).error === undefined;
const needsDot = describe.skipIf(!hasDot);

/** A small project with real code, a feature with an actor, Docker, compose and CI. */
function codeProject(overrides = {}): string {
  const root = makeProject(["SDD", "TDD"], overrides);
  write(root, "src/core/util.ts", "export function util(): number {\n  return 1;\n}\n");
  write(
    root,
    "src/core/helper.ts",
    'import { util } from "./util.js";\nexport function help(): number {\n  return util();\n}\n',
  );
  write(
    root,
    "src/app/base.ts",
    'export class Base {\n  hello(): string {\n    return "x";\n  }\n}\nexport class Child extends Base {\n  run(): string {\n    return this.hello();\n  }\n}\n',
  );
  write(
    root,
    "src/app/main.ts",
    'import { help } from "../core/helper.js";\nimport { Child } from "./base.js";\nexport function main(): number {\n  new Child().run();\n  return help();\n}\n',
  );
  write(
    root,
    "tests/features/sesion.feature",
    "Feature: Sesión\n  Como lectora, quiero ver el estado para saber en qué fase estoy\n\n  Scenario: Ver el estado\n    Given un proyecto\n    When consulto\n    Then veo la fase\n",
  );
  write(
    root,
    "Dockerfile",
    'FROM node:24 AS build\nRUN npm ci\nFROM node:24-slim AS runtime\nCOPY --from=build /app /app\nCMD ["node", "main.js"]\n',
  );
  write(
    root,
    "compose.yaml",
    "services:\n  web:\n    build: .\n    ports: ['3000:3000']\n    depends_on: [db]\n  db:\n    image: postgres:17\n    volumes: ['data:/var/lib/postgresql']\nvolumes:\n  data: {}\n",
  );
  write(
    root,
    ".github/workflows/ci.yml",
    "name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n  docker:\n    runs-on: ubuntu-latest\n    needs: test\n",
  );
  return root;
}

function byNumber(diagrams: Diagram[]): Map<number, Diagram> {
  return new Map(diagrams.map((d) => [d.numero, d]));
}

describe("utilidades SVG", () => {
  it("redondea a dos decimales y escapa el texto", () => {
    expect(n(1.23456)).toBe("1.23");
    expect(n(2)).toBe("2");
    expect(esc('a<b>&"c')).toBe("a&lt;b&gt;&amp;&quot;c");
  });

  it("estima el ancho del texto sin depender de las fuentes instaladas", () => {
    expect(textWidth("iii")).toBeLessThan(textWidth("WWW"));
    expect(textWidth("hola")).toBe(textWidth("hola"));
    expect(textWidth("")).toBe(0);
  });
});

describe("lectura de actores y tiempos", () => {
  it("encuentra el actor «Como …» de un .feature y sus escenarios", () => {
    const parsed = parseFeatureActors(
      "Feature: Cobros\n  Como cajero, quiero cobrar para cerrar la venta\n  Scenario: Cobro simple\n  Scenario: Cobro dividido\n",
    );
    expect(parsed).toEqual({
      feature: "Cobros",
      actor: "cajero",
      escenarios: ["Cobro simple", "Cobro dividido"],
    });
    expect(parseFeatureActors("Feature: Sin actor\n  Scenario: x\n").actor).toBeNull();
  });

  it("convierte el diario en tramos de trabajo y de espera", () => {
    const segments = timingSegments([
      { ts: "2026-10-01T09:00:00.000Z", type: "project-created", name: "x" },
      { ts: "2026-10-01T11:00:00.000Z", type: "approved", phase: "briefing" },
      { ts: "2026-10-01T11:30:00.000Z", type: "phase-completed", phase: "briefing", next: "spec" },
      { ts: "2026-10-02T11:30:00.000Z", type: "approved", phase: "spec" },
    ]);
    expect(segments.map((s) => [s.phase, s.kind, (s.to - s.from) / 60_000])).toEqual([
      ["briefing", "trabajo", 120],
      ["briefing", "espera", 30],
      ["spec", "trabajo", 1440],
    ]);
  });

  it("da duraciones legibles", () => {
    expect(formatDuration(10_000)).toBe("<1 min");
    expect(formatDuration(5 * 60_000)).toBe("5 min");
    expect(formatDuration(150 * 60_000)).toBe("2 h 30 min");
    expect(formatDuration(80 * 3_600_000)).toBe("3 d 8 h");
  });
});

needsDot("los 14 diagramas UML (criterios 26 y 27)", () => {
  const root = codeProject();
  const diagrams = generateDiagrams(loadContext(root));
  const by = byNumber(diagrams);

  it("hay uno de cada tipo, con título, tipo y fuente de datos", () => {
    expect(diagrams.map((d) => d.numero)).toEqual(
      Array.from({ length: DIAGRAM_COUNT }, (_, i) => i + 1),
    );
    expect(new Set(diagrams.map((d) => d.tipo)).size).toBe(14);
    for (const d of diagrams) {
      expect(d.titulo, `${d.numero}`).not.toBe("");
      expect(d.fuente, `${d.numero}`).not.toBe("");
      if (d.estado === "ok") expect(d.svg, `${d.numero}`).toMatch(/^<svg[\s\S]*<\/svg>\n$/);
      else expect(d.motivo, `${d.numero}`).toBeTruthy();
    }
  });

  it("con datos reales los 14 se generan", () => {
    expect(diagrams.filter((d) => d.estado === "no-aplica").map((d) => d.numero)).toEqual([13]);
  });

  it("clases: muestra la herencia con la flecha hueca", () => {
    const svg = by.get(1)?.svg ?? "";
    expect(svg).toContain(">Child<");
    expect(svg).toContain(">Base<");
    expect(svg).toContain("m-hollow");
    expect(svg).toContain(">hello()<");
  });

  it("componentes y paquetes: agrupan por carpeta y cuentan las dependencias", () => {
    const components = by.get(3)?.svg ?? "";
    expect(components).toContain(">src/app<");
    expect(components).toContain(">src/core<");
    expect(components).toContain("«component»");
    const packages = by.get(5)?.svg ?? "";
    expect(packages).toContain(">src<");
    expect(packages).toContain(">core<");
  });

  it("estructura compuesta: archivos como partes y los símbolos llamados desde fuera como puertos", () => {
    const d = generateDiagrams(loadContext(root), { only: [4], componente: "src/core" })[0];
    expect(d?.estado).toBe("ok");
    expect(d?.svg).toContain("helper.ts : archivo");
    expect(d?.svg).toContain(">help<");
    expect(d?.svg).not.toContain(">util<");
  });

  it("estructura compuesta: un componente inexistente se explica", () => {
    const d = generateDiagrams(loadContext(root), { only: [4], componente: "nada" })[0];
    expect(d?.estado).toBe("no-aplica");
    expect(d?.motivo).toContain("no existe el componente «nada»");
  });

  it("despliegue: lee Dockerfile, compose y el workflow", () => {
    const svg = by.get(6)?.svg ?? "";
    for (const kind of ["«stage»", "«container»", "«job»", "«volume»"]) expect(svg).toContain(kind);
    expect(svg).toContain(">runtime<");
    expect(svg).toContain(">db<");
    expect(svg).toContain(">docker<");
  });

  it("perfiles: un estereotipo por disciplina activa", () => {
    const svg = by.get(7)?.svg ?? "";
    expect(svg).toContain("«SDD»");
    expect(svg).toContain("«TDD»");
    expect(svg).not.toContain("«BDD»");
  });

  it("casos de uso: el actor y el caso salen del .feature", () => {
    const svg = by.get(8)?.svg ?? "";
    expect(svg).toContain(">lectora<");
    expect(svg).toContain(">Ver el estado<");
  });

  it("actividad, máquina de estados y visión de interacción reflejan la fase actual", () => {
    expect(by.get(9)?.svg).toContain("Fase briefing");
    expect(by.get(10)?.nota).toContain("«briefing»");
    expect(by.get(14)?.svg).toContain("Aprobación de «retro»");
  });

  it("secuencia y comunicación siguen las llamadas desde el punto de entrada elegido", () => {
    expect(by.get(11)?.svg).toContain("sd Llamadas de main");
    expect(by.get(11)?.svg).toContain("sd Aprobación de una fase");
    expect(by.get(11)?.nota).toContain("src/app/main.ts#main");
    expect(by.get(12)?.svg).toContain("1: ");
    expect(by.get(12)?.nota).toContain("src/app/main.ts#main");
  });

  it("un punto de entrada que no existe o es ambiguo se explica", () => {
    const missing = generateDiagrams(loadContext(root), { only: [12], entrada: "nope" })[0];
    expect(missing?.estado).toBe("no-aplica");
    expect(missing?.motivo).toContain("no existe el símbolo «nope»");
    const chosen = generateDiagrams(loadContext(root), { only: [12], entrada: "help" })[0];
    expect(chosen?.estado).toBe("ok");
    expect(chosen?.nota).not.toContain("elegido automáticamente");
  });

  it("es determinista: los mismos datos dan el mismo SVG (criterio 27)", () => {
    const again = generateDiagrams(loadContext(root));
    expect(again.map((d) => d.svg)).toEqual(diagrams.map((d) => d.svg));
  });
});

needsDot("diagramas sin datos: «no aplica» con el motivo, nunca inventados", () => {
  const diagrams = generateDiagrams(loadContext(makeProject(["SDD"])));
  const by = byNumber(diagrams);

  it("sin código, sin Docker, sin actores y sin diario", () => {
    const missing = diagrams.filter((d) => d.estado === "no-aplica").map((d) => d.numero);
    expect(missing).toEqual([1, 3, 4, 5, 6, 8, 12, 13]);
    expect(by.get(1)?.motivo).toContain("no contiene clases");
    expect(by.get(6)?.motivo).toContain("no tiene Dockerfile");
    expect(by.get(8)?.motivo).toContain("Como");
    expect(by.get(13)?.motivo).toContain("diario");
  });

  it("los que describen cómo funciona evol se generan siempre", () => {
    for (const k of [2, 7, 9, 10, 11, 14]) expect(by.get(k)?.estado, `${k}`).toBe("ok");
  });

  it("el diagrama de tiempos aparece en cuanto el diario tiene aprobaciones", () => {
    const root = makeProject(["SDD"]);
    journalAppend(root, "project-created", { name: "demo" });
    journalAppend(root, "approved", { phase: "briefing", seq: 1 });
    const d = generateDiagrams(loadContext(root), { only: [13] })[0];
    expect(d?.estado).toBe("ok");
    expect(d?.svg).toContain("briefing");
  });

  it("con el proveedor gitnexus los diagramas de código lo explican", () => {
    const root = makeProject(["SDD"], { codeIntel: "gitnexus" });
    const all = byNumber(generateDiagrams(loadContext(root)));
    expect(all.get(1)?.motivo).toContain("gitnexus");
    expect(all.get(12)?.motivo).toContain("gitnexus");
    expect(all.get(11)?.estado).toBe("ok");
    expect(all.get(11)?.nota).toContain("gitnexus");
  });
});

describe.skipIf(!hasDot || !hasVectorCraft)(
  "VectorCraft rasteriza los diagramas (criterio 27)",
  () => {
    it("los 14 se convierten a PNG sin error ni avisos de fuente", () => {
      const out = tempDir("evol-raster-");
      const diagrams = generateDiagrams(loadContext(codeProject()));
      for (const d of diagrams.filter((x) => x.svg)) {
        const svg = join(out, `${d.numero}.svg`);
        write(out, `${d.numero}.svg`, d.svg ?? "");
        const png = join(out, `${d.numero}.png`);
        const result = rasterize(svg, png, 1);
        expect(result.warnings, `${d.numero} ${d.tipo}`).toEqual([]);
        expect(statSync(png).size, `${d.numero}`).toBeGreaterThan(500);
      }
    });
  },
);

needsDot("evol diagrams (CLI)", () => {
  it("escribe un SVG por diagrama y lista los que no aplican", () => {
    const root = makeProject(["SDD"]);
    const r = cli(["diagrams", "--salida", "out"], { cwd: root, env: env() });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("no aplica");
    expect(readdirSync(join(root, "out")).sort()).toEqual([
      "02-objetos.svg",
      "07-perfiles.svg",
      "09-actividad.svg",
      "10-maquina-de-estados.svg",
      "11-secuencia.svg",
      "14-vision-de-interaccion.svg",
    ]);
  });

  it("--solo limita los diagramas y --json no incluye el SVG", () => {
    const root = makeProject(["SDD"]);
    const r = cli(["diagrams", "--solo", "9,10", "--json"], { cwd: root, env: env() });
    expect(r.status, r.stderr).toBe(0);
    const rows = JSON.parse(r.stdout) as { numero: number; svg?: string; archivo: string }[];
    expect(rows.map((d) => d.numero)).toEqual([9, 10]);
    expect(rows.every((d) => d.svg === undefined && existsSync(d.archivo))).toBe(true);
    expect(readFileSync(rows[0]?.archivo ?? "", "utf8")).toContain("<svg");
  });

  it("rechaza números fuera del 1 al 14", () => {
    const root = makeProject(["SDD"]);
    const r = cli(["diagrams", "--solo", "15"], { cwd: root, env: env() });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("del 1 al 14");
  });

  it("sin Graphviz falla con un mensaje claro y no escribe nada", () => {
    const root = makeProject(["SDD"]);
    const r = cli(["diagrams", "--salida", "out", "--solo", "2"], {
      cwd: root,
      env: { ...env(), PATH: "" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Graphviz (dot) no está disponible");
    expect(existsSync(join(root, "out"))).toBe(false);
  });
});
