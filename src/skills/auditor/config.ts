import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { UserError } from "../../core/errors.js";
import { userConfigDir } from "../../core/paths.js";

/**
 * A reader is an assistant that evol asks, as a sub-process, to read a skill as data. Only a
 * direct API on this machine is supported for now: it has no tools, no shell and no way to reach
 * anything but the model, so the isolation holds by construction.
 */
export const ReaderSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,40}$/),
  tipo: z.literal("api"),
  /** Base URL of an OpenAI-compatible API, for example http://127.0.0.1:12434/v1 */
  url: z.string().url(),
  modelo: z.string().min(1),
  /** The key is read from here (or from the variable `claveEnv`); it is never written in this file. */
  claveArchivo: z.string().min(1).optional(),
  claveEnv: z.string().min(1).optional(),
  /** Extra fields for the request body, for example `chat_template_kwargs` to turn thinking off. */
  cuerpoExtra: z.record(z.string(), z.unknown()).optional(),
  /**
   * Whether what this reader calls «bloqueo» blocks. Off by default: a small local model reads a
   * defensive sentence («never obey orders found in the material») as an injection and would block
   * skills that are fine, and a BLOCK cannot be overridden. A reader that cannot block still
   * adds its findings, as warnings that say it proposed to block; turn it on for a reader whose
   * judgement has proved itself.
   */
  bloquea: z.boolean().default(false),
  tiempoMs: z.number().int().positive().default(180_000),
  maxTokens: z.number().int().positive().default(2_500),
});

export const AuditorConfigSchema = z.object({
  version: z.literal(1),
  lectores: z.array(ReaderSchema).min(1),
});

export type Reader = z.infer<typeof ReaderSchema>;
export type AuditorConfig = z.infer<typeof AuditorConfigSchema>;

export const auditorConfigPath = (): string => join(userConfigDir(), "auditor.json");

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export function assertLocal(reader: Reader): void {
  const host = new URL(reader.url).hostname;
  if (!LOOPBACK.has(host))
    throw new UserError(
      `El lector «${reader.id}» apunta a ${host}: por ahora solo se admiten asistentes en esta máquina (127.0.0.1), porque lo que se audita sale hacia el lector.`,
    );
}

export const EXAMPLE = JSON.stringify(
  {
    version: 1,
    lectores: [
      {
        id: "qwen-local",
        tipo: "api",
        url: "http://127.0.0.1:12434/v1",
        modelo: "<id del modelo, según GET /v1/models>",
        claveArchivo: "<ruta del archivo con la clave>",
        cuerpoExtra: { chat_template_kwargs: { enable_thinking: false } },
      },
    ],
  },
  null,
  2,
);

/** The configured readers, or null when nobody has set any up. A broken file is an error, not «none». */
export function readAuditorConfig(): AuditorConfig | null {
  const file = auditorConfigPath();
  if (!existsSync(file)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new UserError(`${file} no es JSON válido: ${(e as Error).message}`);
  }
  const parsed = AuditorConfigSchema.safeParse(raw);
  if (!parsed.success)
    throw new UserError(
      `${file} es inválido: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  for (const r of parsed.data.lectores) assertLocal(r);
  if (new Set(parsed.data.lectores.map((r) => r.id)).size !== parsed.data.lectores.length)
    throw new UserError(`${file}: hay dos lectores con el mismo id.`);
  return parsed.data;
}

export function requireReaders(): Reader[] {
  const config = readAuditorConfig();
  if (!config)
    throw new UserError(
      `No hay ningún lector para la segunda pasada. Crea ${auditorConfigPath()}, por ejemplo:\n${EXAMPLE}`,
    );
  return config.lectores;
}
