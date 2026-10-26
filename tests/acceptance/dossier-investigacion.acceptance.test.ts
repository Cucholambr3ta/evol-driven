import { describe, expect, it } from "vitest";
import { cli, makeProject, makeProjectAt, write } from "../helpers.js";
import { DISC, FECHA, env, existe, indiceEvidencia, salida } from "./docs-fixtures.js";

const FUENTES: [string, string, string, string][] = [
  ["E-1", "https://example.org/a", FECHA, "hecho"],
  ["E-2", "https://example.org/b", FECHA, "supuesto"],
  ["E-3", "https://example.org/c", FECHA, "contradicción"],
];
const auditoria = (...citas: string[]): string =>
  `# Auditoría de hermes\n\nHallazgos con evidencia ${citas.map((c) => `[${c}]`).join(" ")}.\n`;

describe("dossier de investigación con índice de evidencia", () => {
  it("CA-157: un dossier consistente pasa la comprobación", () => {
    const root = makeProject(DISC);
    write(root, "investigacion/hermes/hermes-evidence-index.md", indiceEvidencia(FUENTES));
    write(root, "investigacion/hermes/hermes-audit.md", auditoria("E-1", "E-2", "E-3"));

    const r = cli(["docs", "evidencia"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status, salida(r)).toBe(0);
  });

  it("CA-158: una fuente sin fecha o con una clasificación inválida se nombra", () => {
    const root = makeProject(DISC);
    write(
      root,
      "investigacion/hermes/hermes-evidence-index.md",
      indiceEvidencia([
        ["E-1", "https://example.org/a", FECHA, "hecho"],
        ["E-2", "https://example.org/b", "", "hecho"],
        ["E-3", "https://example.org/c", FECHA, "quizás"],
      ]),
    );
    write(root, "investigacion/hermes/hermes-audit.md", auditoria("E-1", "E-2", "E-3"));

    const r = cli(["docs", "evidencia"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(salida(r)).toContain("E-2");
    expect(salida(r)).toContain("E-3");
    expect(salida(r)).not.toContain("E-1");
  });

  it("CA-159: una cita a una fuente que no existe se rechaza", () => {
    const root = makeProject(DISC);
    write(root, "investigacion/hermes/hermes-evidence-index.md", indiceEvidencia(FUENTES));
    write(root, "investigacion/hermes/hermes-audit.md", auditoria("E-1", "E-2", "E-3", "E-9"));

    const r = cli(["docs", "evidencia"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(salida(r)).toContain("E-9");
  });

  it("CA-160: sin índice de evidencia, la investigación no pasa el briefing", () => {
    const root = makeProjectAt("briefing", ["INVESTIGACION"]);
    write(root, "investigacion/hermes/hermes-audit.md", auditoria("E-1"));

    const verify = cli(["verify"], { cwd: root, env: env() });

    expect(verify.stdout).toMatch(/^BLOCK/m);
    expect(salida(verify)).toMatch(/índice de evidencia|evidence-index/i);
  });

  it("CA-160: con índice y auditoría consistentes, la investigación sí pasa", () => {
    const root = makeProjectAt("briefing", ["INVESTIGACION"]);
    write(root, "investigacion/hermes/hermes-evidence-index.md", indiceEvidencia(FUENTES));
    write(root, "investigacion/hermes/hermes-audit.md", auditoria("E-1", "E-2", "E-3"));

    const verify = cli(["verify"], { cwd: root, env: env() });

    expect(verify.stdout, salida(verify)).toMatch(/^PASS/m);
  });

  it("CA-160: la disciplina de investigación la aplica el analista", () => {
    const root = makeProject(DISC);

    const lista = cli(["disciplines", "list", "--json"], { cwd: root, env: env() });

    const filas = JSON.parse(lista.stdout) as { id: string; rol?: string }[];
    expect(filas.find((d) => d.id === "INVESTIGACION")?.rol).toBe("analista");
  });
});
