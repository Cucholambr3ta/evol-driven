import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import YAML from "yaml";
import {
  adapterById,
  detectIdes,
  IDE_IDS,
  OTHER_ADAPTERS,
  writeAdapterFiles,
  writeAgentsMd,
} from "../src/agents/adapters.js";
import { agentFilesComplete, DENY_RULES, writeAgentFiles } from "../src/agents/files.js";
import { orchestratorBody } from "../src/agents/orchestrator.js";
import { roleDescription } from "../src/agents/roles.js";
import { SUBAGENT_ROLES } from "../src/core/roles.js";
import { cli, isolateUserConfig, makeProject, tempDir, write } from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});
const env = (extra: Record<string, string> = {}): Record<string, string> => ({
  EVOL_CONFIG_DIR: userConfig,
  ...extra,
});

function frontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  return { data: YAML.parse(m?.[1] ?? "") as Record<string, unknown>, body: m?.[2] ?? "" };
}
const read = (root: string, rel: string): string => readFileSync(join(root, rel), "utf8");
describe("evol agents --ide: lo que se genera en cada IDE (criterio 67)", () => {
  it("Codex: la skill $evol y los subagentes en TOML", () => {
    const root = tempDir();
    const report = writeAdapterFiles(root, adapterById("codex")!);
    expect(report.created.sort()).toEqual([
      ".agents/skills/evol/SKILL.md",
      ".codex/agents/seguridad.toml",
      ".codex/agents/verificador.toml",
    ]);
    const skill = frontmatter(read(root, ".agents/skills/evol/SKILL.md"));
    expect(skill.data["name"]).toBe("evol");
    expect(skill.body).toContain(orchestratorBody());
  });

  it("Antigravity: el workflow /evol y subagentes de solo lectura", () => {
    const root = tempDir();
    const report = writeAdapterFiles(root, adapterById("antigravity")!);
    expect(report.created.sort()).toEqual([
      ".agents/agents/seguridad.md",
      ".agents/agents/verificador.md",
      ".agents/workflows/evol.md",
    ]);
    expect(frontmatter(read(root, ".agents/workflows/evol.md")).body).toContain(orchestratorBody());
    for (const role of SUBAGENT_ROLES) {
      const { data } = frontmatter(read(root, `.agents/agents/${role}.md`));
      expect(data["subagent"]).toBe(true);
      // read-only by construction: the only tools it is given are the ones that read
      expect(data["tools"]).toEqual(["view_file", "grep_search", "list_dir"]);
    }
  });

  it("OpenCode: el comando /evol con $ARGUMENTS y subagentes sin permiso para editar ni ejecutar", () => {
    const root = tempDir();
    const report = writeAdapterFiles(root, adapterById("opencode")!);
    expect(report.created.sort()).toEqual([
      ".opencode/agents/seguridad.md",
      ".opencode/agents/verificador.md",
      ".opencode/commands/evol.md",
    ]);
    const command = read(root, ".opencode/commands/evol.md");
    expect(command).toContain(orchestratorBody());
    expect(command).toContain("$ARGUMENTS");
    expect(frontmatter(command).data["agent"]).toBe("build");
    for (const role of SUBAGENT_ROLES) {
      const { data } = frontmatter(read(root, `.opencode/agents/${role}.md`));
      expect(data["mode"]).toBe("subagent");
      expect(data["permissions"]).toEqual([
        { action: "edit", resource: "*", effect: "deny" },
        { action: "shell", resource: "*", effect: "deny" },
      ]);
    }
  });

  it("Hermes: no genera archivos (sus subagentes se crean al ejecutar y su entrada está por confirmar)", () => {
    const root = tempDir();
    expect(adapterById("hermes")!.archivos()).toEqual([]);
    expect(writeAdapterFiles(root, adapterById("hermes")!).created).toEqual([]);
  });

  it("la descripción de cada rol sale de su skill en todos los IDE", () => {
    const root = tempDir();
    for (const a of OTHER_ADAPTERS) writeAdapterFiles(root, a);
    for (const role of SUBAGENT_ROLES) {
      for (const rel of [`.agents/agents/${role}.md`, `.opencode/agents/${role}.md`])
        expect(frontmatter(read(root, rel)).data["description"], rel).toBe(roleDescription(role));
    }
    const toml = read(root, ".codex/agents/seguridad.toml");
    expect(toml).toContain(`description = ${JSON.stringify(roleDescription("seguridad"))}`);
  });

  it("los envoltorios no llevan instrucciones propias, en ningún formato", () => {
    const root = tempDir();
    for (const a of OTHER_ADAPTERS) writeAdapterFiles(root, a);
    for (const role of SUBAGENT_ROLES) {
      const sentence = `Carga la skill \`${role}\` y haz la tarea que te pasen.`;
      for (const rel of [`.agents/agents/${role}.md`, `.opencode/agents/${role}.md`]) {
        const lines = frontmatter(read(root, rel))
          .body.split("\n")
          .map((l) => l.trim())
          .filter((l) => l !== "" && !l.startsWith("<!--"));
        expect(lines, rel).toEqual([sentence]);
      }
      expect(read(root, `.codex/agents/${role}.toml`)).toContain(
        `developer_instructions = ${JSON.stringify(sentence)}`,
      );
    }
  });

  const hasPython =
    spawnSync("python3", ["-c", "import tomllib"], { encoding: "utf8" }).status === 0;
  it.skipIf(!hasPython)("el TOML de Codex es TOML válido", () => {
    const root = tempDir();
    writeAdapterFiles(root, adapterById("codex")!);
    for (const role of SUBAGENT_ROLES) {
      const r = spawnSync(
        "python3",
        [
          "-c",
          "import sys,tomllib,json; print(json.dumps(tomllib.load(open(sys.argv[1],'rb'))))",
          join(root, `.codex/agents/${role}.toml`),
        ],
        { encoding: "utf8" },
      );
      expect(r.status, r.stderr).toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({
        name: role,
        description: roleDescription(role),
      });
    }
  });

  it("el frontmatter de todo lo generado es YAML válido, con textos entre comillas", () => {
    const root = tempDir();
    for (const a of OTHER_ADAPTERS) writeAdapterFiles(root, a);
    for (const rel of [
      ".agents/workflows/evol.md",
      ".opencode/commands/evol.md",
      ".agents/skills/evol/SKILL.md",
    ])
      expect(typeof frontmatter(read(root, rel)).data["description"], rel).toBe("string");
  });
});

