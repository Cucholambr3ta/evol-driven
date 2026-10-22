import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { packageVersion } from "./core/paths.js";

export interface McpConnection {
  client: Client;
  close(): Promise<void>;
}

/** Splits an override such as "node /path/server.mjs" into command and arguments. */
export function splitCommand(spec: string): { command: string; args: string[] } {
  const [command = "", ...args] = spec.trim().split(/\s+/);
  return { command, args };
}

function toEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  return { ...env, ...extra };
}

export async function connectStdio(
  command: string,
  args: string[],
  options: { env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<McpConnection> {
  const transport = new StdioClientTransport({
    command,
    args,
    env: toEnv(options.env),
    stderr: "ignore",
  });
  const client = new Client({ name: "evol", version: packageVersion() }, { capabilities: {} });
  const timeoutMs = options.timeoutMs ?? 60_000;
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      client.connect(transport),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`sin respuesta tras ${timeoutMs / 1000}s`)),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    await transport.close().catch(() => undefined);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
  return { client, close: () => client.close() };
}

export interface ToolOutput {
  text: string;
  isError: boolean;
}

export async function callTool(
  connection: McpConnection,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolOutput> {
  const result = (await connection.client.callTool({ name, arguments: args })) as {
    content?: { type: string; text?: string }[];
    isError?: boolean;
  };
  const text = (result.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  return { text, isError: result.isError === true };
}
