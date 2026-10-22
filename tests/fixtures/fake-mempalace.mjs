// Stand-in for `mempalace-mcp`: serves mempalace_search over stdio from a JSON file of drawers.
// Similarity is the word overlap (Jaccard) between query and text. Used only by tests.
import { appendFileSync, readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

if (process.argv.includes("--help")) process.exit(0);

const words = (s) => new Set(s.toLowerCase().match(/\p{L}{4,}/gu) ?? []);
const text = (value) => ({ content: [{ type: "text", text: value }] });
const server = new McpServer({ name: "fake-mempalace", version: "0.0.0" });

server.registerTool(
  "mempalace_search",
  {
    description: "search",
    inputSchema: {
      query: z.string(),
      limit: z.number().optional(),
      wing: z.string().optional(),
      room: z.string().optional(),
    },
  },
  async (args) => {
    if (process.env.FAKE_MEMPALACE_LOG) appendFileSync(process.env.FAKE_MEMPALACE_LOG, `${JSON.stringify(args)}\n`);
    const drawers = JSON.parse(readFileSync(process.env.FAKE_MEMPALACE_DATA, "utf8"));
    const q = words(args.query);
    const results = drawers
      .filter((d) => (!args.wing || d.wing === args.wing) && (!args.room || d.room === args.room))
      .map((d) => {
        const t = words(d.text);
        const shared = [...q].filter((w) => t.has(w)).length;
        const union = new Set([...q, ...t]).size;
        return { drawer_id: d.id, text: d.text, wing: d.wing, room: d.room, similarity: union ? shared / union : 0 };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, args.limit ?? 5);
    return text(JSON.stringify({ results }));
  },
);

await server.connect(new StdioServerTransport());
