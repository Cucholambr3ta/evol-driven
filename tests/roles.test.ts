import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { writeAgentFiles } from "../src/agents/files.js";
import { orchestratorBody } from "../src/agents/orchestrator.js";
import { loadDisciplines } from "../src/core/disciplines.js";
import { phaseDisciplines } from "../src/core/orchestration.js";
import { loadContext } from "../src/core/pipeline.js";
import {
  disciplinesOfRole,
  executionOf,
  ROLE_IDS,
  ROLES,
  SUBAGENT_ROLES,
} from "../src/core/roles.js";
import { readManifest } from "../src/skills/manifest.js";
import { makeProjectAt, REPO, tempDir, write } from "./helpers.js";

const registry = loadDisciplines();
const SKILLS = join(REPO, "skills");
const read = (...p: string[]): string => readFileSync(join(SKILLS, ...p), "utf8");

/** The split of the 35 disciplines among the six roles, as the specification's table gives it. */
const SPEC: Record<string, string[]> = {
  analista: ["A11yDD", "FDD", "INVESTIGACION", "REQDD", "SPRINTDD", "UDD", "UXDD"],
  arquitecto: [
    "ADD",
    "APIVDD",
    "DDD",
    "DeprecationDD",
    "EDA",
    "ESDD",
    "GRANULAR",
    "MDD",
    "ODD_API",
    "SDD",
  ],
  constructor: ["CDCDD", "DebtBudgetDD", "RDD", "TDD"],
  verificador: ["ATDD", "BDD", "CCDD", "CHAOS", "PDD"],
  seguridad: ["COMPLIANCE", "PrivacyDD", "SecDD", "STDD", "THREAT"],
  operaciones: ["IODD", "ODD_OBS", "PIPELINE", "SLO"],
};

function frontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  return { data: YAML.parse(m?.[1] ?? "") as Record<string, unknown>, body: m?.[2] ?? "" };
}

describe("los seis roles y las 35 disciplinas (criterio 76)", () => {
  it("cada disciplina la aplica exactamente un rol, y las de los seis roles suman 35", () => {
    const all = registry.all();
    expect(all).toHaveLength(35);
    for (const d of all) expect(ROLE_IDS, d.id).toContain(d.rol);
    const byRole = ROLE_IDS.map((r) => disciplinesOfRole(registry, r));
    expect(byRole.flat()).toHaveLength(35);
    expect(new Set(byRole.flat()).size).toBe(35);
    expect(byRole.map((x) => x.length)).toEqual([7, 10, 4, 5, 5, 4]);
  });

  it("el reparto es el de la especificación", () => {
    for (const role of ROLE_IDS)
      expect(disciplinesOfRole(registry, role), role).toEqual([...(SPEC[role] ?? [])].sort());
  });

  it("solo verificador y seguridad corren como subagentes", () => {
    expect(SUBAGENT_ROLES).toEqual(["verificador", "seguridad"]);
    expect(ROLES.filter((r) => r.ejecucion === "en-linea").map((r) => r.id)).toEqual([
      "analista",
      "arquitecto",
      "constructor",
      "operaciones",
    ]);
    expect(executionOf("seguridad")).toBe("subagente");
  });
});

describe("cada rol es una skill (criterio 73)", () => {
  it.each(ROLE_IDS)(
    "«%s» existe, está en el manifiesto con sus fases y declara las disciplinas que aplica",
    (role) => {
      expect(existsSync(join(SKILLS, role, "SKILL.md"))).toBe(true);
      const { data, body } = frontmatter(read(role, "SKILL.md"));
      expect(data["name"]).toBe(role);
      expect(readManifest(SKILLS).skills[role]?.fases.length).toBeGreaterThan(0);
      // the disciplines the skill says it applies are, exactly, the ones the definitions assign to it
      const section = /## Qué aplicas\n([\s\S]*?)\n## /.exec(body)?.[1] ?? "";
      const named = [...section.matchAll(/\*\*([A-Za-z0-9_]+)\*\*/g)].map((m) => m[1]);
      expect([...new Set(named)].sort(), role).toEqual([...(SPEC[role] ?? [])].sort());
    },
  );

  it("no sobra ninguna skill de rol ni falta ninguna", () => {
    const manifestRoles = Object.keys(readManifest(SKILLS).skills).filter((n) =>
      (ROLE_IDS as string[]).includes(n),
    );
    expect(manifestRoles.sort()).toEqual([...ROLE_IDS].sort());
    expect(readdirSync(SKILLS)).not.toContain("skill-auditor");
  });
});

