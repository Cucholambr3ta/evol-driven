import { join, resolve } from "node:path";
import { GRAPH_FILE, indexProject, isTestPath } from "../codeintel/native/indexer.js";
import { GraphStore } from "../codeintel/native/store.js";
import type { EvolConfig } from "../core/config.js";
import { buildExport } from "../core/export.js";
import { journalRead } from "../core/journal.js";
import type { PipelineContext } from "../core/pipeline.js";
import type { CodeGraph, DiagramInput, DiagramOptions } from "./model.js";

/** The code graph of the native indexer, or null when another provider is configured. */
export function loadCodeGraph(root: string, config: EvolConfig): CodeGraph | null {
  if (config.codeIntel !== "native") return null;
  indexProject(root);
  const store = new GraphStore(join(resolve(root), GRAPH_FILE));
  try {
    const { nodes, edges } = store.dump();
    return { nodes, edges, byId: new Map(nodes.map((n) => [n.id, n])) };
  } finally {
    store.close();
  }
}

export function collectInput(ctx: PipelineContext, options: DiagramOptions = {}): DiagramInput {
  return {
    ctx,
    data: buildExport(ctx),
    graph: loadCodeGraph(ctx.root, ctx.config),
    journal: journalRead(ctx.root),
    options,
  };
}

/** Source files of the project that are not tests. */
export function sourceFiles(graph: CodeGraph): string[] {
  return graph.nodes
    .filter((n) => n.kind === "file" && !isTestPath(n.file))
    .map((n) => n.file)
    .sort();
}

/**
 * Component of a file: its module when the project has several, otherwise its first two folders
 * (`src/core/a.ts` -> `src/core`, `src/cli.ts` -> `src`).
 */
export function componentOf(file: string, config: EvolConfig): string {
  if (config.modules.length > 1) {
    const owner = config.modules
      .filter((m) => m.root !== "." && file.startsWith(`${m.root.replace(/\/$/, "")}/`))
      .sort((a, b) => b.root.length - a.root.length)[0];
    if (owner) return owner.name;
  }
  const dirs = file.split("/").slice(0, -1);
  return dirs.length === 0 ? "(raíz)" : dirs.slice(0, 2).join("/");
}

export function folderOf(file: string): string {
  const dirs = file.split("/").slice(0, -1);
  return dirs.length === 0 ? "(raíz)" : dirs.join("/");
}

/** Edges of `kind` between files, grouped by `group` of source and target, self-links dropped. */
export function groupedLinks(
  graph: CodeGraph,
  kind: string,
  group: (file: string) => string,
): Map<string, { from: string; to: string; count: number }> {
  const links = new Map<string, { from: string; to: string; count: number }>();
  for (const e of graph.edges) {
    if (e.kind !== kind) continue;
    const src = graph.byId.get(e.src);
    const dst = graph.byId.get(e.dst);
    if (!src || !dst || isTestPath(src.file) || isTestPath(dst.file)) continue;
    const [from, to] = [group(src.file), group(dst.file)];
    if (from === to) continue;
    const key = `${from}\u0000${to}`;
    const link = links.get(key) ?? { from, to, count: 0 };
    link.count += 1;
    links.set(key, link);
  }
  return links;
}
