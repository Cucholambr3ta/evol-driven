import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { UserError } from "../core/errors.js";
import { knowledgeDir } from "./store.js";

/**
 * The search engine behind `evol knowledge` is docs-mcp-server (SQLite, full text plus vectors),
 * installed with a fixed version. evol only governs what goes in (see the gate) and how it is asked;
 * everything here talks to it as a subprocess, never as a network service.
 */
const dataDir = (): string =>
  process.env["EVOL_HOME"] ?? join(homedir(), ".local", "share", "evol");

export const engineBin = (): string =>
  process.env["EVOL_KNOWLEDGE_ENGINE"] ??
  join(
    dataDir(),
    "knowledge-engines",
    "docs-mcp-server",
    "node_modules",
    ".bin",
    "docs-mcp-server",
  );
export const storeDir = (): string =>
  process.env["EVOL_KNOWLEDGE_STORE"] ?? join(dataDir(), "knowledge-store");
export const readyRoot = (): string => join(knowledgeDir(), "ready");

export interface Embedding {
  base: string;
  model: string;
  /** Length of the vectors the model returns; the store is created with it and cannot change after. */
  dimension: number;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Embeddings are computed by a local server (Ollama): the documentation never leaves the machine. */
export function embedding(): Embedding {
  const base = process.env["EVOL_EMBEDDING_BASE"] ?? "http://127.0.0.1:11434/v1";
  const model = process.env["EVOL_EMBEDDING_MODEL"] ?? "bge-m3-cpu";
  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    throw new UserError(`EVOL_EMBEDDING_BASE no es una URL: ${base}`);
  }
  if (!LOOPBACK.has(host))
    throw new UserError(
      `El servidor de embeddings debe ser local (127.0.0.1), no «${host}»: la documentación no sale de esta máquina.`,
    );
  const dimension = Number(process.env["EVOL_EMBEDDING_DIMENSION"] ?? 1024);
  if (!Number.isInteger(dimension) || dimension < 1)
    throw new UserError("EVOL_EMBEDDING_DIMENSION debe ser un entero positivo.");
  return { base, model, dimension };
}

export function engineInstalled(): boolean {
  return existsSync(engineBin());
}

function engineEnv(): NodeJS.ProcessEnv {
  const { base, model, dimension } = embedding();
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of Object.keys(env))
    if (k.startsWith("OPENAI_") || k.startsWith("DOCS_MCP_")) delete env[k];
  return {
    ...env,
    DOCS_MCP_TELEMETRY: "false",
    DOCS_MCP_SCRAPER_SECURITY_FILE_ACCESS_ALLOWED_ROOTS: readyRoot(),
    OPENAI_API_KEY: "ollama",
    OPENAI_API_BASE: base,
    DOCS_MCP_EMBEDDING_MODEL: model,
    DOCS_MCP_EMBEDDINGS_VECTOR_DIMENSION: String(dimension),
  };
}

/**
 * The engine's defaults assume a hosted embeddings API: batches of 100 texts and 30 seconds. On a CPU
 * a batch takes longer than that and the document is lost, so evol sets smaller batches and a
 * patient timeout.
 */
function engineConfigFile(): string {
  const { dimension } = embedding();
  const file = join(storeDir(), "engine.yaml");
  const content = `embeddings:\n  batchSize: 16\n  batchChars: 20000\n  requestTimeoutMs: 600000\n  vectorDimension: ${dimension}\n`;
  mkdirSync(storeDir(), { recursive: true });
  if (!existsSync(file) || readFileSync(file, "utf8") !== content) writeFileSync(file, content);
  return file;
}

export interface EngineResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runEngine(args: string[], timeoutMs: number): Promise<EngineResult> {
  if (!engineInstalled())
    return Promise.reject(
      new UserError(
        `No está instalado el motor de conocimiento (${engineBin()}). Mira DEPENDENCIES.md.`,
      ),
    );
  return new Promise((resolve) => {
    execFile(
      engineBin(),
      [...args, "--store-path", storeDir(), "--config", engineConfigFile(), "--quiet", "--no-logo"],
      { env: engineEnv(), timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

function jsonOf(text: string): unknown {
  const start = text.search(/[[{]/);
  if (start < 0) throw new Error("sin JSON");
  return JSON.parse(text.slice(start));
}

export interface IndexedLibrary {
  nombre: string;
  documentos: number;
  estado: string;
  indexadaEl: string | null;
}

/** What the store holds, by library (a library is a source id). */
export async function indexedLibraries(): Promise<IndexedLibrary[]> {
  if (!existsSync(storeDir())) return [];
  const r = await runEngine(["list", "--output", "json"], 60_000);
  if (r.code !== 0) return [];
  try {
    const raw = jsonOf(r.stdout) as {
      name: string;
      versions: { documentCount?: number; status?: string; indexedAt?: string }[];
    }[];
    return raw.map((l) => ({
      nombre: l.name,
      documentos: l.versions.reduce((n, v) => n + (v.documentCount ?? 0), 0),
      estado: l.versions[0]?.status ?? "desconocido",
      indexadaEl: l.versions[0]?.indexedAt ?? null,
    }));
  } catch {
    return [];
  }
}

export interface RawHit {
  url: string;
  content: string;
  score: number;
}

export async function searchLibrary(
  library: string,
  query: string,
  limit: number,
): Promise<RawHit[]> {
  // a query that starts with «-» would be read as an option: a leading space keeps it text
  const q = query.startsWith("-") ? ` ${query}` : query;
  const r = await runEngine(
    ["search", library, q, "-l", String(limit), "--output", "json"],
    120_000,
  );
  if (r.code !== 0)
    throw new UserError(
      `La búsqueda en «${library}» falló: ${(r.stderr || r.stdout).trim().split("\n")[0] ?? "sin detalle"}`,
    );
  try {
    return jsonOf(r.stdout) as RawHit[];
  } catch {
    return [];
  }
}

export interface IngestResult extends EngineResult {
  /** Documents the engine could not store. It exits 0 anyway, so they are counted from its output. */
  fallidos: number;
  primerFallo: string | null;
}

/** Indexes the reviewed documents of a source. Slow: embeddings are computed on the CPU. */
export async function ingestLibrary(id: string): Promise<IngestResult> {
  const r = await runEngine(
    [
      "scrape",
      id,
      `file://${join(readyRoot(), id)}`,
      "--replace",
      "--max-pages",
      "6000",
      "-c",
      "2",
    ],
    48 * 60 * 60 * 1000,
  );
  const failures = `${r.stdout}\n${r.stderr}`
    .split("\n")
    .filter((l) => /Failed to (process|add)/.test(l));
  const first = failures[0]?.replace(/^.*?(Failed to)/, "$1") ?? null;
  return { ...r, fallidos: failures.length, primerFallo: first };
}

/** True when the local embeddings server answers; never throws. */
export async function embeddingsReachable(timeoutMs = 3000): Promise<boolean> {
  try {
    const { base } = embedding();
    const res = await fetch(`${base.replace(/\/$/, "")}/models`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}
