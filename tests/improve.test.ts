import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { addImprovement, closeImprovement, readInbox } from "../src/improve/inbox.js";
import { instructionsBlock } from "../src/agents/adapters.js";
import { cli, isolateUserConfig, makeProject, tempDir } from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});
const file = (): string => join(tempDir("evol-buzon-"), "mejoras", "buzon.jsonl");
const base = { proyecto: "mi-app", versionEvol: "0.3.0" };

describe("buzón de mejoras", () => {
  it("anota con el proyecto y la versión, y empieza como pendiente", () => {
    const f = file();
    const a = addImprovement(
      { ...base, texto: "  evol status debería decir la rama  ", evidencia: "salida del comando" },
      f,
      new Date("2026-10-23T10:00:00Z"),
    );
    expect(a).toMatchObject({
      id: "m-001",
      estado: "pendiente",
      proyecto: "mi-app",
      versionEvol: "0.3.0",
      texto: "evol status debería decir la rama",
    });
    expect(addImprovement({ ...base, texto: "otra" }, f).id).toBe("m-002");
    expect(readInbox(f)).toHaveLength(2);
  });

  it("cerrar una mejora añade una línea y no reescribe la historia", () => {
    const f = file();
    addImprovement({ ...base, texto: "uno" }, f);
    addImprovement({ ...base, texto: "dos" }, f);
    const before = readFileSync(f, "utf8");
    const closed = closeImprovement("m-001", "hecha", "en la 0.4.0", f);
    expect(closed).toMatchObject({ estado: "hecha", nota: "en la 0.4.0" });
    expect(readFileSync(f, "utf8").startsWith(before)).toBe(true);
    const all = readInbox(f);
    expect(all.find((e) => e.id === "m-001")?.estado).toBe("hecha");
    expect(all.find((e) => e.id === "m-002")?.estado).toBe("pendiente");
    expect(() => closeImprovement("m-099", "hecha", undefined, f)).toThrow(/No hay ninguna mejora/);
  });

  it("rechaza una nota vacía o enorme, y una línea rota no tira el buzón", () => {
    const f = file();
    expect(() => addImprovement({ ...base, texto: "   " }, f)).toThrow(/en qué consiste/);
    expect(() => addImprovement({ ...base, texto: "x".repeat(2001) }, f)).toThrow(
      /demasiado larga/,
    );
    addImprovement({ ...base, texto: "buena" }, f);
    appendFileSync(f, "esto no es json\n");
    expect(readInbox(f)).toHaveLength(1);
  });

  it("evol mejora add/list/hecha desde un proyecto no cambia el proyecto", () => {
    const root = makeProject(["FDD"]);
    const env = { EVOL_CONFIG_DIR: userConfig };
    const before = cli(["status"], { cwd: root, env }).stdout;
    const add = cli(["mejora", "add", "el", "informe", "debería", "incluir", "la", "versión"], {
      cwd: root,
      env,
    });
    expect(add.status, add.stderr).toBe(0);
    expect(add.stdout).toContain("No se cambió nada");
    const list = cli(["mejora", "list"], { cwd: root, env });
    expect(list.stdout).toContain("el informe debería incluir la versión");
    expect(list.stdout).toMatch(/\(evol \d+\.\d+\.\d+\)/);
    expect(cli(["status"], { cwd: root, env }).stdout).toBe(before);
    const id = /(m-\d+)/.exec(list.stdout)?.[1] ?? "";
    expect(cli(["mejora", "hecha", id, "--nota", "listo"], { cwd: root, env }).status).toBe(0);
    expect(cli(["mejora", "list"], { cwd: root, env }).stdout).toContain(
      "No hay mejoras pendientes",
    );
    expect(cli(["mejora", "list", "--todas"], { cwd: root, env }).stdout).toContain("[hecha]");
    expect(cli(["mejora"], { cwd: root, env }).status).toBe(1);
  });
});

describe("el framework instalado no se modifica desde un proyecto", () => {
  it("las instrucciones de los agentes lo dicen y señalan el buzón", () => {
    const block = instructionsBlock();
    expect(block).toContain("No modifiques el framework evol desde este proyecto");
    expect(block).toContain('evol mejora add "…"');
  });

  it("la skill evol lo repite", () => {
    const text = readFileSync(join(process.cwd(), "skills/evol/SKILL.md"), "utf8");
    expect(text).toContain("No modificas el framework evol desde un proyecto");
  });
});
