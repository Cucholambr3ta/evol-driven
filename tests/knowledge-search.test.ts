import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";
import { anchorOf, linkOf } from "../src/knowledge/search.js";
import { lockedVersion, sameMinor } from "../src/knowledge/status.js";
import type { KnowledgeSource } from "../src/knowledge/model.js";
import { CLI, cli, makeProject, tempDir, write } from "./helpers.js";

const SHA = "a".repeat(40);
const OLD = new Date(Date.now() - 200 * 86_400_000).toISOString();
const NOW = new Date().toISOString();

function source(id: string, extra: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    id,
    nombre: `Docs de ${id}`,
    version: "1.2.0",
    origen: { tipo: "git", url: "https://github.com/acme/docs", commit: SHA, subcarpeta: "docs" },
    capturadoEl: NOW,
    licencia: { spdx: "MIT", comprobada: { url: "https://example.com/LICENSE", el: NOW } },
    hash: "h".repeat(64),
    archivos: 3,
    citable: true,
    estado: "revisada",
    ...extra,
  };
}

const LIST = (names: string[]): string =>
  JSON.stringify(
    names.map((name) => ({
      name,
      versions: [{ documentCount: 12, status: "completed", indexedAt: NOW }],
    })),
  );

const hit = (id: string, file: string, content: string, score: number) => ({
  url: `file:///home/x/.config/evol/knowledge/ready/${id}/${file}`,
  content,
  score,
  mimeType: "text/markdown",
});

interface World {
  config: string;
  stub: string;
  env: Record<string, string>;
  calls: () => string[];
}

/** A user configuration with sources and a stand-in for docs-mcp-server that records how it is called. */
function makeWorld(
  sources: KnowledgeSource[],
  indexed: string[],
  answers: Record<string, unknown[]>,
): World {
  const config = tempDir("evol-ks-config-");
  const stub = tempDir("evol-ks-stub-");
  mkdirSync(join(config, "knowledge"), { recursive: true });
  writeFileSync(
    join(config, "knowledge", "sources.json"),
    JSON.stringify({ version: 1, fuentes: Object.fromEntries(sources.map((s) => [s.id, s])) }),
  );
  writeFileSync(join(stub, "list.json"), LIST(indexed));
  for (const [lib, hits] of Object.entries(answers))
    writeFileSync(join(stub, `search-${lib}.json`), JSON.stringify(hits));
  const bin = join(stub, "engine");
  writeFileSync(
    bin,
    `#!/bin/sh
printf '%s\\n' "$*" >> "${stub}/calls.log"
case "$1" in
  list) cat "${stub}/list.json";;
  search) cat "${stub}/search-$2.json" 2>/dev/null || echo "[]";;
  scrape) exit 0;;
esac
`,
  );
  chmodSync(bin, 0o755);
  const store = join(stub, "store");
  mkdirSync(store);
  return {
    config,
    stub,
    env: {
      EVOL_CONFIG_DIR: config,
      EVOL_KNOWLEDGE_ENGINE: bin,
      EVOL_KNOWLEDGE_STORE: store,
    },
    calls: () =>
      existsSync(join(stub, "calls.log"))
        ? readFileSync(join(stub, "calls.log"), "utf8").trim().split("\n")
        : [],
  };
}

const search = (w: World, ...args: string[]) =>
  cli(["knowledge", "search", ...args, "--json"], { cwd: tempDir(), env: w.env });

