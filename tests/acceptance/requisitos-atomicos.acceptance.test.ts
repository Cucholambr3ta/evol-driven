import { describe, expect, it } from "vitest";
import { cli, makeProject, write } from "../helpers.js";
import { DISC, env, existe, lineaDe, salida } from "./docs-fixtures.js";

const NFR_CABECERA =
  "| ID | Requisito | Métrica | Umbral | Validación |\n| --- | --- | --- | --- | --- |";
const limitacion = (id: string, ...campos: string[]): string =>
  `### ${id} Una limitación\n\n${campos.join("\n")}\n`;

describe("requisitos no funcionales, limitaciones y glosario", () => {
  it("CA-161: un requisito no funcional sin umbral o sin validación se nombra", () => {
    const root = makeProject(DISC);
    write(
      root,
      "docs/requisitos/NO_FUNCIONALES.md",
      [
        "# Requisitos no funcionales",
        "",
        NFR_CABECERA,
        "| NFR-01 | Arranque | segundos | < 5 | `time evol doctor` |",
        "| NFR-02 | Memoria | MB |  | `ps` |",
        "| NFR-03 | Latencia | ms | < 200 |  |",
        "| NFR-04 | Disponibilidad |  | 99 % | `curl` |",
        "| NFR-05 |  | ms | < 1 | `curl` |",
        "",
      ].join("\n"),
    );

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(lineaDe(r, "NFR-02")).toMatch(/umbral/i);
    expect(lineaDe(r, "NFR-03")).toMatch(/validaci/i);
    expect(lineaDe(r, "NFR-04")).toMatch(/métrica/i);
    expect(lineaDe(r, "NFR-05")).toMatch(/requisito/i);
    expect(salida(r)).not.toContain("NFR-01");
  });

  it("CA-162: una limitación a la que le falta un campo se nombra", () => {
    const root = makeProject(DISC);
    write(
      root,
      "docs/requisitos/RESTRICCIONES.md",
      [
        "# Restricciones",
        "",
        "## Limitaciones conocidas",
        "",
        limitacion("L01", "Razón: no hay red.", "Impacto: sin aviso.", "Roadmap: ciclo 3."),
        limitacion("L02", "Razón: costo.", "Roadmap: ciclo 4."),
      ].join("\n"),
    );

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(lineaDe(r, "L02")).toContain("Impacto");
    expect(lineaDe(r, "L02")).not.toMatch(/Raz[oó]n|Roadmap/);
    expect(salida(r)).not.toContain("L01");
  });

  it("CA-163: un término definido dos veces en el glosario se rechaza", () => {
    const root = makeProject(DISC);
    write(
      root,
      "docs/requisitos/GLOSARIO.md",
      "# Glosario\n\n### Gate\n\nPunto de control.\n\n### Ciclo\n\nUna pasada.\n\n### Gate\n\nOtra vez.\n",
    );

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(existe(r), salida(r)).toBe(true);
    expect(r.status).not.toBe(0);
    expect(salida(r)).toContain("Gate");
    expect(salida(r)).not.toContain("Ciclo");
  });

  it("CA-164: la disciplina de requisitos la aplica el analista en spec", () => {
    const root = makeProject(DISC);

    const r = cli(["disciplines", "list", "--json"], { cwd: root, env: env() });

    const filas = JSON.parse(r.stdout) as { id: string; rol?: string; fases: string[] }[];
    const reqdd = filas.find((d) => d.id === "REQDD");
    expect(reqdd?.rol).toBe("analista");
    expect(reqdd?.fases).toContain("spec");
  });
});
