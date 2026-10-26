import { describe, expect, it } from "vitest";
import { cli, isolateUserConfig, makeProject, tempDir, write } from "./helpers.js";

const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];
const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: isolateUserConfig() });
const salida = (r: { stdout: string; stderr: string }): string => r.stdout + r.stderr;
const cuerpo = Array.from({ length: 20 }, (_, i) => `Línea ${i}.`).join("\n");

function arbol(root: string): void {
  write(root, "docs/specs/SPEC.md", "# S\n");
  write(root, "docs/proyecto/db/a.md", `# A\n\nOrigen: docs/specs/SPEC.md\n\n${cuerpo}\n`);
  write(root, "docs/proyecto/INDEX.md", "# I\n\n- [a](db/a.md)\n");
}

describe("evol docs check", () => {
  it("sin ninguna carpeta de documentación dice que no hay nada que comprobar y termina bien", () => {
    const root = makeProject(DISC);

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(r.status, salida(r)).toBe(0);
    expect(r.stdout).toMatch(/nada que comprobar/i);
  });

  it("un árbol consistente termina bien y lo dice", () => {
    const root = makeProject(DISC);
    arbol(root);

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(r.status, salida(r)).toBe(0);
    expect(r.stdout).toMatch(/en orden/i);
  });

  it("un bloqueo sale con 1 y se marca con ×; un aviso con !", () => {
    const root = makeProject(DISC);
    arbol(root);
    write(root, "docs/proyecto/api/x.md", "# X\n\nOrigen: docs/specs/SPEC.md\n\ncorto\n");
    write(
      root,
      "docs/proyecto/INDEX.md",
      "# I\n\n- [a](db/a.md)\n- [x](api/x.md)\n- [r](rota.md)\n",
    );

    const r = cli(["docs", "check"], { cwd: root, env: env() });

    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^ {2}× docs\/proyecto\/INDEX\.md: .*rota\.md/m);
    expect(r.stdout).toMatch(/^ {2}! docs\/proyecto\/api\/x\.md: .*\(aviso\)/m);
  });

  it("--estricto convierte los avisos en fallo", () => {
    const root = makeProject(DISC);
    arbol(root);
    write(root, "docs/proyecto/db/a.md", "# A\n\nOrigen: docs/specs/SPEC.md\n\ncorto\n");

    const suave = cli(["docs", "check"], { cwd: root, env: env() });
    const estricto = cli(["docs", "check", "--estricto"], { cwd: root, env: env() });

    expect(suave.status).toBe(0);
    expect(estricto.status).toBe(1);
  });

  it("--json devuelve los hallazgos como datos, con sus niveles", () => {
    const root = makeProject(DISC);
    arbol(root);
    write(root, "docs/proyecto/db/a.md", "# A\n\nOrigen: docs/specs/SPEC.md\n\ncorto\n");

    const r = cli(["docs", "check", "--json"], { cwd: root, env: env() });

    const datos = JSON.parse(r.stdout) as {
      hallazgos: { modulo: string; archivo: string; mensaje: string; nivel: string }[];
      partes: string[];
    };
    expect(datos.partes).toEqual(["granular"]);
    expect(datos.hallazgos).toEqual([
      expect.objectContaining({ modulo: "app", archivo: "docs/proyecto/db/a.md", nivel: "aviso" }),
    ]);
  });

  it("no cita el contenido de los documentos", () => {
    const root = makeProject(DISC);
    arbol(root);
    write(root, "docs/proyecto/db/a.md", "# A\n\nCONTENIDO-SECRETO\n\ncorto\n");

    const r = cli(["docs", "check", "--json"], { cwd: root, env: env() });

    expect(salida(r)).not.toContain("CONTENIDO-SECRETO");
  });

  it("sin subcomando, o con uno que no existe, explica el uso y falla", () => {
    const root = makeProject(DISC);

    for (const args of [["docs"], ["docs", "inventado"]]) {
      const r = cli(args, { cwd: root, env: env() });
      expect(r.status, args.join(" ")).toBe(1);
      expect(salida(r)).toMatch(/Uso: evol docs/);
    }
  });

  it("fuera de un proyecto evol falla explicando por qué", () => {
    const r = cli(["docs", "check"], { cwd: tempDir(), env: env() });

    expect(r.status).toBe(1);
    expect(salida(r)).toMatch(/proyecto/i);
  });
});

