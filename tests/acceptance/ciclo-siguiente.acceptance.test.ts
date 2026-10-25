import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { beforeAll, describe, expect, it } from "vitest";
import { ensureKey, readLog, verifyChain } from "../../src/core/gate.js";
import { advance, approvePhase, loadContext } from "../../src/core/pipeline.js";
import type { Confirm, PipelineContext } from "../../src/core/pipeline.js";
import { loadState } from "../../src/core/state.js";
import {
  CLI,
  cli,
  interrogatePlan,
  isolateUserConfig,
  makeProject,
  write,
  writeValidArtifacts,
} from "../helpers.js";

const DISC = ["SDD", "FDD", "DDD", "THREAT", "BDD", "ATDD", "TDD", "STDD", "SecDD"];
const yes: Confirm = () => Promise.resolve({ approver: "ana" });
const passing = () => ({ ok: true, output: "" });
// mismo convenio que tests/e2e.test.ts: sin "script" no hay como simular una terminal real, y
// approve/ciclo nuevo exigen una. Sin él, CA-146 se queda sin ninguna evidencia (riesgo señalado
// por la revisión del briefing); se acepta porque el propio e2e.test.ts ya depende de lo mismo.
const hasScript = spawnSync("script", ["--version"], { encoding: "utf8" }).status === 0;

function ctxFor(root: string): PipelineContext {
  return loadContext(root, { run: passing, securityScan: () => [] });
}

/** Drives a project through every phase (briefing → done), the way a person does over the real pipeline. */
async function finishACycle(root: string): Promise<void> {
  const phases = ["briefing", "spec", "plan", "build", "qa", "retro"] as const;
  for (const id of DISC) writeValidArtifacts(root, id);
  write(root, "lecciones.md", "# Lecciones\n\n### Una lección del ciclo — 2026-01-01\n\ntexto\n");
  for (const phase of phases) {
    if (phase === "plan") interrogatePlan(root);
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
      const beforeEntries = readLog(root).length;
      const terminal = cicloNuevoEnTerminal(root);
      // si «ciclo nuevo» no abrió nada (no es todavía un comando real, por ejemplo), esta prueba no
      // demuestra nada: el registro firmado del primer ciclo sería trivialmente válido de todos
      // modos. Solo cuenta como evidencia cuando el comando de verdad añadió algo al registro.
      expect(terminal.status, terminal.stdout + terminal.stderr).toBe(0);
      expect(readLog(root).length).toBeGreaterThan(beforeEntries);
      const state = loadState(root);
      const key = ensureKey(state.projectId);

      const chain = verifyChain(readLog(root), key);

      expect(chain.ok).toBe(true);
    },
  );

  it.skipIf(!hasScript)(
    "CA-147: sin una persona en una terminal, el comando se niega por eso, no por otro motivo",
    async () => {
      const root = makeProject(DISC);
      await finishACycle(root);

      // cli() no adjunta una terminal a stdin, igual que un agente que invoca el comando directo.
      const sinTerminal = cli(["ciclo", "nuevo"], { cwd: root, env: env() });
      // referencia: en una terminal real, el mismo comando sí abre el ciclo (confirma que la
      // negación de arriba es por falta de terminal, no porque "ciclo nuevo" no exista).
      const conTerminal = cicloNuevoEnTerminal(root);

      expect(conTerminal.status, conTerminal.stdout + conTerminal.stderr).toBe(0);
      expect(sinTerminal.status).not.toBe(0);
      expect(sinTerminal.stdout + sinTerminal.stderr).toMatch(/terminal|confirmaci[oó]n/i);
    },
  );

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
