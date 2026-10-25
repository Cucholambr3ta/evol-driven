import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectGlobalAgents, projectMcpServers } from "../src/agents/convivencia.js";
import { tempDir, write } from "./helpers.js";

function claudeSettings(home: string, data: unknown): void {
  write(home, ".claude/settings.json", JSON.stringify(data, null, 2));
}

describe("detectGlobalAgents (criterio 136)", () => {
  it("sin ningún ~/.claude/settings.json, no encuentra nada", () => {
    const home = tempDir();
    const report = detectGlobalAgents(home);
    expect(report).toEqual({
      hooksAjenos: [],
      bypassPermissions: false,
      pluginsActivados: [],
      denyRelativos: [],
      outputStyleGlobal: null,
      mcpServers: [],
    });
  });

  it("encuentra un hook de otro framework, pero no uno de evol ni de mempalace", () => {
    const home = tempDir();
    claudeSettings(home, {
      hooks: {
        Stop: [
          { hooks: [{ type: "command", command: "gentle-ai review stop-hook" }] },
          { hooks: [{ type: "command", command: "mempalace hook run --hook stop" }] },
        ],
        SessionStart: [{ hooks: [{ type: "command", command: "evol hook session-start" }] }],
      },
    });
    const report = detectGlobalAgents(home);
    expect(report.hooksAjenos).toEqual([{ evento: "Stop", comando: "gentle-ai review stop-hook" }]);
  });

  it("detecta bypassPermissions activo", () => {
    const home = tempDir();
    claudeSettings(home, { permissions: { defaultMode: "bypassPermissions" } });
    expect(detectGlobalAgents(home).bypassPermissions).toBe(true);
  });

  it("detecta una regla deny con ruta relativa, no la absoluta", () => {
    const home = tempDir();
    claudeSettings(home, {
      permissions: { deny: ["Read(.ssh/*)", "Read(~/.ssh/**)", "Bash(rm -rf /)"] },
    });
    expect(detectGlobalAgents(home).denyRelativos).toEqual(["Read(.ssh/*)"]);
  });

  it("solo los plugins activados (true), no los desactivados", () => {
    const home = tempDir();
    claudeSettings(home, { enabledPlugins: { "engram@engram": true, "otro@x": false } });
    expect(detectGlobalAgents(home).pluginsActivados).toEqual(["engram@engram"]);
  });

  it("un servidor MCP remoto de OpenCode, bajo mcp.servers", () => {
    const home = tempDir();
    write(
      home,
      ".config/opencode/opencode.json",
      JSON.stringify({ mcp: { servers: { docs: { type: "remote", url: "https://x" } } } }),
    );
    expect(detectGlobalAgents(home).mcpServers).toEqual([
      { nombre: "docs", transporte: "remoto", origen: "global" },
    ]);
  });

  it("un servidor MCP local no se confunde con remoto", () => {
    const home = tempDir();
    write(
      home,
      ".config/opencode/opencode.json",
      JSON.stringify({ mcp: { servers: { propio: { type: "local", command: ["x"] } } } }),
    );
    expect(detectGlobalAgents(home).mcpServers).toEqual([
      { nombre: "propio", transporte: "local", origen: "global" },
    ]);
  });

  it("un JSON corrupto no revienta: se trata como si no hubiera nada", () => {
    const home = tempDir();
    mkdirSync(join(home, ".claude"), { recursive: true });
    writeFileSync(join(home, ".claude", "settings.json"), "{ esto no es json");
    expect(() => detectGlobalAgents(home)).not.toThrow();
    expect(detectGlobalAgents(home).hooksAjenos).toEqual([]);
  });
});

describe("projectMcpServers (criterio 149)", () => {
  it("lee .mcp.json y opencode.json del proyecto, no los globales", () => {
    const root = tempDir();
    write(root, ".mcp.json", JSON.stringify({ mcpServers: { evol: { command: "evol" } } }));
    write(
      root,
      "opencode.json",
      JSON.stringify({ mcp: { servers: { otro: { type: "remote", url: "https://x" } } } }),
    );
    expect(projectMcpServers(root)).toEqual([
      { nombre: "evol", transporte: "local", origen: "proyecto" },
      { nombre: "otro", transporte: "remoto", origen: "proyecto" },
    ]);
  });

  it("sin ninguno de los dos archivos, una lista vacía", () => {
    expect(projectMcpServers(tempDir())).toEqual([]);
  });
});