describe("evol docs evidencia", () => {
  const indice =
    "# I\n\n| ID | Fuente | Consultada | Clasificación | Afirma |\n| --- | --- | --- | --- | --- |\n| E-1 | https://example.org | 2026-10-20 | hecho | algo |\n";

  it("sin carpeta investigacion/ dice que no hay nada que comprobar y termina bien", () => {
    const r = cli(["docs", "evidencia"], { cwd: makeProject(DISC), env: env() });

    expect(r.status, salida(r)).toBe(0);
    expect(r.stdout).toMatch(/nada que comprobar/i);
  });

  it("un dossier consistente termina bien y un defecto sale con 1 nombrando la fuente", () => {
    const root = makeProject(DISC);
    write(root, "investigacion/t/t-evidence-index.md", indice);
    write(root, "investigacion/t/a.md", "# A\n\nDice [E-1].\n");
    const bien = cli(["docs", "evidencia"], { cwd: root, env: env() });
    write(root, "investigacion/t/a.md", "# A\n\nDice [E-1] y [E-7].\n");
    const mal = cli(["docs", "evidencia"], { cwd: root, env: env() });

    expect(bien.status, salida(bien)).toBe(0);
    expect(bien.stdout).toMatch(/en orden/i);
    expect(mal.status).toBe(1);
    expect(mal.stdout).toMatch(/^ {2}× investigacion\/t\/a\.md: .*E-7/m);
  });

  it("solo comprueba los dossiers: un árbol de dominio roto no cuenta, pero docs check lo ve todo", () => {
    const root = makeProject(DISC);
    write(root, "investigacion/t/t-evidence-index.md", indice);
    write(root, "investigacion/t/a.md", "# A\n\n[E-1]\n");
    write(root, "docs/proyecto/INDEX.md", "# I\n\n- [roto](db/x.md)\n");

    const solo = cli(["docs", "evidencia"], { cwd: root, env: env() });
    const todo = cli(["docs", "check"], { cwd: root, env: env() });

    expect(solo.status, salida(solo)).toBe(0);
    expect(todo.status).toBe(1);
  });

  it("--estricto hace fallar un aviso (una fuente que nadie cita); sin él solo se avisa", () => {
    const root = makeProject(DISC);
    write(root, "investigacion/t/t-evidence-index.md", indice);
    write(root, "investigacion/t/a.md", "# A\n\nNo cita nada.\n");

    const suave = cli(["docs", "evidencia"], { cwd: root, env: env() });
    const estricto = cli(["docs", "evidencia", "--estricto"], { cwd: root, env: env() });

    expect(suave.status, salida(suave)).toBe(0);
    expect(suave.stdout).toMatch(/^ {2}! .*E-1.*\(aviso\)/m);
    expect(estricto.status).toBe(1);
  });

  it("--json devuelve las partes y los hallazgos", () => {
    const root = makeProject(DISC);
    write(root, "investigacion/t/t-evidence-index.md", indice);
    write(root, "investigacion/t/a.md", "# A\n\n[E-1] [E-2]\n");

    const r = cli(["docs", "evidencia", "--json"], { cwd: root, env: env() });

    const datos = JSON.parse(r.stdout) as {
      partes: string[];
      hallazgos: { archivo: string; nivel: string }[];
    };
    expect(datos.partes).toEqual(["evidencia"]);
    expect(datos.hallazgos).toEqual([
      expect.objectContaining({ archivo: "investigacion/t/a.md", nivel: "bloqueo" }),
    ]);
  });
});
