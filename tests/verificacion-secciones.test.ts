import { describe, expect, it } from "vitest";
import {
  DisciplineRegistry,
  DisciplineSchema,
  artifactPaths,
  loadDisciplines,
  resolveDiscipline,
  validateModuleOverrides,
} from "../src/core/disciplines.js";
import type { Discipline } from "../src/core/disciplines.js";
import { verdictOfFindings, verifyDiscipline } from "../src/core/verify.js";
import { tempDir, write } from "./helpers.js";

const ADR_COMPLETO =
  "# ADR\n\n## Contexto\n\nx\n\n## Opciones\n\nA y B\n\n## Decisión\n\nA\n\n## Consecuencias\n\nx\n";

function disciplina(extra: Record<string, unknown> = {}): Discipline {
  return DisciplineSchema.parse({
    id: "PRUEBA",
    nombre: "Una disciplina de prueba",
    tipo: "extendida",
    rol: "arquitecto",
    fases: ["spec"],
    artefactos: [{ patron: "docs/adr/*.md", formato: "md", min: 1 }],
    verificaciones: [
      {
        tipo: "secciones",
        patron: "docs/adr/*.md",
        secciones: [
          { nombre: "Opciones" },
          { nombre: "Referencias", motivo: "enlaza la decisión con su implementación" },
        ],
        ...extra,
      },
    ],
  });
}

const verificar = (d: Discipline, root: string) =>
  verifyDiscipline(d, { moduleName: "app", moduleRoot: root, phase: "spec" });

describe("verificación por secciones", () => {
  it("avisa de cada sección que falta, con su motivo, y de ninguna más", () => {
    const root = tempDir();
    write(root, "docs/adr/0001-uno.md", ADR_COMPLETO);

    const mensajes = verificar(disciplina(), root).map((f) => f.mensaje);

    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]).toContain("docs/adr/0001-uno.md");
    expect(mensajes[0]).toContain("Referencias");
    expect(mensajes[0]).toContain("enlaza la decisión con su implementación");
    expect(mensajes[0]).not.toContain("Opciones");
  });

  it("sin nivel, el hallazgo bloquea; con nivel de aviso, solo avisa", () => {
    const root = tempDir();
    write(root, "docs/adr/0001-uno.md", ADR_COMPLETO);

    const bloquea = verificar(disciplina(), root);
    const avisa = verificar(disciplina({ nivel: "aviso" }), root);

    expect(bloquea[0]?.nivel).toBeUndefined();
    expect(verdictOfFindings(bloquea)).toBe("BLOCK");
    expect(avisa[0]?.nivel).toBe("aviso");
    expect(verdictOfFindings(avisa)).toBe("WARN");
  });

  it("un documento con todas las secciones no da ningún hallazgo", () => {
    const root = tempDir();
    write(root, "docs/adr/0001-uno.md", `${ADR_COMPLETO}\n## Referencias\n\nsrc/x.ts\n`);

    expect(verificar(disciplina(), root)).toEqual([]);
  });

  it("compara los títulos sin tildes, sin mayúsculas y con numeración", () => {
    const root = tempDir();
    write(root, "docs/adr/0001-uno.md", "# ADR\n\n## 2. OPCIONES\n\nx\n\n### referencias:\n\ny\n");

    expect(verificar(disciplina(), root)).toEqual([]);
  });

  it("un encabezado dentro de un bloque de código no cuenta", () => {
    const root = tempDir();
    write(root, "docs/adr/0001-uno.md", "# ADR\n\n## Opciones\n\n```\n## Referencias\n```\n");

    expect(verificar(disciplina(), root).map((f) => f.mensaje)).toEqual([
      expect.stringContaining("Referencias"),
    ]);
  });

  it("nombra cada documento por separado", () => {
    const root = tempDir();
    write(root, "docs/adr/0001-uno.md", "# ADR\n\n## Opciones\n");
    write(root, "docs/adr/0002-dos.md", "# ADR\n\n## Referencias\n");

    const mensajes = verificar(disciplina(), root).map((f) => f.mensaje);

    expect(mensajes.find((m) => m.includes("0001-uno.md"))).toContain("Referencias");
    expect(mensajes.find((m) => m.includes("0002-dos.md"))).toContain("Opciones");
  });

  it("un documento demasiado grande es un hallazgo que bloquea y no se lee", () => {
    const root = tempDir();
    write(root, "docs/adr/0001-uno.md", `## Opciones\n## Referencias\n${"x".repeat(1024 * 1024)}`);

    const hallazgos = verificar(disciplina({ nivel: "aviso" }), root);

    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]?.mensaje).toMatch(/demasiado grande/);
    expect(hallazgos[0]?.nivel).toBeUndefined();
  });

  it("sin documentos, no hay nada que comprobar (falta de artefacto ya lo dice otra comprobación)", () => {
    const hallazgos = verificar(disciplina(), tempDir());

    expect(hallazgos.map((f) => f.mensaje)).toEqual([
      expect.stringContaining("falta el artefacto"),
    ]);
  });
});

describe("el esquema de las verificaciones", () => {
  it("rechaza una verificación por secciones sin ninguna sección", () => {
    expect(() => disciplina({ secciones: [] })).toThrow();
  });

  it("rechaza un nivel que no sea bloqueo o aviso", () => {
    expect(() => disciplina({ nivel: "grave" })).toThrow();
  });

  it("las verificaciones que ya existían siguen cargando sin nivel", () => {
    const todas = loadDisciplines().all();

    expect(todas.length).toBeGreaterThanOrEqual(31);
  });
});

describe("rutas de un módulo con verificación por secciones", () => {
  it("el patrón de la verificación cuenta como artefacto remapeable", () => {
    const registro = new DisciplineRegistry([disciplina()]);

    expect(artifactPaths(registro, ["PRUEBA"]).has("docs/adr/*.md")).toBe(true);
    expect(
      validateModuleOverrides(registro, {
        disciplinas: ["PRUEBA"],
        rutas: { "docs/adr/*.md": "adr/*.md" },
      }),
    ).toEqual([]);
  });

  it("resolveDiscipline mueve el patrón de la verificación igual que el del artefacto", () => {
    const movida = resolveDiscipline(disciplina(), {
      disciplinas: ["PRUEBA"],
      rutas: { "docs/adr/*.md": "adr/*.md" },
    });

    expect(movida.artefactos[0]?.patron).toBe("adr/*.md");
    expect(movida.verificaciones[0]).toMatchObject({ tipo: "secciones", patron: "adr/*.md" });
  });
});

describe("registro: cada patrón de secciones es un artefacto de su disciplina", () => {
  const todas = loadDisciplines().all();

  it("si no, remapear el artefacto no movería la verificación (y daría un PASS falso)", () => {
    for (const d of todas) {
      const patrones = new Set(d.artefactos.map((a) => a.patron));
      for (const v of d.verificaciones)
        if (v.tipo === "secciones")
          expect(patrones.has(v.patron), `${d.id}: ${v.patron}`).toBe(true);
    }
  });
});
