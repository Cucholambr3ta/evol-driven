import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BackupCollector, listBackups, readBackup, restoreBackup } from "../src/agents/backup.js";
import { tempDir, write } from "./helpers.js";

describe("BackupCollector (criterio 133)", () => {
  it("no escribe nada hasta save(), y save() devuelve null sin capturas", () => {
    const root = tempDir();
    const c = new BackupCollector();
    expect(c.empty).toBe(true);
    expect(c.save(root)).toBeNull();
    expect(listBackups(root)).toEqual([]);
  });

  it("guarda el contenido anterior de un archivo que existía, y nada del que no existía", () => {
    const root = tempDir();
    write(root, "CLAUDE.md", "original\n");
    const c = new BackupCollector();
    c.capture("CLAUDE.md", Buffer.from("original\n"), true, "nuevo\n");
    c.capture(".claude/commands/evol.md", undefined, false, "contenido\n");
    const id = c.save(root);
    expect(id).not.toBeNull();
    expect(listBackups(root)).toEqual([id]);

    const manifest = readBackup(root, id!);
    expect(manifest.entradas).toHaveLength(2);
    const claudeMd = manifest.entradas.find((e) => e.rel === "CLAUDE.md")!;
    expect(claudeMd.existia).toBe(true);
    expect(Buffer.from(claudeMd.antesBase64!, "base64").toString()).toBe("original\n");
    const comando = manifest.entradas.find((e) => e.rel === ".claude/commands/evol.md")!;
    expect(comando.existia).toBe(false);
    expect(comando.antesBase64).toBeUndefined();
  });

  it("conserva como mucho 10 copias", () => {
    const root = tempDir();
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      const c = new BackupCollector();
      c.capture("x.md", undefined, false, `v${i}\n`);
      ids.push(c.save(root)!);
    }
    expect(listBackups(root)).toHaveLength(10);
    expect(listBackups(root)).toEqual(ids.slice(2));
  });
});

describe("restoreBackup (criterio 133)", () => {
  it("devuelve exactamente lo que había antes de la última escritura", () => {
    const root = tempDir();
    write(root, "CLAUDE.md", "original\n");
    const c = new BackupCollector();
    c.capture("CLAUDE.md", Buffer.from("original\n"), true, "nuevo\n");
    writeFileSync(join(root, "CLAUDE.md"), "nuevo\n");
    c.save(root);

    const result = restoreBackup(root);

    expect(result.restaurados).toEqual(["CLAUDE.md"]);
    expect(result.manual).toEqual([]);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toBe("original\n");
  });

  it("borra un archivo que evol creó de cero", () => {
    const root = tempDir();
    const c = new BackupCollector();
    c.capture(".claude/commands/evol.md", undefined, false, "contenido\n");
    mkdirSync(join(root, ".claude", "commands"), { recursive: true });
    writeFileSync(join(root, ".claude", "commands", "evol.md"), "contenido\n");
    c.save(root);

    const result = restoreBackup(root);

    expect(result.restaurados).toEqual([".claude/commands/evol.md"]);
    expect(() => readFileSync(join(root, ".claude", "commands", "evol.md"))).toThrow();
  });

  it("no pisa un archivo que la persona editó después de que evol lo escribiera", () => {
    const root = tempDir();
    write(root, "CLAUDE.md", "original\n");
    const c = new BackupCollector();
    c.capture("CLAUDE.md", Buffer.from("original\n"), true, "nuevo\n");
    writeFileSync(join(root, "CLAUDE.md"), "nuevo\n");
    c.save(root);
    // la persona edita lo que evol escribió
    writeFileSync(join(root, "CLAUDE.md"), "nuevo\n\n## mi nota\n");

    const result = restoreBackup(root);

    expect(result.manual).toEqual(["CLAUDE.md"]);
    expect(result.restaurados).toEqual([]);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toBe("nuevo\n\n## mi nota\n");
  });

  it("sin copias, se niega con un mensaje claro", () => {
    const root = tempDir();
    expect(() => restoreBackup(root)).toThrow(/ninguna copia/);
  });
});