describe("idempotencia y respeto a lo ajeno (criterios 23 y 67)", () => {
  it("una segunda ejecución no cambia nada", () => {
    const root = tempDir();
    for (const a of OTHER_ADAPTERS) writeAdapterFiles(root, a);
    writeAgentsMd(root);
    for (const a of OTHER_ADAPTERS) {
      const again = writeAdapterFiles(root, a);
      expect(again.created, a.id).toEqual([]);
      expect(again.updated, a.id).toEqual([]);
      expect(again.unchanged.length, a.id).toBe(a.archivos().length);
    }
    expect(writeAgentsMd(root).unchanged).toEqual(["AGENTS.md"]);
  });

  it("no pisa un archivo con el mismo nombre que no es de evol", () => {
    const root = tempDir();
    write(root, ".opencode/commands/evol.md", "mi comando\n");
    write(root, ".codex/agents/seguridad.toml", 'name = "mio"\n');
    for (const id of ["opencode", "codex"]) {
      const report = writeAdapterFiles(root, adapterById(id)!);
      expect(report.skipped.length, id).toBeGreaterThan(0);
    }
    expect(read(root, ".opencode/commands/evol.md")).toBe("mi comando\n");
    expect(read(root, ".codex/agents/seguridad.toml")).toBe('name = "mio"\n');
    expect(existsSync(join(root, ".codex/agents/verificador.toml"))).toBe(true);
  });

  it("AGENTS.md: solo se reescribe el bloque de evol, y lo de la persona se conserva", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "# Mis reglas\n\nUsa tabuladores.\n");
    writeAgentsMd(root);
    const first = read(root, "AGENTS.md");
    expect(first).toContain("Usa tabuladores.");
    expect(first).toContain("<!-- evol:begin -->");
    expect(first).toContain(
      "Aprobar (`evol approve`) y avanzar (`evol next`) lo hace siempre una persona",
    );
    expect(first).not.toMatch(/Fase actual|fase actual:/); // no project state in the instructions: Codex and OpenCode would read it stale
    writeFileSync(join(root, "AGENTS.md"), `${first}\nUna línea añadida después.\n`);
    writeAgentsMd(root);
    expect(read(root, "AGENTS.md")).toContain("Una línea añadida después.");
    expect(read(root, "AGENTS.md").match(/evol:begin/g)).toHaveLength(1);
  });

  it("no crea los archivos de configuración de la persona: los imprime como fragmento", () => {
    const root = makeProject(["FDD"]);
    const r = cli(["agents", "--ide", "all"], { cwd: root, env: env() });
    expect(r.status, r.stderr).toBe(0);
    for (const rel of [
      ".codex/config.toml",
      "opencode.json",
      ".agents/hooks.json",
      ".codex/rules/evol.rules",
    ])
      expect(existsSync(join(root, rel)), rel).toBe(false);
    expect(r.stdout).toContain("→ .codex/config.toml");
    expect(r.stdout).toContain("[mcp_servers.evol]");
    expect(r.stdout).toContain("~/.gemini/config/mcp_config.json");
    expect(r.stdout).toContain("→ opencode.json");
    expect(r.stdout).toContain("hermes mcp add evol");
    expect(r.stdout).toContain("evol no los edita");
    expect(r.stdout).toContain("no se instalan aquí");
  });
});

