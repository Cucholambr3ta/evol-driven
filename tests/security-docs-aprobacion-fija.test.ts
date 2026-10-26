import { relative } from "node:path";
import type * as Lectura from "../src/docs/lectura.js";
import { describe, expect, it, vi } from "vitest";
import { loadDisciplines } from "../src/core/disciplines.js";
import { matchFiles } from "../src/core/verify.js";
import { tempDir, writeValidArtifacts } from "./helpers.js";

const leidos: string[] = [];
vi.mock("../src/docs/lectura.js", async (importOriginal) => {
  const real = await importOriginal<typeof Lectura>();
  return {
    ...real,
    leerDocumento: (ruta: string, tope?: number) => {
      leidos.push(ruta);
      return real.leerDocumento(ruta, tope);
    },
  };
});

const { comprobarParte } = await import("../src/docs/check.js");
const registro = loadDisciplines();

describe("todo lo que lee un comprobador es un artefacto de su disciplina (CA-150, CA-157, CA-161, CA-167)", () => {
  // la aprobación fija el contenido de los artefactos: lo que un comprobador lee y no lo es podría
  // cambiar después de aprobar sin que la aprobación se invalide
  const conDocumentos = registro
    .all()
    .flatMap((d) =>
      d.verificaciones.flatMap((v) =>
        v.tipo === "documentos" ? [[d.id, v.comprobacion] as const] : [],
      ),
    );

  it("hay una disciplina por cada parte que se puede comprobar", () => {
    expect(conDocumentos.map(([, parte]) => parte).sort()).toEqual([
      "evidencia",
      "granular",
      "requisitos",
      "sprints",
    ]);
  });

  it.each(conDocumentos)(
    "%s: lo que lee «%s» está entre sus artefactos o entre los de SDD",
    (id, parte) => {
      const root = tempDir();
      writeValidArtifacts(root, id);
      leidos.length = 0;

      comprobarParte(parte, root);

      const permitidos = new Set(
        [id, "SDD"].flatMap((d) =>
          (registro.get(d)?.artefactos ?? []).flatMap((a) => matchFiles(a.patron, root)),
        ),
      );
      expect(leidos.length).toBeGreaterThan(0);
      for (const ruta of leidos) {
        const rel = relative(root, ruta);
        expect(permitidos.has(rel), `${id} lee ${rel}, que no es un artefacto suyo`).toBe(true);
      }
    },
  );
});
