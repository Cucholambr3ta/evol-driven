import { readFileSync } from "node:fs";
import type { Reader } from "./config.js";

export class ReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReaderError";
  }
}

function apiKey(reader: Reader): string | undefined {
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
export async function askReader(reader: Reader, system: string, user: string): Promise<string> {
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
  return content;
}