describe("evol agents --ide (criterio 67)", () => {
  it("sin --ide sigue siendo Claude Code, y no crea nada de los demás", () => {
    const root = makeProject(["FDD"]);
    const r = cli(["agents"], { cwd: root, env: env() });
    expect(r.stdout).toContain("Claude Code (nivel A; entrada: /evol)");
    expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(root, ".codex"))).toBe(false);
  });

  it("--ide all instala los cinco y es idempotente", () => {
    const root = makeProject(["FDD"]);
    const first = cli(["agents", "--ide", "all"], { cwd: root, env: env() });
    for (const rel of [
      ".claude/commands/evol.md",
      ".claude/agents/seguridad.md",
      "AGENTS.md",
      ".agents/skills/evol/SKILL.md",
      ".codex/agents/verificador.toml",
      ".agents/workflows/evol.md",
      ".agents/agents/seguridad.md",
      ".opencode/commands/evol.md",
      ".opencode/agents/verificador.md",
    ])
      expect(existsSync(join(root, rel)), rel).toBe(true);
    for (const nombre of ["Claude Code", "Codex", "Antigravity", "OpenCode", "Hermes"])
      expect(first.stdout).toContain(nombre);
    const second = cli(["agents", "--ide", "all"], { cwd: root, env: env() });
    expect(second.stdout).not.toMatch(/^\s+\+ /m);
    expect(second.stdout).not.toMatch(/\(actualizado\)/);
  });

  it("un IDE que no existe da un error claro", () => {
    const r = cli(["agents", "--ide", "emacs"], { cwd: makeProject(["FDD"]), env: env() });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("IDE desconocido «emacs»");
    expect(IDE_IDS).toContain("hermes");
  });

  it("Codex avisa de que sus subagentes solo son de solo lectura por instrucción", () => {
    const r = cli(["agents", "--ide", "codex"], { cwd: makeProject(["FDD"]), env: env() });
    expect(r.stdout).toContain("solo lo son por instrucción");
    const open = cli(["agents", "--ide", "opencode"], { cwd: makeProject(["FDD"]), env: env() });
    expect(open.stdout).not.toContain("solo lo son por instrucción");
  });
});

