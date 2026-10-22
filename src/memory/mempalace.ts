import { UserError } from "../core/errors.js";
import { callTool, connectStdio, splitCommand } from "../mcp.js";
import type { McpConnection } from "../mcp.js";

export class MemoryUnavailableError extends UserError {
  constructor(detail: string) {
    super(
      `No se pudo usar MemPalace: ${detail}\n` +
        "Instálalo con `uv tool install mempalace` (dependencia externa; ver DEPENDENCIES.md).",
    );
    this.name = "MemoryUnavailableError";
  }
}

export interface MemPalaceOptions {
  /** Overrides EVOL_MEMPALACE_PALACE. Used by tests to avoid touching the user's palace. */
  palacePath?: string;
  timeoutMs?: number;
}

export interface MemoryHit {
  id: string;
  text: string;
  wing: string;
  room: string;
  score?: number;
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export class MemPalace {
  constructor(private readonly connection: McpConnection) {}

  async addDrawer(data: {
    wing: string;
    room: string;
    content: string;
    source?: string;
    addedBy?: string;
  }): Promise<string> {
    const out = await callTool(this.connection, "mempalace_add_drawer", {
      wing: data.wing,
      room: data.room,
      content: data.content,
      ...(data.source ? { source_file: data.source } : {}),
      added_by: data.addedBy ?? "evol",
    });
    const body = parseJson(out.text);
    if (out.isError || body["success"] === false) {
      throw new UserError(`MemPalace rechazó el guardado: ${String(body["error"] ?? out.text)}`);
    }
    return String(body["drawer_id"] ?? "");
  }

  async search(data: {
    query: string;
    wing?: string;
    room?: string;
    limit?: number;
  }): Promise<MemoryHit[]> {
    const out = await callTool(this.connection, "mempalace_search", {
      query: data.query,
      limit: data.limit ?? 5,
      ...(data.wing ? { wing: data.wing } : {}),
      ...(data.room ? { room: data.room } : {}),
    });
    if (out.isError) throw new UserError(`MemPalace falló en la búsqueda: ${out.text}`);
    const results = parseJson(out.text)["results"];
    if (!Array.isArray(results)) return [];
    return results.map((r: Record<string, unknown>) => {
      const score = r["similarity"] ?? r["score"];
      return {
        id: String(r["drawer_id"] ?? ""),
        text: String(r["text"] ?? ""),
        wing: String(r["wing"] ?? ""),
        room: String(r["room"] ?? ""),
        ...(typeof score === "number" ? { score } : {}),
      };
    });
  }

  async status(): Promise<Record<string, unknown>> {
    const out = await callTool(this.connection, "mempalace_status", {});
    return parseJson(out.text);
  }
}

export function mempalaceCommand(options: MemPalaceOptions = {}): {
  command: string;
  args: string[];
} {
  const spec = process.env["EVOL_MEMPALACE_CMD"] ?? "mempalace-mcp";
  const { command, args } = splitCommand(spec);
  const palace = options.palacePath ?? process.env["EVOL_MEMPALACE_PALACE"];
  return { command, args: palace ? [...args, "--palace", palace] : args };
}

/** Opens a MemPalace session for `fn` and always closes it. */
export async function withMemPalace<T>(
  fn: (memory: MemPalace) => Promise<T>,
  options: MemPalaceOptions = {},
): Promise<T> {
  const { command, args } = mempalaceCommand(options);
  let connection: McpConnection;
  try {
    connection = await connectStdio(command, args, { timeoutMs: options.timeoutMs ?? 90_000 });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new MemoryUnavailableError(
      code === "ENOENT" ? `no se encontró el comando «${command}»` : (error as Error).message,
    );
  }
  try {
    return await fn(new MemPalace(connection));
  } finally {
    await connection.close().catch(() => undefined);
  }
}
