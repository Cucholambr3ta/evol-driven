import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  agentFilesComplete,
  formatJson,
  HOOK_COMMAND,
  writeAgentFiles,
} from "../src/agents/files.js";
import {
  cli,
  isolateUserConfig,
  legacyProject,
  makeProject,
  REPO,
  tempDir,
  write,
} from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

const env = (): Record<string, string> => ({ EVOL_CONFIG_DIR: userConfig });
const ALL = [
  ".claude/commands/evol.md",
  ".claude/commands/evol-status.md",
  ".claude/commands/evol-fase.md",
  ".claude/commands/evol-impacto.md",
  ".claude/commands/evol-memoria.md",
  "CLAUDE.md",
  ".mcp.json",
  ".claude/settings.json",
];

describe("archivos para agentes (criterio 23)", () => {
  it("crea todo en un proyecto limpio", () => {
    const root = tempDir();
    const report = writeAgentFiles(root);
    expect(report.created.sort()).toEqual([...ALL].sort());
    for (const f of ALL) expect(existsSync(join(root, f)), f).toBe(true);
    expect(agentFilesComplete(root)).toEqual({ ok: true, missing: [] });
  });

  it("es idempotente: la segunda vez todo queda igual", () => {
    const root = tempDir();
    writeAgentFiles(root);
    const second = writeAgentFiles(root);
    expect(second.created).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.unchanged.sort()).toEqual([...ALL].sort());
  });

  it("los comandos /evol-* nunca piden aprobar ni avanzar", () => {
    const root = tempDir();
    writeAgentFiles(root);
    for (const name of ["status", "fase", "impacto", "memoria"]) {
      const text = readFileSync(join(root, `.claude/commands/evol-${name}.md`), "utf8");
      expect(text.startsWith("---\ndescription:")).toBe(true);
      expect(text).not.toMatch(/ejecuta `evol (approve|next)/i);
    }
    expect(readFileSync(join(root, ".claude/commands/evol-fase.md"), "utf8")).toContain(
      "$ARGUMENTS",
    );
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toContain("lo hace siempre una persona");
  });

  it("CLAUDE.md: añade su bloque sin tocar lo del usuario y lo refresca sin duplicarlo", () => {
    const root = tempDir();
    write(root, "CLAUDE.md", "# Mío\n\nNo usar any.\n");
    writeAgentFiles(root);
    const first = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(first.startsWith("# Mío\n\nNo usar any.")).toBe(true);
    expect(first.match(/<!-- evol:begin -->/g)).toHaveLength(1);

    // Si el bloque se desactualiza, se reemplaza y lo del usuario sigue ahí.
    writeFileSync(
      join(root, "CLAUDE.md"),
      first.replace("## Flujo de trabajo con evol", "## Texto viejo") + "\nUna regla posterior.\n",
    );
    const report = writeAgentFiles(root);
    expect(report.updated).toContain("CLAUDE.md");
    const refreshed = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(refreshed).toContain("## Flujo de trabajo con evol");
    expect(refreshed).not.toContain("Texto viejo");
    expect(refreshed).toContain("No usar any.");
    expect(refreshed).toContain("Una regla posterior.");
    expect(refreshed.match(/<!-- evol:begin -->/g)).toHaveLength(1);
  });

  it("no pisa un comando propio del usuario con el mismo nombre", () => {
    const root = tempDir();
    write(root, ".claude/commands/evol-status.md", "Mi comando personalizado\n");
    const report = writeAgentFiles(root);
    expect(readFileSync(join(root, ".claude/commands/evol-status.md"), "utf8")).toBe(
      "Mi comando personalizado\n",
    );
    expect(report.skipped.map((s) => s.file)).toContain(".claude/commands/evol-status.md");
  });

  it("settings.json: fusiona el hook sin duplicarlo ni perder lo demás", () => {
    const root = legacyProject();
    writeAgentFiles(root);
    writeAgentFiles(root);
    const settings = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8")) as {
      permissions: unknown;
      hooks: { SessionStart: { hooks: { command: string }[] }[] };
    };
    const commands = settings.hooks.SessionStart.flatMap((e) => e.hooks.map((h) => h.command));
    expect(commands.filter((c) => c === HOOK_COMMAND)).toHaveLength(1);
    expect(commands).toContain("echo hola");
    expect(settings.permissions).toEqual({ allow: ["Bash(npm test)"] });
  });

  it(".mcp.json: añade el servidor evol y conserva los demás; no pisa uno propio", () => {
    const root = tempDir();
    write(root, ".mcp.json", '{ "mcpServers": { "otro": { "command": "otro" } } }');
    writeAgentFiles(root);
    const servers = (
      JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8")) as {
        mcpServers: Record<string, unknown>;
      }
    ).mcpServers;
    expect(servers["otro"]).toEqual({ command: "otro" });
    expect(servers["evol"]).toEqual({ command: "evol", args: ["mcp"] });

    const custom = tempDir();
    write(
      custom,
      ".mcp.json",
      '{ "mcpServers": { "evol": { "command": "node", "args": ["mio.js"] } } }',
    );
    writeAgentFiles(custom);
    expect(JSON.parse(readFileSync(join(custom, ".mcp.json"), "utf8"))).toEqual({
      mcpServers: { evol: { command: "node", args: ["mio.js"] } },
    });
  });

  it("un JSON inválido no se toca y se avisa", () => {
    const root = tempDir();
    write(root, ".claude/settings.json", "{ esto no es json");
    write(root, ".mcp.json", "[1, 2]");
    const report = writeAgentFiles(root);
    expect(readFileSync(join(root, ".claude/settings.json"), "utf8")).toBe("{ esto no es json");
    expect(readFileSync(join(root, ".mcp.json"), "utf8")).toBe("[1, 2]");
    expect(report.skipped.map((s) => s.file).sort()).toEqual([
      ".claude/settings.json",
      ".mcp.json",
    ]);
  });

  it("agentFilesComplete dice qué falta", () => {
    const root = tempDir();
    writeAgentFiles(root);
    writeFileSync(join(root, ".mcp.json"), "{}");
    const state = agentFilesComplete(root);
    expect(state.ok).toBe(false);
    expect(state.missing).toEqual([".mcp.json (servidor evol)"]);
  });
});

describe("comandos que los generan", () => {
  it("evol new los crea y --no-agentes los omite", () => {
    const parent = tempDir();
    expect(
      cli(["new", "con", "--dir", parent, "--no-install", "--no-memory"], {
        cwd: parent,
        env: env(),
      }).status,
    ).toBe(0);
    expect(existsSync(join(parent, "con", ".claude/commands/evol-fase.md"))).toBe(true);
    expect(existsSync(join(parent, "con", ".mcp.json"))).toBe(true);
    expect(
      cli(["new", "sin", "--dir", parent, "--no-install", "--no-memory", "--no-agentes"], {
        cwd: parent,
        env: env(),
      }).status,
    ).toBe(0);
    expect(existsSync(join(parent, "sin", ".claude"))).toBe(false);
    expect(existsSync(join(parent, "sin", "CLAUDE.md"))).toBe(false);
  });

  it("evol agents los refresca y doctor avisa si faltan", () => {
    const root = makeProject(["FDD"]);
    const doctor = () =>
      cli(["doctor"], {
        cwd: root,
        env: { ...env(), EVOL_MEMPALACE_CMD: "evol-test-no-such-command" },
      });
    expect(doctor().stdout).toContain("! Integración con agentes: falta");
    const r = cli(["agents"], { cwd: root, env: env() });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("hermes mcp add evol");
    expect(doctor().stdout).toContain("✓ Integración con agentes: completa");
  });
});

describe("evol hook session-start (criterio 24)", () => {
  it("imprime el estado del proyecto y la regla de que aprobar es humano", () => {
    const root = makeProject(["FDD"]);
    const r = cli(["hook", "session-start"], { cwd: root, env: env() });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("[evol] Estado del proyecto");
    expect(r.stdout).toContain("Fase actual: briefing");
    expect(r.stdout).toContain("lo hace siempre una persona");
  });

  it("fuera de un proyecto no imprime nada y no falla", () => {
    const r = cli(["hook", "session-start"], { cwd: tempDir(), env: env() });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("sin MemPalace lo dice y sigue: nunca rompe la sesión", () => {
    const root = makeProject(["FDD"], { memory: { wing: "demo", enabled: true } });
    const r = cli(["hook", "session-start"], {
      cwd: root,
      env: { ...env(), EVOL_MEMPALACE_CMD: "evol-test-no-such-command" },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("MemPalace no disponible");
    expect(r.stdout).toContain("Fase actual: briefing");
  });

  it("con una configuración rota lo dice en una línea y sale con 0", () => {
    const root = makeProject(["FDD"]);
    write(root, "evol.config.json", "{ roto");
    const r = cli(["hook", "session-start"], { cwd: root, env: env() });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("No se pudo leer el estado");
  });

  it("un evento desconocido es un error de uso", () => {
    expect(cli(["hook", "otro"], { cwd: tempDir(), env: env() }).status).toBe(1);
  });
});

describe("los archivos generados no rompen el formato del proyecto (criterio 23)", () => {
  it("pasan prettier --check con la configuración por defecto", () => {
    const root = tempDir();
    writeAgentFiles(root);
    const r = spawnSync("npx", ["prettier", "--check", "--no-config", root], {
      cwd: REPO,
      encoding: "utf8",
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  it("también cuando se fusionan con los archivos del usuario", () => {
    const root = legacyProject();
    writeAgentFiles(root);
    for (const f of [".claude/settings.json", ".mcp.json", ".claude/commands/evol-fase.md"]) {
      const r = spawnSync("npx", ["prettier", "--check", "--no-config", join(root, f)], {
        cwd: REPO,
        encoding: "utf8",
      });
      expect(r.status, `${f}: ${r.stdout}${r.stderr}`).toBe(0);
    }
  });

  it("formatJson sigue el estilo de Prettier", () => {
    expect(formatJson({ a: ["x", "y"], b: [], c: {}, d: [{ e: 1 }] })).toBe(
      '{\n  "a": ["x", "y"],\n  "b": [],\n  "c": {},\n  "d": [\n    {\n      "e": 1\n    }\n  ]\n}',
    );
  });
});
