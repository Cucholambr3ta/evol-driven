import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Reader } from "./config.js";

/** What a reader answered, and which model it says it used (only a CLI can tell). */
export interface Answer {
  texto: string;
  modelo?: string;
}

type ApiReader = Extract<Reader, { tipo: "api" }>;
type CliReader = Extract<Reader, { tipo: "cli" }>;

export class ReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReaderError";
  }
}

function apiKey(reader: ApiReader): string | undefined {
  if (reader.claveArchivo) {
    try {
      return readFileSync(reader.claveArchivo, "utf8").trim();
    } catch {
      throw new ReaderError(
        `no se pudo leer la clave del lector «${reader.id}» (${reader.claveArchivo})`,
      );
    }
  }
  if (reader.claveEnv) return process.env[reader.claveEnv];
  return undefined;
}

/**
 * Sends one prompt to the reader and returns the text it answered. There are no tools and no
 * redirects, and the request carries nothing but the prompt. Anything that is not a clean answer
 * (it is down, it takes too long, it replies with an error or with nothing) is an error: the audit
 * fails closed.
 */
async function askApi(reader: ApiReader, system: string, user: string): Promise<Answer> {
  const key = apiKey(reader);
  let response: Response;
  try {
    response = await fetch(`${reader.url.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(reader.tiempoMs),
      headers: {
        "content-type": "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model: reader.modelo,
        temperature: 0,
        max_tokens: reader.maxTokens,
        ...reader.cuerpoExtra,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    const name = (e as Error).name;
    throw new ReaderError(
      name === "TimeoutError"
        ? `el lector «${reader.id}» no respondió en ${Math.round(reader.tiempoMs / 1000)} s`
        : `no se pudo hablar con el lector «${reader.id}»: ${(e as Error).message}`,
    );
  }
  if (!response.ok)
    throw new ReaderError(`el lector «${reader.id}» respondió con el error ${response.status}`);
  let body: { choices?: { message?: { content?: unknown } }[] };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new ReaderError(`el lector «${reader.id}» no devolvió JSON`);
  }
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "")
    throw new ReaderError(`el lector «${reader.id}» devolvió una respuesta vacía`);
  return { texto: content };
}

/**
 * Claude Code in non-interactive mode, with everything that could contaminate or act turned off: no
 * tools at all, no MCP servers, no skills or commands, no settings files (so no hooks), no saved
 * session, and the system prompt replaced by ours. It runs in a fresh empty folder, so nothing of a
 * project is around to load. The skill reaches it only through standard input.
 */
async function askClaude(reader: CliReader, system: string, user: string): Promise<Answer> {
  const cwd = mkdtempSync(join(tmpdir(), "evol-lector-"));
  const args = [
    "-p",
    "--tools",
    "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--setting-sources",
    "",
    "--no-session-persistence",
    "--output-format",
    "json",
    "--system-prompt",
    system,
    ...(reader.modelo ? ["--model", reader.modelo] : []),
  ];
  try {
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(reader.comando, args, {
        cwd,
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        try {
          if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
        } catch {
          /* it already ended */
        }
        reject(
          new ReaderError(
            `el lector «${reader.id}» no respondió en ${Math.round(reader.tiempoMs / 1000)} s`,
          ),
        );
      }, reader.tiempoMs);
      child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(new ReaderError(`no se pudo ejecutar «${reader.comando}»: ${e.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0)
          reject(
            new ReaderError(
              `el lector «${reader.id}» terminó con el código ${code}: ${(stderr || stdout).trim().split("\n")[0]?.slice(0, 200) ?? ""}`,
            ),
          );
        else resolve(stdout);
      });
      child.stdin.on("error", () => undefined);
      child.stdin.end(user);
    });
    let parsed: { result?: unknown; is_error?: unknown; modelUsage?: Record<string, unknown> };
    try {
      parsed = JSON.parse(out) as typeof parsed;
    } catch {
      throw new ReaderError(`el lector «${reader.id}» no devolvió JSON`);
    }
    if (
      parsed.is_error === true ||
      typeof parsed.result !== "string" ||
      parsed.result.trim() === ""
    )
      throw new ReaderError(`el lector «${reader.id}» devolvió una respuesta vacía o con error`);
    const modelo = Object.keys(parsed.modelUsage ?? {})[0];
    return { texto: parsed.result, ...(modelo ? { modelo } : {}) };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

export function askReader(reader: Reader, system: string, user: string): Promise<Answer> {
  return reader.tipo === "api" ? askApi(reader, system, user) : askClaude(reader, system, user);
}
