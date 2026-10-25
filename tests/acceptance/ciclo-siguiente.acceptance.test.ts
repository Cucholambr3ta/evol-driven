import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { beforeAll, describe, expect, it } from "vitest";
import { ensureKey, readLog, verifyChain } from "../../src/core/gate.js";
import { advance, approvePhase, loadContext } from "../../src/core/pipeline.js";
import type { Confirm, PipelineContext } from "../../src/core/pipeline.js";
import { loadState } from "../../src/core/state.js";
import { CLI, cli, isolateUserConfig, makeProject, writeValidArtifacts } from "../helpers.js";

const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];
const yes: Confirm = () => Promise.resolve({ approver: "ana" });
const passing = () => ({ ok: true, output: "" });
const hasScript = spawnSync("script", ["--version"], { encoding: "utf8" }).status === 0;

function ctxFor(root: string): PipelineContext {
  return loadContext(root, { run: passing, securityScan: () => [] });
}

/** Drives a project through every phase (briefing → done), the way a person does over the real pipeline. */
async function finishACycle(root: string): Promise<void> {
  const phases = ["briefing", "spec", "plan", "build", "qa", "retro"] as const;
  for (const id of DISC) writeValidArtifacts(root, id);
  for (const phase of phases) {
    await approvePhase(ctxFor(root), phase, yes);
    await advance(ctxFor(root));
  }
}

describe("seguir trabajando en un segundo ciclo", () => {
  let configDir: string;
  beforeAll(() => {
    configDir = isolateUserConfig();
  });
  const env = () => ({ EVOL_CONFIG_DIR: configDir });

  /** "evol ciclo nuevo" in a real terminal (a pty), the way a person confirms it. */
  function cicloNuevoEnTerminal(root: string) {
    const command = `${process.execPath} --disable-warning=ExperimentalWarning ${CLI} ciclo nuevo`;
    return spawnSync("script", ["-qec", command, "/dev/null"], {
      cwd: root,
      input: "s\n",
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, ...env() },
    });
  }

  it.skipIf(!hasScript)(
    "CA-146: las aprobaciones del ciclo anterior no cuentan en el nuevo",
    async () => {
      const root = makeProject(DISC);
      await finishACycle(root);
      expect(loadState(root).currentPhase).toBe("done");

      const result = cicloNuevoEnTerminal(root);
      expect(result.status, result.stdout + result.stderr).toBe(0);

      const prereq = cli(["prerequisites", "--json"], { cwd: root, env: env() });
      const data = JSON.parse(prereq.stdout) as { anteriorAprobada: boolean };
      expect(data.anteriorAprobada).toBe(false);
    },
  );

  it.skipIf(!hasScript)(
    "CA-146: la cadena de aprobaciones del primer ciclo sigue siendo válida",
    async () => {
      const root = makeProject(DISC);
      await finishACycle(root);
      cicloNuevoEnTerminal(root);
      const state = loadState(root);
      const key = ensureKey(state.projectId);

      const chain = verifyChain(readLog(root), key);

      expect(chain.ok).toBe(true);
    },
  );

  it("CA-147: sin una persona en una terminal, el comando se niega (como approve)", async () => {
    const root = makeProject(DISC);
    await finishACycle(root);

    // cli() no adjunta una terminal a stdin, igual que un agente que invoca el comando directo.
    const result = cli(["ciclo", "nuevo"], { cwd: root, env: env() });

    expect(result.status).not.toBe(0);
  });

  it("CA-147: el MCP no registra ninguna herramienta para abrir un ciclo", async () => {
    const root = makeProject(DISC);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--disable-warning=ExperimentalWarning", CLI, "mcp"],
      cwd: root,
      env: { ...(process.env as Record<string, string>), EVOL_CONFIG_DIR: configDir },
      stderr: "ignore",
    });
    const client = new Client({ name: "test", version: "0" }, { capabilities: {} });
    await client.connect(transport);

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/ciclo/)]),
    );
    await client.close();
  });
});
