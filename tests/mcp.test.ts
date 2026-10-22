import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { TOOL_NAMES } from "../src/commands/mcp.js";
import {
  CLI,
  copyFixture,
  isolateUserConfig,
  makeProject,
  makeProjectAt,
  tempDir,
  write,
  writeValidArtifacts,
} from "./helpers.js";

let userConfig: string;
beforeAll(() => {
  userConfig = isolateUserConfig();
});

const open: Client[] = [];
afterEach(async () => {
  for (const c of open.splice(0)) await c.close().catch(() => undefined);
});

async function connect(
  cwd: string,
  extraArgs: string[] = [],
  env: Record<string, string> = {},
): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--disable-warning=ExperimentalWarning", CLI, "mcp", ...extraArgs],
    cwd,
    env: { ...(process.env as Record<string, string>), EVOL_CONFIG_DIR: userConfig, ...env },
    stderr: "ignore",
  });
  const client = new Client({ name: "test", version: "0" }, { capabilities: {} });
  await client.connect(transport);
  open.push(client);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text: string }[];
    isError?: boolean;
  };
  const text = result.content[0]?.text ?? "";
  return {
    text,
    isError: result.isError === true,
    json: () => JSON.parse(text) as Record<string, unknown>,
  };
}

describe("evol mcp: solo lectura (criterio 22)", () => {
  it("ofrece exactamente las herramientas declaradas", async () => {
    const client = await connect(makeProject(["FDD"]));
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([...TOOL_NAMES].sort());
  });

  it("ninguna herramienta aprueba, avanza ni inicializa", async () => {
    const client = await connect(makeProject(["FDD"]));
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const name of names)
      expect(name).not.toMatch(/approve|aprobar|next|avanz|init|adopt|new/i);
    for (const forbidden of ["evol_approve", "evol_next", "evol_init", "approve", "next"]) {
      const result = await client
        .callTool({ name: forbidden, arguments: {} })
        .catch((e: unknown) => e);
      const failed = result instanceof Error || (result as { isError?: boolean }).isError === true;
      expect(failed, forbidden).toBe(true);
    }
  });

  it("usarlas todas no cambia el estado del pipeline ni escribe en el registro de aprobaciones", async () => {
    const root = makeProject(["FDD"]);
    writeValidArtifacts(root, "FDD");
    write(root, "src/a.ts", "export function a(): number {\n  return 1;\n}\n");
    const snapshot = () => ({
      state: readFileSync(join(root, ".evol/state.json"), "utf8"),
      log: existsSync(join(root, ".evol/gate-log.jsonl")),
    });
    const before = snapshot();
    const client = await connect(root);
    for (const [name, args] of [
      ["evol_status", {}],
      ["evol_verify", {}],
      ["evol_index", {}],
      ["evol_find_symbol", { simbolo: "a" }],
      ["evol_impact", { simbolo: "a" }],
      ["evol_trace", { simbolo: "a" }],
    ] as const) {
      expect((await call(client, name, args)).isError, name).toBe(false);
    }
    expect(snapshot()).toEqual(before);
    expect(before.log).toBe(false);
  });
});

