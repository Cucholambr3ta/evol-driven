import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { OTHER_ADAPTERS, writeAdapterFiles } from "../src/agents/adapters.js";
import { orchestratorBody } from "../src/agents/orchestrator.js";
import { ROLES, SUBAGENT_ROLES } from "../src/core/roles.js";
import {
  CLI,
  cli,
  isolateUserConfig,
  makeProjectAt,
  tempDir,
  writeValidArtifacts,
} from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});
const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });
const SKILLS = join(process.cwd(), "skills");

describe("archivos generados por adaptador (criterio 67)", () => {
  it("cada archivo lleva la marca de evol, y nada del estado del proyecto", () => {
    const root = tempDir();
    for (const a of OTHER_ADAPTERS) writeAdapterFiles(root, a);
    for (const a of OTHER_ADAPTERS)
      for (const f of a.archivos()) {
        const text = readFileSync(join(root, f.rel), "utf8");
        expect(text, f.rel).toContain("evol:generated");
        expect(text, f.rel).not.toMatch(/Fase actual|fase actual:/);
      }
  });

  it("todo lo que un envoltorio manda cargar existe como skill", () => {
    const root = tempDir();
    for (const a of OTHER_ADAPTERS) writeAdapterFiles(root, a);
    const skills = new Set(readdirSync(SKILLS));
    expect(skills.has("evol")).toBe(true);
    for (const role of ROLES) expect(skills.has(role.id), role.id).toBe(true);
    for (const a of OTHER_ADAPTERS)
      for (const f of a.archivos()) {
        for (const m of readFileSync(join(root, f.rel), "utf8").matchAll(
          /Carga la skill `([^`]+)`/g,
        ))
          expect(skills.has(m[1] ?? ""), `${f.rel} → ${m[1]}`).toBe(true);
      }
  });

  it("los mismos roles en todos los IDE con subagentes, y el mismo cuerpo de orquestador", () => {
    const roles = (id: string): string[] =>
      OTHER_ADAPTERS.find((a) => a.id === id)!
        .archivos()
        .map((f) => /([a-z]+)\.(md|toml)$/.exec(f.rel)?.[1] ?? "")
        .filter((n) => (SUBAGENT_ROLES as readonly string[]).includes(n))
        .sort();
    for (const id of ["codex", "antigravity", "opencode"])
      expect(roles(id), id).toEqual([...SUBAGENT_ROLES].sort());
    const root = tempDir();
    for (const a of OTHER_ADAPTERS) writeAdapterFiles(root, a);
    for (const rel of [
      ".agents/skills/evol/SKILL.md",
      ".agents/workflows/evol.md",
      ".opencode/commands/evol.md",
    ])
      expect(readFileSync(join(root, rel), "utf8"), rel).toContain(orchestratorBody());
  });
});

describe("un IDE sin subagentes (criterio 68)", () => {
  it("la skill del orquestador y las de los roles dicen cómo seguir en línea", () => {
    for (const name of ["evol", "verificador", "seguridad"]) {
      const text = readFileSync(join(SKILLS, name, "SKILL.md"), "utf8");
      expect(text, name).toMatch(/Si el IDE no tiene|si el IDE no tiene|en línea/);
    }
  });

  // The orchestrator only ever reads the project through evol's own interface. A IDE with subagents
  // gets it through a read-only role that calls the MCP; one without subagents runs the same reads
  // in line, through the command line. Both must see exactly the same thing.
  const reads = [
    ["status", "--json"],
    ["prerequisites", "--json"],
    ["disciplines", "active", "--json"],
    ["verify", "--json"],
  ];

  it("en línea (CLI) y delegado (MCP) leen lo mismo del proyecto", async () => {
    const root = makeProjectAt("plan", ["SDD", "FDD"]);
    for (const id of ["SDD", "FDD"]) writeValidArtifacts(root, id);
    const inline = reads.map(
      (a) => JSON.parse(cli(a, { cwd: root, env: env() }).stdout) as unknown,
    );

    const client = new Client({ name: "sim", version: "0" }, { capabilities: {} });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ["--disable-warning=ExperimentalWarning", CLI, "mcp"],
        cwd: root,
        env: { ...(process.env as Record<string, string>), ...env() },
        stderr: "ignore",
      }),
    );
    try {
      const call = async (name: string): Promise<Record<string, unknown>> =>
        JSON.parse(
          ((await client.callTool({ name, arguments: {} })) as { content: { text: string }[] })
            .content[0]?.text ?? "{}",
        ) as Record<string, unknown>;
      const status = await call("evol_status");
      const verify = await call("evol_verify");
      const prereq = await call("evol_prerequisites");
      const disc = await call("evol_disciplines");
      const i = inline as Record<string, unknown>[];
      expect(status["fase"] ?? status["phase"]).toBe(i[0]?.["fase"] ?? i[0]?.["phase"]);
      expect(verify["veredicto"]).toBe(i[3]?.["veredicto"]);
      expect(verify["problemas"]).toEqual(i[3]?.["problemas"]);
      expect(prereq).toEqual(i[1]);
      expect(disc).toEqual(i[2]);
    } finally {
      await client.close();
    }
  });

  it("ninguna de esas lecturas cambia el proyecto, con o sin subagentes", () => {
    const root = makeProjectAt("plan", ["SDD", "FDD"]);
    for (const id of ["SDD", "FDD"]) writeValidArtifacts(root, id);
    const snapshot = (): string => JSON.stringify(walk(root));
    const before = snapshot();
    for (const a of reads) cli(a, { cwd: root, env: env() });
    expect(snapshot()).toBe(before);
    expect(existsSync(join(root, ".evol", "plan-interrogado.json"))).toBe(false);
  });
});

function walk(dir: string, base = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readdirSync(join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.name === ".git" || e.name === "node_modules") continue;
    if (e.isDirectory()) Object.assign(out, walk(dir, rel));
    else out[rel] = readFileSync(join(dir, rel), "utf8");
  }
  return out;
}
