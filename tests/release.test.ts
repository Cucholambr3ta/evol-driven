import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  changelogEntry,
  diffSkills,
  lastTag,
  release,
  signingProblem,
  RELEASE_FILE,
} from "../src/release/release.js";
import { tempDir, write } from "./helpers.js";
import { git, origin, skill } from "./release-helpers.js";

describe("evol release", () => {
  it("sube el número, escribe el changelog y el registro, guarda y firma la etiqueta", () => {
    const root = origin();
    write(root, "src/a.ts", "export const a = 1;\n");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "añade a");
    const r = release({ root, version: "0.3.0", ci: null, now: new Date("2026-10-23T12:00:00Z") });
    expect(r.etiqueta).toBe("v0.3.0");
    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version).toBe("0.3.0");
    expect(
      JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")).packages[""].version,
    ).toBe("0.3.0");
    const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
    expect(changelog).toContain("## 0.3.0 — 2026-10-23");
    expect(changelog).toContain("- añade a");
    expect(changelog).toContain("nueva: tdd");
    expect(JSON.parse(readFileSync(join(root, RELEASE_FILE), "utf8")).skills).toHaveProperty("tdd");
    expect(git(root, "log", "-1", "--pretty=%s").stdout.trim()).toBe("release: v0.3.0");
    expect(git(root, "status", "--porcelain").stdout.trim()).toBe("");
    // the tag is signed and verifies against the signers file
    const verify = git(root, "verify-tag", "v0.3.0");
    expect(verify.status, verify.stderr).toBe(0);
    expect(lastTag(root)).toBe("v0.3.0");
  });

  it("la siguiente versión cuenta las skills nuevas y las cambiadas desde la anterior", () => {
    const root = origin();
    release({ root, version: "0.3.0", ci: null });
    write(root, "skills/tdd/SKILL.md", skill("tdd", "Cambiada."));
    write(root, "skills/bdd/SKILL.md", skill("bdd"));
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "toca skills");
    const r = release({ root, version: "0.4.0", ci: null });
    expect(r.cambios).toEqual({ nuevas: ["bdd"], cambiadas: ["tdd"], quitadas: [] });
    const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
    expect(changelog.indexOf("## 0.4.0")).toBeLessThan(changelog.indexOf("## 0.3.0"));
    expect(changelog).toContain("cambiada (vuelve a «sin auditar»): tdd");
    // the 0.4.0 section only has what came after v0.3.0
    expect(
      changelog.slice(changelog.indexOf("## 0.4.0"), changelog.indexOf("## 0.3.0")),
    ).not.toContain("primer commit");
  });

  it("se niega con cambios sin guardar, con una versión no mayor, con una mal escrita o repetida", () => {
    const root = origin();
    write(root, "sin-guardar.txt", "x\n");
    expect(() => release({ root, version: "0.3.0", ci: null })).toThrow(/cambios sin guardar/);
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "x");
    expect(() => release({ root, version: "0.2.0", ci: null })).toThrow(/no es mayor/);
    expect(() => release({ root, version: "0.3", ci: null })).toThrow(/x\.y\.z/);
    release({ root, version: "0.3.0", ci: null });
    expect(() => release({ root, version: "0.3.0", ci: null })).toThrow();
  });

  it("sin clave de firma no publica nada y dice qué configurar", () => {
    const root = origin({ signing: false });
    const problem = signingProblem(root);
    expect(problem).toContain("git config gpg.format ssh");
    expect(() => release({ root, version: "0.3.0", ci: null })).toThrow(/clave de firma/);
    expect(git(root, "tag").stdout.trim()).toBe("");
    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version).toBe("0.2.0");
  });

  it("si la firma falla, deshace el commit y deja los archivos como estaban", () => {
    const root = origin();
    git(root, "config", "user.signingkey", join(tempDir(), "no-existe.pub"));
    const before = git(root, "rev-parse", "HEAD").stdout.trim();
    expect(() => release({ root, version: "0.3.0", ci: null })).toThrow(/No se pudo firmar/);
    expect(git(root, "rev-parse", "HEAD").stdout.trim()).toBe(before);
    expect(git(root, "status", "--porcelain").stdout.trim()).toBe("");
    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version).toBe("0.2.0");
    expect(existsSync(join(root, RELEASE_FILE))).toBe(false);
  });

  it("si el CI falla, no se publica nada", () => {
    const root = origin();
    expect(() => release({ root, version: "0.3.0", ci: ["false"] })).toThrow(/CI falló/);
    expect(git(root, "tag").stdout.trim()).toBe("");
    expect(git(root, "status", "--porcelain").stdout.trim()).toBe("");
  });

  it("changelogEntry y diffSkills por separado", () => {
    expect(diffSkills({ a: "1", b: "2" }, { a: "1", b: "3", c: "4" })).toEqual({
      nuevas: ["c"],
      cambiadas: ["b"],
      quitadas: [],
    });
    expect(diffSkills({ a: "1" }, {})).toEqual({ nuevas: [], cambiadas: [], quitadas: ["a"] });
    expect(
      changelogEntry("1.0.0", "2026-01-01", [], { nuevas: [], cambiadas: [], quitadas: [] }),
    ).toContain("sin cambios registrados");
  });
});