describe("el frontmatter que se genera es YAML válido", () => {
  it("todos los comandos y agentes generados se leen, y description y argument-hint son texto", () => {
    const root = tempDir();
    writeAgentFiles(root);
    const files = [
      ...readdirSync(join(root, ".claude/commands")).map((f) => `.claude/commands/${f}`),
      ...readdirSync(join(root, ".claude/agents")).map((f) => `.claude/agents/${f}`),
    ];
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) {
      const { data } = frontmatter(readFileSync(join(root, f), "utf8"));
      expect(typeof data["description"], f).toBe("string");
      if ("argument-hint" in data) expect(typeof data["argument-hint"], f).toBe("string");
    }
  });
});

describe("los envoltorios de subagente (criterios 73 y 74)", () => {
  function generated() {
    const root = tempDir();
    writeAgentFiles(root);
    return root;
  }

  it("se generan solo para verificador y seguridad, a partir de su skill", () => {
    const root = generated();
    expect(readdirSync(join(root, ".claude/agents")).sort()).toEqual([
      "seguridad.md",
      "verificador.md",
    ]);
    for (const role of SUBAGENT_ROLES) {
      const wrapper = frontmatter(readFileSync(join(root, `.claude/agents/${role}.md`), "utf8"));
      const skill = frontmatter(read(role, "SKILL.md"));
      expect(wrapper.data["name"]).toBe(role);
      // what the role is has one author: the wrapper copies the skill's own description
      expect(wrapper.data["description"]).toBe(
        String(skill.data["description"]).replace(/\s+/g, " ").trim(),
      );
    }
  });

  it("no llevan instrucciones propias: solo dicen «carga la skill y haz la tarea»", () => {
    const root = generated();
    for (const role of SUBAGENT_ROLES) {
      const { body } = frontmatter(readFileSync(join(root, `.claude/agents/${role}.md`), "utf8"));
      const lines = body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l !== "" && !l.startsWith("<!--"));
      expect(lines).toEqual([`Carga la skill \`${role}\` y haz la tarea que te pasen.`]);
    }
  });

  it("son de solo lectura: solo herramientas que leen y el modo en que no se edita nada", () => {
    const root = generated();
    for (const role of SUBAGENT_ROLES) {
      const { data } = frontmatter(readFileSync(join(root, `.claude/agents/${role}.md`), "utf8"));
      const tools = String(data["tools"])
        .split(",")
        .map((t) => t.trim());
      expect(tools.sort()).toEqual(["Glob", "Grep", "Read"]);
      for (const writer of ["Bash", "Write", "Edit", "NotebookEdit"])
        expect(tools).not.toContain(writer);
      expect(data["permissionMode"]).toBe("plan");
    }
  });

  it("las skills de esos dos roles dicen que son de solo lectura y que no ejecutan ni cambian nada", () => {
    for (const role of SUBAGENT_ROLES) {
      const text = read(role, "SKILL.md");
      expect(text, role).toContain("subagente de solo lectura y con contexto limpio");
      expect(text, role).toContain("no ejecutas comandos y no cambias ningún archivo");
    }
  });

  it("son idempotentes y no pisan un agente que la persona ya tenía", () => {
    const root = tempDir();
    writeAgentFiles(root);
    const second = writeAgentFiles(root);
    expect(second.created).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.unchanged).toEqual(
      expect.arrayContaining([".claude/agents/seguridad.md", ".claude/agents/verificador.md"]),
    );

    const mine = tempDir();
    write(mine, ".claude/agents/seguridad.md", "mi propio agente\n");
    const report = writeAgentFiles(mine);
    expect(readFileSync(join(mine, ".claude/agents/seguridad.md"), "utf8")).toBe(
      "mi propio agente\n",
    );
    expect(report.skipped.some((s) => s.file.endsWith("agents/seguridad.md"))).toBe(true);
    expect(existsSync(join(mine, ".claude/agents/verificador.md"))).toBe(true);
  });
});

describe("el orquestador reparte por rol (criterios 68 y 74)", () => {
  it("evol_disciplines dice qué rol aplica cada disciplina y cómo corre", () => {
    const root = makeProjectAt("qa", ["SDD", "ATDD", "BDD", "SecDD"]);
    const report = phaseDisciplines(loadContext(root));
    expect(report.disciplinas.map((d) => [d.id, d.rol, d.ejecucion])).toEqual([
      ["SDD", "arquitecto", "en-linea"],
      ["ATDD", "verificador", "subagente"],
      ["BDD", "verificador", "subagente"],
      ["SecDD", "seguridad", "subagente"],
    ]);
  });

  it("el contrato delega la revisión a esos dos roles si hay subagentes y la hace en línea, avisando, si no", () => {
    const body = orchestratorBody();
    expect(body).toContain("`verificador` y `seguridad`");
    expect(body).toContain("delégales la revisión");
    expect(body).toContain("hazla en línea y avisa de que esa revisión perdió su independencia");
    // the work is the same wherever it runs: the roles are skills, loaded in line or by a subagent
    expect(body).toContain("carga la skill del rol y la de la disciplina");
  });
});