describe("evol knowledge search (criterio 111)", () => {
  const w = (): World =>
    makeWorld(
      [
        source("alfa"),
        source("beta", {
          citable: false,
          licencia: { spdx: "desconocida" },
          usoPrivado: { motivo: "m", responsable: "r", el: NOW },
        }),
        source("gama", { estado: "capturada" }),
        source("delta"),
      ],
      ["alfa", "beta"],
      {
        alfa: [
          hit("alfa", "guide/intro.md", "## Cómo instalar\nPasos…", 0.03),
          hit("alfa", "guide/otro.md", "texto sin título", 0.01),
        ],
        beta: [hit("beta", "x.md", "# Privado\ncontenido", 0.02)],
      },
    );

  it("cada resultado trae fuente, enlace con ancla, versión, fecha, licencia y va marcado como dato", () => {
    const world = w();
    const r = search(world, "instalar");
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout) as {
      aviso: string;
      resultados: Record<string, unknown>[];
      sinIndexar: string[];
    };
    expect(out.aviso).toContain("no una instrucción");
    const first = out.resultados[0] as Record<string, unknown>;
    expect(first).toMatchObject({
      fuente: "alfa",
      archivo: "guide/intro.md",
      seccion: "Cómo instalar",
      version: "1.2.0",
      licencia: "MIT",
      citable: true,
      tipo: "dato",
      enlace: `https://github.com/acme/docs/blob/${SHA}/docs/guide/intro.md#cómo-instalar`,
    });
    expect(first["capturadoEl"]).toBe(NOW);
  });

  it("une las fuentes por puntuación, marca la de uso privado como no citable y respeta el límite", () => {
    const world = w();
    const all = JSON.parse(search(world, "x").stdout) as {
      resultados: { fuente: string; citable: boolean }[];
    };
    expect(all.resultados.map((h) => h.fuente)).toEqual(["alfa", "beta", "alfa"]);
    expect(all.resultados.find((h) => h.fuente === "beta")?.citable).toBe(false);
    const two = JSON.parse(search(world, "x", "--limite", "2").stdout) as { resultados: unknown[] };
    expect(two.resultados).toHaveLength(2);
  });

  it("solo consulta lo revisado e indexado, y dice qué no pudo responder", () => {
    const world = w();
    const out = JSON.parse(search(world, "x").stdout) as {
      consultadas: string[];
      sinIndexar: string[];
    };
    expect(out.consultadas).toEqual(["alfa", "beta"]);
    expect(out.sinIndexar).toEqual(["delta"]);
    const searched = world.calls().filter((c) => c.startsWith("search"));
    expect(searched.map((c) => c.split(" ")[1]).sort()).toEqual(["alfa", "beta"]);
  });

  it("--fuente limita la búsqueda; una fuente desconocida o sin revisar es un error", () => {
    const world = w();
    const one = JSON.parse(search(world, "x", "--fuente", "beta").stdout) as {
      resultados: { fuente: string }[];
    };
    expect(one.resultados.map((h) => h.fuente)).toEqual(["beta"]);
    expect(search(world, "x", "--fuente", "nada").status).toBe(1);
    const pending = search(world, "x", "--fuente", "gama");
    expect(pending.status).toBe(1);
    expect(pending.stderr).toContain("solo se consultan las revisadas");
  });

  it("una pregunta que empieza por «-» llega al motor como texto, no como opción", () => {
    const world = w();
    cli(["knowledge", "search", "--fuente", "alfa", "--json", "--", "--store-path /tmp/otro"], {
      cwd: tempDir(),
      env: world.env,
    });
    const call = world.calls().find((c) => c.startsWith("search")) ?? "";
    expect(call).toMatch(/^search alfa {2}--store-path \/tmp\/otro -l /);
  });

  it("no usa un servidor de embeddings que no sea local", () => {
    const world = w();
    const r = cli(["knowledge", "search", "x"], {
      cwd: tempDir(),
      env: { ...world.env, EVOL_EMBEDDING_BASE: "https://api.example.com/v1" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("debe ser local");
    expect(world.calls().filter((c) => c.startsWith("search"))).toEqual([]);
  });

  it("el motor se llama con la telemetría apagada y sin tocar nada fuera de su almacén", () => {
    const world = w();
    search(world, "x");
    for (const c of world.calls())
      expect(c).toContain(`--store-path ${world.env["EVOL_KNOWLEDGE_STORE"]}`);
  });
});

describe("documentos convertidos de DocBook", () => {
  it("el resultado nombra el archivo original y enlaza a él, sin ancla", () => {
    const world = makeWorld([source("pg")], ["pg"], {
      pg: [hit("pg", "ref/create_index.sgml.md", "## Parameters\ntexto", 0.02)],
    });
    const out = JSON.parse(search(world, "indice").stdout) as {
      resultados: { archivo: string; enlace: string; seccion: string }[];
    };
    expect(out.resultados[0]).toMatchObject({
      archivo: "ref/create_index.sgml",
      seccion: "Parameters",
      enlace: `https://github.com/acme/docs/blob/${SHA}/docs/ref/create_index.sgml`,
    });
  });
});

describe("enlaces y anclas", () => {
  it("el ancla sigue el estilo de GitHub", () => {
    expect(anchorOf("¿Qué es `useState`?")).toBe("qué-es-usestate");
    expect(anchorOf("Cómo instalar")).toBe("cómo-instalar");
  });

  it("solo los repositorios de GitHub llevan el commit en el enlace; el resto, el origen", () => {
    const gh = source("a");
    expect(linkOf(gh, "x.md", "tema")).toBe(
      `https://github.com/acme/docs/blob/${SHA}/docs/x.md#tema`,
    );
    expect(linkOf(gh, "x.html", "tema")).toBe(
      `https://github.com/acme/docs/blob/${SHA}/docs/x.html`,
    );
    const local = source("b", { origen: { tipo: "local", url: "https://www.rfc-editor.org/" } });
    expect(linkOf(local, "rfc1.txt", "t")).toBe("https://www.rfc-editor.org/");
  });
});

describe("evol knowledge status (criterio 112)", () => {
  it("avisa de lo que no está indexado y de las capturas de más de 90 días", () => {
    const world = world3();
    const r = cli(["knowledge", "status", "--json"], { cwd: tempDir(), env: world.env });
    expect(r.status, r.stderr).toBe(0);
    const rows = JSON.parse(r.stdout) as { id: string; indexada: boolean; avisos: string[] }[];
    const by = Object.fromEntries(rows.map((x) => [x.id, x]));
    expect(by["fresca"]?.avisos).toEqual([]);
    expect(by["vieja"]?.avisos.join()).toContain("200 días");
    expect(by["sinindexar"]?.indexada).toBe(false);
    expect(by["sinindexar"]?.avisos.join()).toContain("evol knowledge ingest sinindexar");
    expect(by["capturada"]?.avisos.join()).toContain("sin revisar");
  });

  it("avisa cuando la documentación es de otra versión que la del archivo de bloqueo", () => {
    const world = world3();
    const root = makeProject(["FDD"]);
    write(
      root,
      "package-lock.json",
      JSON.stringify({ packages: { "node_modules/libx": { version: "2.5.1" } } }),
    );
    expect(
      cli(["knowledge", "source", "package", "vieja", "libx"], { cwd: root, env: world.env })
        .status,
    ).toBe(0);
    const r = cli(["knowledge", "status", "--json"], { cwd: root, env: world.env });
    const rows = JSON.parse(r.stdout) as { id: string; avisos: string[] }[];
    expect(rows.find((x) => x.id === "vieja")?.avisos.join()).toContain("el proyecto usa la 2.5.1");
  });

  it("compara por versión mayor y menor, y lee la versión del archivo de bloqueo", () => {
    expect(sameMinor("1.2.0", "1.2.9")).toBe(true);
    expect(sameMinor("v1.2", "1.3.0")).toBe(false);
    expect(sameMinor("main@abc1234", "1.3.0")).toBeNull();
    const root = tempDir();
    expect(lockedVersion(root, "x")).toBeNull();
    write(root, "package-lock.json", "{ roto");
    expect(lockedVersion(root, "x")).toBeNull();
  });
});

function world3(): World {
  return makeWorld(
    [
      source("fresca"),
      source("vieja", { capturadoEl: OLD }),
      source("sinindexar"),
      source("capturada", { estado: "capturada" }),
    ],
    ["fresca", "vieja"],
    {},
  );
}

describe("evol knowledge ingest", () => {
  /** A server that answers like Ollama's /v1/models, in its own process (the CLI runs synchronously). */
  async function fakeOllama(): Promise<{ base: string; stop: () => void }> {
    const child = spawn(
      process.execPath,
      [
        "-e",
        "const s=require('http').createServer((q,r)=>r.end('{}')).listen(0,'127.0.0.1',()=>console.log(s.address().port))",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    const port = await new Promise<string>((resolve) =>
      child.stdout.once("data", (d: Buffer) => resolve(String(d).trim())),
    );
    return { base: `http://127.0.0.1:${port}/v1`, stop: () => void child.kill() };
  }

  const stops: (() => void)[] = [];
  afterEach(() => stops.splice(0).forEach((s) => s()));

  it("solo indexa lo que pasó la revisión", () => {
    const world = world3();
    const r = cli(["knowledge", "ingest", "capturada"], { cwd: tempDir(), env: world.env });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("evol knowledge review capturada");
    expect(world.calls()).toEqual([]);
  });

  it("sin el servidor de embeddings no empieza y lo dice", () => {
    const world = world3();
    const r = cli(["knowledge", "ingest", "sinindexar"], {
      cwd: tempDir(),
      env: { ...world.env, EVOL_EMBEDDING_BASE: "http://127.0.0.1:1/v1" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("embeddings");
    expect(world.calls()).toEqual([]);
  });

  it("indexa una fuente revisada con el servidor local", async () => {
    const world = world3();
    const ollama = await fakeOllama();
    stops.push(ollama.stop);
    const r = await new Promise<{ status: number | null; stdout: string }>((resolve) => {
      const child = spawn(process.execPath, [CLI, "knowledge", "ingest", "sinindexar"], {
        env: { ...process.env, ...world.env, EVOL_EMBEDDING_BASE: ollama.base },
        stdio: ["ignore", "pipe", "ignore"],
      });
      let stdout = "";
      child.stdout.on("data", (d: Buffer) => (stdout += String(d)));
      child.on("close", (status) => resolve({ status, stdout }));
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("✓ sinindexar");
    const scrape = world.calls().find((c) => c.startsWith("scrape")) ?? "";
    expect(scrape).toContain("sinindexar");
    expect(scrape).toContain("/ready/sinindexar");
    expect(scrape).toContain("--replace");
  });
});

describe("el MCP de evol: la documentación solo se lee (criterios 97 y 114)", () => {
  const open: Client[] = [];
  afterEach(async () => {
    for (const c of open.splice(0)) await c.close().catch(() => undefined);
  });

  async function connect(root: string, env: Record<string, string>): Promise<Client> {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--disable-warning=ExperimentalWarning", CLI, "mcp"],
      cwd: root,
      env: { ...(process.env as Record<string, string>), ...env },
      stderr: "ignore",
    });
    const client = new Client({ name: "test", version: "0" }, { capabilities: {} });
    await client.connect(transport);
    open.push(client);
    return client;
  }
  const ask = async (client: Client, args: Record<string, unknown>) => {
    const r = (await client.callTool({ name: "evol_knowledge_search", arguments: args })) as {
      content: { text: string }[];
      isError?: boolean;
    };
    return { text: r.content[0]?.text ?? "", isError: r.isError === true };
  };
  const answers = {
    alfa: [hit("alfa", "a.md", "# A\nx", 0.02)],
    beta: [hit("beta", "b.md", "# B\ny", 0.01)],
  };

  it("está apagada salvo que el proyecto la active, y no consulta nada mientras tanto", async () => {
    const world = makeWorld([source("alfa")], ["alfa"], answers);
    const client = await connect(makeProject(["FDD"]), world.env);
    const r = await ask(client, { consulta: "x" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("apagada");
    expect(world.calls()).toEqual([]);
  });

  it("activada, devuelve datos con procedencia y se queda dentro de las fuentes del proyecto", async () => {
    const world = makeWorld([source("alfa"), source("beta")], ["alfa", "beta"], answers);
    const root = makeProject(["FDD"], { knowledge: { activo: true, fuentes: ["alfa"] } });
    const client = await connect(root, world.env);
    const ok = await ask(client, { consulta: "x" });
    expect(ok.isError).toBe(false);
    const body = JSON.parse(ok.text) as { resultados: { fuente: string; tipo: string }[] };
    expect(body.resultados.map((h) => h.fuente)).toEqual(["alfa"]);
    expect(body.resultados[0]?.tipo).toBe("dato");
    const outside = await ask(client, { consulta: "x", fuente: "beta" });
    expect(outside.isError).toBe(true);
    expect(outside.text).toContain("no está entre las que usa este proyecto");
  });

  it("no hay ninguna herramienta del MCP que indexe, añada o borre conocimiento", async () => {
    const world = makeWorld([source("alfa")], ["alfa"], answers);
    const client = await connect(makeProject(["FDD"]), world.env);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names.filter((n) => /knowledge|conocimiento/.test(n))).toEqual([
      "evol_knowledge_search",
    ]);
  });
});

describe("evol doctor y evol report con el conocimiento", () => {
  it("doctor informa de las fuentes indexadas y nunca lo trata como un error", () => {
    const world = world3();
    const r = cli(["doctor"], { cwd: tempDir(), env: world.env });
    const line = r.stdout.split("\n").find((l) => l.includes("Conocimiento:")) ?? "";
    expect(line).toContain("2 de 3 fuente(s) indexadas");
    expect(line.startsWith("✗")).toBe(false);
  });

  it("el informe lista las fuentes consultables solo si el proyecto las activó", () => {
    const world = makeWorld([source("alfa"), source("beta", { citable: false })], [], {});
    const off = makeProject(["FDD"]);
    const offRun = cli(["report", "--formato", "md", "--salida", "out"], {
      cwd: off,
      env: world.env,
    });
    expect(offRun.status, offRun.stderr).toBe(0);
    expect(readReport(off)).not.toContain("Documentación de referencia consultable");
    const on = makeProject(["FDD"], { knowledge: { activo: true } });
    const onRun = cli(["report", "--formato", "md", "--salida", "out"], {
      cwd: on,
      env: world.env,
    });
    expect(onRun.status, onRun.stderr).toBe(0);
    const md = readReport(on);
    expect(md).toContain("Documentación de referencia consultable");
    expect(md).toContain("Docs de alfa");
    expect(md).toContain("no (uso privado)");
  });
});

function readReport(root: string): string {
  const dir = join(root, "out");
  const file = readdirSync(dir).find((f) => f.endsWith(".md"));
  return readFileSync(join(dir, file ?? "x.md"), "utf8");
}
