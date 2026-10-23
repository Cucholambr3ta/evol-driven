import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO } from "./helpers.js";

interface Question {
  id: string;
  fuente: string;
  tipo: string;
  pregunta: string;
  esperado: { archivo: string; seccion: string };
}
interface Pilot {
  fuentes: Record<string, string>;
  tipos: Record<string, string>;
  preguntas: Question[];
}

const pilot = JSON.parse(
  readFileSync(join(REPO, "docs", "piloto-conocimiento", "preguntas.json"), "utf8"),
) as Pilot;

describe("las 30 preguntas del piloto R0", () => {
  it("son 30, con id único y todos los campos", () => {
    expect(pilot.preguntas).toHaveLength(30);
    expect(new Set(pilot.preguntas.map((q) => q.id)).size).toBe(30);
    for (const q of pilot.preguntas) {
      expect(q.pregunta.length, q.id).toBeGreaterThan(20);
      expect(q.esperado.archivo, q.id).not.toBe("");
      expect(q.esperado.seccion, q.id).not.toBe("");
      expect(Object.keys(pilot.fuentes), q.id).toContain(q.fuente);
      expect(Object.keys(pilot.tipos), q.id).toContain(q.tipo);
    }
  });

  it("están en español y cubren los tres tipos y las tres fuentes", () => {
    for (const q of pilot.preguntas) expect(q.pregunta, q.id).toMatch(/[¿?]|[áéíóúñ]/i);
    for (const tipo of Object.keys(pilot.tipos))
      expect(pilot.preguntas.filter((q) => q.tipo === tipo).length, tipo).toBeGreaterThanOrEqual(5);
    for (const fuente of Object.keys(pilot.fuentes))
      expect(
        pilot.preguntas.filter((q) => q.fuente === fuente).length,
        fuente,
      ).toBeGreaterThanOrEqual(9);
  });

  it("las fuentes llevan el commit en el id, para que el piloto se pueda repetir", () => {
    for (const id of Object.values(pilot.fuentes)) expect(id).toMatch(/-[0-9a-f]{7}$/);
  });
});