describe("Claude Code: la regla que impide aprobar y avanzar (criterio 69)", () => {
  it("instala permissions.deny para evol approve y evol next, sin quitar lo de la persona", () => {
    const root = tempDir();
    write(
      root,
      ".claude/settings.json",
      JSON.stringify({ permissions: { deny: ["Bash(rm -rf:*)"], allow: ["Bash(npm test)"] } }),
    );
    writeAgentFiles(root);
    const settings = JSON.parse(read(root, ".claude/settings.json")) as {
      permissions: { deny: string[]; allow: string[] };
    };
    expect(settings.permissions.deny).toEqual(["Bash(rm -rf:*)", ...DENY_RULES]);
    expect(settings.permissions.allow).toEqual(["Bash(npm test)"]);
    expect(DENY_RULES).toEqual(["Bash(evol approve:*)", "Bash(evol next:*)"]);
  });

  it("es idempotente y evol doctor avisa si falta", () => {
    const root = tempDir();
    writeAgentFiles(root);
    const second = writeAgentFiles(root);
    expect(second.updated).toEqual([]);
    expect(agentFilesComplete(root).ok).toBe(true);
    const settings = JSON.parse(read(root, ".claude/settings.json")) as Record<string, unknown>;
    delete settings["permissions"];
    writeFileSync(join(root, ".claude/settings.json"), JSON.stringify(settings));
    expect(agentFilesComplete(root).missing).toContain(".claude/settings.json (permissions.deny)");
  });
});

describe("evol doctor y los IDE detectados (criterio 72)", () => {
  it("detecta por el ejecutable o por la carpeta de configuración", () => {
    const home = tempDir("evol-home-");
    mkdirSync(join(home, ".codex"));
    const bin = tempDir("evol-bin-");
    writeFileSync(join(bin, "opencode"), "#!/bin/sh\n");
    chmodSync(join(bin, "opencode"), 0o755);
    const found = detectIdes(home, bin);
    expect(found.filter((d) => d.detectado).map((d) => d.id)).toEqual(["codex", "opencode"]);
    expect(found.find((d) => d.id === "codex")?.donde).toBe(join(home, ".codex"));
    expect(found.find((d) => d.id === "opencode")?.donde).toBe(join(bin, "opencode"));
    expect(found.every((d) => d.nivel === "A")).toBe(true);
  });

  it("evol doctor lista cada IDE detectado con su nivel, la entrada y la protección", () => {
    const home = tempDir("evol-home-");
    mkdirSync(join(home, ".codex"));
    mkdirSync(join(home, ".claude"));
    const root = makeProject(["FDD"]);
    const r = cli(["doctor"], {
      cwd: root,
      env: env({ HOME: home, PATH: tempDir("evol-bin-") }),
    });
    expect(r.stdout).toMatch(
      /IDE Codex: nivel A \(subagentes nativos\); entrada \$evol; subagentes de solo lectura solo por instrucción; bloqueo de aprobar parcial/,
    );
    expect(r.stdout).toMatch(
      /IDE Claude Code: nivel A.*entrada \/evol.*impuestos por el IDE; bloqueo de aprobar instalado/,
    );
    expect(r.stdout).not.toContain("IDE OpenCode");
  });

  it("avisa de lo que falta en el proyecto, y deja de avisar cuando evol agents lo crea", () => {
    const home = tempDir("evol-home-");
    mkdirSync(join(home, ".config", "opencode"), { recursive: true });
    const root = makeProject(["FDD"]);
    const doctor = () =>
      cli(["doctor"], { cwd: root, env: env({ HOME: home, PATH: tempDir("evol-bin-") }) }).stdout;
    expect(doctor()).toMatch(
      /! IDE OpenCode:.*falta \.opencode\/commands\/evol\.md.*evol agents --ide opencode lo crea/,
    );
    cli(["agents", "--ide", "opencode"], { cwd: root, env: env() });
    expect(doctor()).toMatch(/✓ IDE OpenCode:/);
  });

  it("sin ningún IDE lo dice", () => {
    const home = tempDir("evol-home-");
    const r = cli(["doctor"], { cwd: tempDir(), env: env({ HOME: home, PATH: "/nonexistent" }) });
    expect(r.stdout).toContain("! IDE de agentes: no se detectó ninguno");
  });
});
