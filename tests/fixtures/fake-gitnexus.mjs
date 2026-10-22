// Stand-in for `gitnexus`: answers `--version` and serves a tiny MCP over stdio.
// Used only by tests; it contains none of GitNexus's code.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

if (process.argv.includes("--version")) {
  console.log("fake-gitnexus 0.0.0");
  process.exit(0);
}

const wanted = (process.env.FAKE_GITNEXUS_TOOLS ?? "query,impact,context").split(",");
const server = new McpServer({ name: "fake-gitnexus", version: "0.0.0" });
const text = (value) => ({ content: [{ type: "text", text: value }] });

if (wanted.includes("query")) {
  server.registerTool("query", { description: "search", inputSchema: { query: z.string() } }, async ({ query }) =>
    text(JSON.stringify([{ id: `fake#${query}`, name: query, kind: "function", file: "fake.ts", line: 7 }])),
  );
}
if (wanted.includes("impact")) {
  server.registerTool("impact", { description: "blast radius", inputSchema: { target: z.string() } }, async ({ target }) =>
    text(`blast radius of ${target}: 3 callers`),
  );
}
if (wanted.includes("context")) {
  server.registerTool("context", { description: "360 view", inputSchema: { name: z.string() } }, async ({ name }) =>
    text(`context for ${name}: calls helper()`),
  );
}

await server.connect(new StdioServerTransport());
