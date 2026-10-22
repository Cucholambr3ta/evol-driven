import { spawnSync } from "node:child_process";
import { callTool, connectStdio, splitCommand } from "../mcp.js";
import type { McpConnection } from "../mcp.js";
import type {
  Availability,
  CodeIntelProvider,
  ImpactResult,
  SymbolRef,
  TraceResult,
} from "./provider.js";
import { ProviderUnavailableError } from "./provider.js";

const ARGUMENT_NAMES = ["target", "symbol", "name", "query"];

function gitnexusCommand(): { command: string; args: string[] } {
  const { command, args } = splitCommand(process.env["EVOL_GITNEXUS_CMD"] ?? "gitnexus");
  return { command, args: [...args, "mcp"] };
}

function ref(query: string): SymbolRef {
  return { id: query, kind: "unknown", name: query, file: "", line: 0 };
}

/**
 * Optional provider that talks to a GitNexus the user installed. Nothing of GitNexus is bundled.
 * Its MCP tools are called by name (`query`, `impact`, `context`); their text output is returned
 * as `raw` because its format is not part of this package's contract.
 */
export class GitNexusProvider implements CodeIntelProvider {
  readonly name = "gitnexus";

  available(): Promise<Availability> {
    const { command, args } = gitnexusCommand();
    const probe = spawnSync(command, [...args.slice(0, -1), "--version"], {
      encoding: "utf8",
      timeout: 20_000,
    });
    if (probe.error || probe.status !== 0) {
      return Promise.resolve({
        ok: false,
        detail: `no se encontró «${command}» (instálalo tú; su licencia es PolyForm Noncommercial)`,
      });
    }
    return Promise.resolve({ ok: true, detail: `${command} ${probe.stdout.trim()}`.trim() });
  }

  private async call(tool: string, query: string): Promise<string> {
    const availability = await this.available();
    if (!availability.ok) throw new ProviderUnavailableError(this.name, availability.detail);
    const { command, args } = gitnexusCommand();
    let connection: McpConnection;
    try {
      connection = await connectStdio(command, args, { timeoutMs: 60_000 });
    } catch (error) {
      throw new ProviderUnavailableError(this.name, (error as Error).message);
    }
    try {
      const tools = (await connection.client.listTools()).tools;
      const found = tools.find((t) => t.name === tool);
      if (!found)
        throw new ProviderUnavailableError(this.name, `su MCP no ofrece la herramienta «${tool}»`);
      const properties = Object.keys(
        (found.inputSchema.properties ?? {}) as Record<string, unknown>,
      );
      const argument =
        ARGUMENT_NAMES.find((n) => properties.includes(n)) ?? properties[0] ?? "query";
      const out = await callTool(connection, tool, { [argument]: query });
      if (out.isError)
        throw new ProviderUnavailableError(this.name, out.text || `«${tool}» devolvió un error`);
      return out.text;
    } finally {
      await connection.close().catch(() => undefined);
    }
  }

  async findSymbol(query: string): Promise<SymbolRef[]> {
    const text = await this.call("query", query);
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
          .map((x) => ({
            id: String(x["id"] ?? x["name"] ?? query),
            kind: String(x["kind"] ?? "unknown"),
            name: String(x["name"] ?? query),
            file: String(x["file"] ?? ""),
            line: Number(x["line"] ?? 0),
          }));
      }
    } catch {
      // Not JSON: nothing structured to return.
    }
    return [];
  }

  async impact(query: string): Promise<ImpactResult> {
    return { target: ref(query), dependents: [], raw: await this.call("impact", query) };
  }

  async trace(query: string): Promise<TraceResult> {
    return { entry: ref(query), steps: [], raw: await this.call("context", query) };
  }
}