describe("evol mcp: contenido de las herramientas", () => {
  it("evol_status describe fase, disciplinas y aprobación", async () => {
    const root = makeProject(["FDD"]);
    const body = (await call(await connect(root), "evol_status")).json() as {
      proyecto: string;
      fase: string;
      disciplinas: { id: string; artefactos: { encontrados: number }[] }[];
      aprobacion: { estado: string };
    };
    expect(body.proyecto).toBe("demo");
    expect(body.fase).toBe("briefing");
    expect(body.disciplinas.map((d) => d.id)).toEqual(["FDD"]);
    expect(body.disciplinas[0]?.artefactos[0]?.encontrados).toBe(0);
    expect(body.aprobacion.estado).toBe("pendiente");
  });

  it("evol_verify lista los problemas y avisa que aprobar es de la persona", async () => {
    const root = makeProject(["FDD"]);
    const missing = (await call(await connect(root), "evol_verify")).json() as {
      listo: boolean;
      problemas: { mensaje: string }[];
    };
    expect(missing.listo).toBe(false);
    expect(missing.problemas[0]?.mensaje).toContain("falta el artefacto");

    writeValidArtifacts(root, "FDD");
    const ok = (await call(await connect(root), "evol_verify")).json() as {
      listo: boolean;
      nota: string;
    };
    expect(ok.listo).toBe(true);
    expect(ok.nota).toContain("la persona debe ejecutar");
  });

  it("la salida de un comando de verificación no corrompe el protocolo", async () => {
    const root = makeProjectAt("build", ["TDD"], {
      modules: [
        {
          name: "app",
          root: ".",
          disciplinas: ["TDD"],
          comandos: { TDD: "echo ruido-en-stdout; true" },
        },
      ],
    });
    writeValidArtifacts(root, "TDD");
    const result = await call(await connect(root), "evol_verify");
    expect(result.isError).toBe(false);
    expect((result.json() as { listo: boolean }).listo).toBe(true);
  });

  it("impact, trace y find_symbol funcionan sobre el código del proyecto", async () => {
    const root = makeProject(["FDD"]);
    const sample = copyFixture("sample");
    for (const f of ["src/a.ts", "src/b.ts", "src/c.ts", "tests/c.test.ts"]) {
      write(root, f, readFileSync(join(sample, f), "utf8"));
    }
    const client = await connect(root);
    const impact = (
      await call(client, "evol_impact", { simbolo: "greet", profundidad: 2 })
    ).json() as {
      dependents: { id: string }[];
    };
    expect(impact.dependents.map((d) => d.id)).toEqual([
      "src/a.ts#Base.hello",
      "src/a.ts#Child.run",
    ]);
    const trace = (await call(client, "evol_trace", { simbolo: "main" })).json() as {
      steps: { id: string }[];
    };
    expect(trace.steps.map((s) => s.id)).toContain("src/b.ts#greet");
    const found = (
      await call(client, "evol_find_symbol", { simbolo: "greet" })
    ).json() as unknown as { id: string }[];
    expect(found.map((s) => s.id)).toEqual(["src/b.ts#greet"]);
  });

  it("un símbolo inexistente es un error legible, no una caída", async () => {
    const root = makeProject(["FDD"]);
    const client = await connect(root);
    const result = await call(client, "evol_impact", { simbolo: "noExiste" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("No se encontró ningún símbolo");
    expect((await call(client, "evol_status")).isError).toBe(false);
  });

  it("los argumentos inválidos se rechazan", async () => {
    const client = await connect(makeProject(["FDD"]));
    const result = (await client
      .callTool({ name: "evol_impact", arguments: { simbolo: "" } })
      .catch((e: unknown) => e)) as {
      isError?: boolean;
    };
    expect(result instanceof Error || result.isError === true).toBe(true);
  });
});

describe("evol mcp: dónde busca el proyecto", () => {
  it("--project funciona desde cualquier carpeta", async () => {
    const root = makeProject(["FDD"]);
    const client = await connect(tempDir(), ["--project", root]);
    expect((await call(client, "evol_status")).json()["proyecto"]).toBe("demo");
  });

  it("EVOL_PROJECT también", async () => {
    const root = makeProject(["FDD"]);
    const client = await connect(tempDir(), [], { EVOL_PROJECT: root });
    expect((await call(client, "evol_status")).json()["proyecto"]).toBe("demo");
  });

  it("fuera de un proyecto responde con un error claro y sigue vivo", async () => {
    const client = await connect(tempDir());
    const result = await call(client, "evol_status");
    expect(result.isError).toBe(true);
    expect(result.text).toContain("No hay un proyecto evol");
    expect((await client.listTools()).tools.length).toBe(TOOL_NAMES.length);
  });
});

describe("evol mcp: memoria", () => {
  it("sin MemPalace, add y search fallan con un mensaje claro y la lección queda local", async () => {
    const root = makeProject(["FDD"]);
    const client = await connect(root, [], { EVOL_MEMPALACE_CMD: "evol-test-no-such-command" });
    const search = await call(client, "evol_memory_search", { consulta: "algo" });
    expect(search.isError).toBe(true);
    expect(search.text).toContain("No se pudo usar MemPalace");
    const add = await call(client, "evol_memory_add", {
      tipo: "leccion",
      titulo: "Probar antes",
      texto: "Siempre probar.",
    });
    expect(add.isError).toBe(true);
    expect(readFileSync(join(root, "lecciones.md"), "utf8")).toContain("### Probar antes");
  });

  it("no acepta tipos que no son de memoria (aprobación, pipeline)", async () => {
    const client = await connect(makeProject(["FDD"]));
    for (const tipo of ["aprobacion", "pipeline"]) {
      const r = (await client
        .callTool({ name: "evol_memory_add", arguments: { tipo, texto: "x" } })
        .catch((e: unknown) => e)) as {
        isError?: boolean;
      };
      expect(r instanceof Error || r.isError === true, tipo).toBe(true);
    }
  });

  const hasMemPalace =
    spawnSync("mempalace-mcp", ["--help"], { encoding: "utf8", timeout: 60_000 }).error ===
    undefined;

  it.skipIf(!hasMemPalace)(
    "con MemPalace real: guarda y recupera por el MCP, en el wing del proyecto",
    async () => {
      const wing = `evoltest_${randomBytes(4).toString("hex")}`;
      const root = makeProject(["FDD"], { memory: { wing, enabled: true } });
      const client = await connect(root, [], { EVOL_MEMPALACE_PALACE: tempDir("evol-palace-") });
      const marker = `decidimos usar sqlite ${randomBytes(4).toString("hex")}`;
      const added = await call(client, "evol_memory_add", { tipo: "decision", texto: marker });
      expect(added.isError, added.text).toBe(false);
      const found = await call(client, "evol_memory_search", { consulta: "base de datos sqlite" });
      expect(found.isError, found.text).toBe(false);
      expect(
        (JSON.parse(found.text) as { text: string; wing: string }[]).some(
          (h) => h.text.includes(marker) && h.wing === wing,
        ),
      ).toBe(true);
    },
    240_000,
  );
});
