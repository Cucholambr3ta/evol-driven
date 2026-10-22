import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { checkLessons, readLessons } from "../src/core/lessons.js";
import type { MemoryHit } from "../src/memory/mempalace.js";
import { REPO, cli, isolateUserConfig, makeProject, tempDir, write } from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

const FAKE = join(REPO, "tests", "fixtures", "fake-mempalace.mjs");
const LESSON_TITLE = "Probar migraciones";
const LESSON_TEXT = "con datos reales antes de desplegar";

function hit(id: string, wing: string, score: number | undefined, text = "x"): MemoryHit {
  return { id, wing, room: "lecciones", text, ...(score === undefined ? {} : { score }) };
}

describe("lecciones.md", () => {
  it("lee cada sección ### con su texto y quita la fecha del título", () => {
    const root = tempDir();
    write(
      root,
      "lecciones.md",
      `# Lecciones\n\n### Probar migraciones — 2026-10-01\n\ncon datos reales\n\n### Otra\n\nsegunda\nlínea\n`,
    );
    expect(readLessons(root)).toEqual([
      { titulo: "Probar migraciones", texto: "con datos reales" },
      { titulo: "Otra", texto: "segunda\nlínea" },
    ]);
  });

  it("sin archivo no hay lecciones", () => {
    expect(readLessons(tempDir())).toEqual([]);
  });
});

describe("checkLessons", () => {
  const lesson = { titulo: LESSON_TITLE, texto: LESSON_TEXT };

  it("descarta el propio wing, lo poco parecido y lo que no tiene puntuación; ordena y quita duplicados", async () => {
    const [match] = await checkLessons(
      [lesson],
      () =>
        Promise.resolve([
          hit("1", "propio", 0.99),
          hit("2", "otro_b", 0.8),
          hit("3", "otro_c", 0.95),
          hit("3", "otro_c", 0.95),
          hit("4", "otro_d", 0.4),
          hit("5", "otro_e", undefined),
        ]),
      { ownWing: "propio" },
    );
    expect(match?.repetidas.map((r) => [r.wing, r.score])).toEqual([
      ["otro_c", 0.95],
      ["otro_b", 0.8],
    ]);
  });

  it("respeta el umbral indicado y recorta la consulta a 250 caracteres", async () => {
    const queries: string[] = [];
    const matches = await checkLessons(
      [{ titulo: "t", texto: "palabra ".repeat(100) }],
      (query) => {
        queries.push(query);
        return Promise.resolve([hit("1", "otro", 0.5)]);
      },
      { ownWing: "propio", threshold: 0.4 },
    );
    expect(queries[0]).toHaveLength(250);
    expect(matches[0]?.repetidas).toHaveLength(1);
  });
});

describe("evol lessons check (criterio 35)", () => {
  function setup() {
    const root = makeProject(["SDD"], { memory: { wing: "proyecto_a", enabled: false } });
    write(
      root,
      "lecciones.md",
      `# Lecciones\n\n### ${LESSON_TITLE} — 2026-10-01\n\n${LESSON_TEXT}\n`,
    );
    const dir = tempDir("evol-fake-palace-");
    const data = join(dir, "drawers.json");
    const log = join(dir, "calls.log");
    const drawers = [
      {
        id: "a1",
        wing: "proyecto_a",
        room: "lecciones",
        text: `${LESSON_TITLE}\n\n${LESSON_TEXT}`,
      },
      {
        id: "b1",
        wing: "proyecto_b",
        room: "lecciones",
        text: `${LESSON_TITLE}\n\n${LESSON_TEXT}`,
      },
      {
        id: "c1",
        wing: "proyecto_c",
        room: "lecciones",
        text: "Revisar los permisos del servidor",
      },
      {
        id: "d1",
        wing: "proyecto_d",
        room: "decisiones",
        text: `${LESSON_TITLE}\n\n${LESSON_TEXT}`,
      },
    ];
    write(dir, "drawers.json", JSON.stringify(drawers));
    const env = {
      EVOL_CONFIG_DIR: userConfig,
      EVOL_MEMPALACE_CMD: `${process.execPath} ${FAKE}`,
      FAKE_MEMPALACE_DATA: data,
      FAKE_MEMPALACE_LOG: log,
    };
    return { root, env, log };
  }

  it("detecta una lección que ya aprendió otro proyecto", () => {
    const { root, env } = setup();
    const r = cli(["lessons", "check"], { cwd: root, env });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain(`✗ ${LESSON_TITLE}`);
    expect(r.stdout).toContain("[proyecto_b]");
    expect(r.stdout).not.toContain("[proyecto_a]");
    expect(r.stdout).not.toContain("[proyecto_c]");
    expect(r.stdout).not.toContain("[proyecto_d]");
  });

  it("busca en todos los wings, solo en la sala de lecciones", () => {
    const { root, env, log } = setup();
    cli(["lessons", "check"], { cwd: root, env });
    const call = JSON.parse(readFileSync(log, "utf8").trim().split("\n")[0] ?? "{}");
    expect(call.room).toBe("lecciones");
    expect(call.wing).toBeUndefined();
  });

  it("--estricto sale con 1 si hay repetidas y --json imprime el resultado", () => {
    const { root, env } = setup();
    const r = cli(["lessons", "check", "--estricto", "--json"], { cwd: root, env });
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)[0].repetidas[0].wing).toBe("proyecto_b");
  });

  it("una lección distinta a las de los demás proyectos no sale como repetida", () => {
    const { root, env } = setup();
    write(
      root,
      "lecciones.md",
      `# L\n\n### Revisar logs\n\nmirar los registros del servidor cada día\n`,
    );
    const r = cli(["lessons", "check", "--estricto"], { cwd: root, env });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Ninguna lección se repite");
  });

  it("sin MemPalace falla con un mensaje claro", () => {
    const { root } = setup();
    const r = cli(["lessons", "check"], {
      cwd: root,
      env: { EVOL_CONFIG_DIR: userConfig, EVOL_MEMPALACE_CMD: "evol-test-no-such-command" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("No se pudo usar MemPalace");
    expect(r.stderr).toContain("uv tool install mempalace");
  });

  it("sin lecciones no necesita MemPalace", () => {
    const root = makeProject(["SDD"]);
    const r = cli(["lessons", "check"], {
      cwd: root,
      env: { EVOL_CONFIG_DIR: userConfig, EVOL_MEMPALACE_CMD: "evol-test-no-such-command" },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("No hay lecciones");
  });

  it("rechaza un umbral o una subcomanda inválidos", () => {
    const root = makeProject(["SDD"]);
    const env = { EVOL_CONFIG_DIR: userConfig };
    expect(cli(["lessons", "check", "--umbral", "2"], { cwd: root, env }).status).toBe(1);
    expect(cli(["lessons"], { cwd: root, env }).status).toBe(1);
  });
});
