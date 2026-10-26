import { describe, expect, it } from "vitest";
import {
  DisciplineRegistry,
  DisciplineSchema,
  validateModuleOverrides,
} from "../src/core/disciplines.js";
import type { Discipline } from "../src/core/disciplines.js";
import { verdictOfFindings, verifyDiscipline } from "../src/core/verify.js";
import { tempDir, write } from "./helpers.js";

function disciplina(comprobacion: string, fases: string[] = ["spec"]): Discipline {
  return DisciplineSchema.parse({
    id: "DOCS",
    nombre: "Una disciplina de documentos",
    tipo: "base",
    rol: "arquitecto",
    fases,
    artefactos: [{ patron: "docs/proyecto/INDEX.md", formato: "md", min: 1 }],
    verificaciones: [{ tipo: "documentos", comprobacion }],
  });
}
const verificar = (d: Discipline, root: string, phase = "spec" as const) =>
  verifyDiscipline(d, { moduleName: "app", moduleRoot: root, phase });

describe("verificación «documentos»", () => {
  it("rechaza una comprobación que no existe", () => {
    expect(() => disciplina("inventada")).toThrow();
  });

  it("los hallazgos de la comprobación salen con la disciplina, el archivo y el nivel de cada uno", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "# S\n");
    write(root, "docs/proyecto/INDEX.md", "# I\n\n- [roto](db/no-existe.md)\n");
    write(root, "docs/proyecto/db/corto.md", "# C\n\nOrigen: docs/specs/SPEC.md\n\npoco\n");

    const hallazgos = verificar(disciplina("granular"), root);

    expect(hallazgos.every((f) => f.disciplina === "DOCS" && f.modulo === "app")).toBe(true);
    const roto = hallazgos.find((f) => f.mensaje.includes("db/no-existe.md"));
    expect(roto?.mensaje).toMatch(/^docs\/proyecto\/INDEX\.md: /);
    expect(roto?.nivel).toBeUndefined();
    expect(hallazgos.find((f) => f.mensaje.includes("líneas de contenido"))?.nivel).toBe("aviso");
    expect(verdictOfFindings(hallazgos)).toBe("BLOCK");
  });

  it("con solo avisos el veredicto es WARN", () => {
    const root = tempDir();
    write(root, "docs/specs/SPEC.md", "# S\n");
    write(root, "docs/proyecto/INDEX.md", "# I\n\n- [c](db/corto.md)\n");
    write(root, "docs/proyecto/db/corto.md", "# C\n\nOrigen: docs/specs/SPEC.md\n\npoco\n");

    expect(verdictOfFindings(verificar(disciplina("granular"), root))).toBe("WARN");
  });

  it("sin la carpeta de la parte no hay nada que comprobar (el artefacto ya dice lo que falta)", () => {
    const hallazgos = verificar(disciplina("requisitos"), tempDir());

    expect(hallazgos.map((f) => f.mensaje)).toEqual([
      expect.stringContaining("falta el artefacto"),
    ]);
  });

  it("solo actúa en las fases de la disciplina", () => {
    const root = tempDir();
    write(root, "docs/proyecto/INDEX.md", "# I\n\n- [roto](x.md)\n");

    expect(verificar(disciplina("granular", ["spec"]), root, "build" as never)).toEqual([]);
  });
});

describe("rutas de un módulo con verificación «documentos» (limitación L1)", () => {
  const registro = new DisciplineRegistry([disciplina("granular")]);

  it("remapear un artefacto de esa disciplina se rechaza con un mensaje claro", () => {
    const problemas = validateModuleOverrides(registro, {
      disciplinas: ["DOCS"],
      rutas: { "docs/proyecto/INDEX.md": "otra/INDEX.md" },
    });

    expect(problemas).toEqual([expect.stringMatching(/carpetas fijas/)]);
  });

  it("sin remapeos no hay ningún problema", () => {
    expect(validateModuleOverrides(registro, { disciplinas: ["DOCS"] })).toEqual([]);
  });
});
