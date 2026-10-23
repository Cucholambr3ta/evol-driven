import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { REPO } from "./helpers.js";

const SKILLS = join(REPO, "skills");
const NAMES = readdirSync(SKILLS).filter((n) => statSync(join(SKILLS, n)).isDirectory());

const read = (...parts: string[]): string => readFileSync(join(SKILLS, ...parts), "utf8");

function description(name: string): string {
  const match = /description:\s*>-\n((?: {2}.*\n)+)/.exec(read(name, "SKILL.md"));
  return (match?.[1] ?? "")
    .split("\n")
    .map((l) => l.trim())
    .join(" ")
    .trim();
}

function filesUnder(dir: string, base = ""): string[] {
  return readdirSync(join(dir, base)).flatMap((name) => {
    const rel = base ? `${base}/${name}` : name;
    return statSync(join(dir, rel)).isDirectory() ? filesUnder(dir, rel) : [rel];
  });
}

interface Case {
  description: string;
  prompts?: string[];
  vars?: Record<string, string>;
  assert?: { type: string; value?: string }[];
}

describe("las skills de la primera ola y sus evaluaciones", () => {
  it("son las trece previstas: las nueve disciplinas base y las cuatro de seguridad", () => {
    expect(NAMES.sort()).toEqual(
      [
        "atdd",
        "bdd",
        "ddd",
        "evaluar-skill",
        "fdd",
        "incorporar-dependencia",
        "incorporar-skill",
        "revisar-secretos",
        "sdd",
        "secdd",
        "stdd",
        "tdd",
        "threat",
      ].sort(),
    );
  });

  it.each(NAMES)(
    "«%s» no lleva scripts: solo SKILL.md y datos de evaluación (criterio 106)",
    (name) => {
      const files = filesUnder(join(SKILLS, name));
      expect(files.filter((f) => f !== "SKILL.md" && !/^evals\/[\w.-]+\.yaml$/.test(f))).toEqual(
        [],
      );
      expect(files).toContain("evals/casos.yaml");
      expect(files).toContain("evals/promptfooconfig.yaml");
    },
  );

  it.each(NAMES)(
    "«%s» tiene casos de los cuatro tipos, en la cantidad que pide evaluar-skill",
    (name) => {
      const cases = YAML.parse(read(name, "evals", "casos.yaml")) as Case[];
      const count = (kind: string): number =>
        cases.filter((c) => new RegExp(`^${kind} \\d+$`).test(c.description)).length;
      expect(count("activa")).toBeGreaterThanOrEqual(5);
      expect(count("no-activa")).toBeGreaterThanOrEqual(5);
      expect(count("inyeccion")).toBeGreaterThanOrEqual(3);
      expect(count("no-filtra")).toBeGreaterThanOrEqual(1);
      for (const c of cases) {
        expect(c.assert?.length, c.description).toBeGreaterThan(0);
        expect(c.prompts, c.description).toHaveLength(1);
      }
      // each activation case names this very skill; each no-activation case must not
      for (const c of cases.filter((x) => /^activa /.test(x.description)))
        expect(c.assert?.[0]?.value, c.description).toContain(name);
      for (const c of cases.filter((x) => /^no-activa /.test(x.description))) {
        expect(c.assert?.[0]).toMatchObject({ type: "not-regex" });
        // whole names only: «atdd» and «stdd» contain «tdd» and must not count as it
        const re = new RegExp(c.assert?.[0]?.value ?? "");
        expect(re.test(`la skill es ${name}.`), c.description).toBe(true);
        for (const other of NAMES.filter((n) => n !== name && n.includes(name)))
          expect(re.test(other), `${c.description} / ${other}`).toBe(false);
      }
    },
  );

  it.each(NAMES)(
    "«%s»: el enrutador de la evaluación lista las descripciones reales de todas las skills",
    (name) => {
      const config = YAML.parse(read(name, "evals", "promptfooconfig.yaml")) as {
        prompts: { label: string; raw: string }[];
      };
      const router = config.prompts.find((p) => p.label === "enrutador")?.raw ?? "";
      for (const other of NAMES)
        expect(router, `${name} → ${other}`).toContain(`- ${other}: ${description(other)}`);
    },
  );

  it.each(NAMES)(
    "«%s» los casos de inyección y de filtración no usan secretos con forma de clave real",
    (name) => {
      const text = read(name, "evals", "casos.yaml");
      expect(text).not.toMatch(/AKIA[0-9A-Z]{16}/);
      expect(text).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    },
  );

  it("incorporar-skill deja la aprobación a una persona (criterio 107)", () => {
    const text = read("incorporar-skill", "SKILL.md");
    expect(text).toMatch(/Nunca aprueba|nunca apruebes|no apruebes/i);
    expect(text).not.toMatch(/^\s*\d+\.\s+Ejecuta `evol skills approve/im);
  });

  it("incorporar-dependencia exige versión fija y archivo de bloqueo (criterio 108)", () => {
    const text = read("incorporar-dependencia", "SKILL.md").toLowerCase();
    expect(text).toContain("versión fija");
    expect(text).toContain("bloqueo");
  });
});
