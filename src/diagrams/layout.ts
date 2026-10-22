import { spawnSync } from "node:child_process";
import { UserError } from "../core/errors.js";

export class ToolUnavailableError extends UserError {
  constructor(tool: string, detail: string) {
    super(`No se puede generar los diagramas: ${tool} no está disponible (${detail}).`);
    this.name = "ToolUnavailableError";
  }
}

export interface LayoutNode {
  id: string;
  w: number;
  h: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export interface LayoutCluster {
  id: string;
  members: string[];
  /** Nested clusters. */
  children?: LayoutCluster[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  width: number;
  height: number;
  nodes: Map<string, Rect>;
  clusters: Map<string, Rect>;
  /** Spline points per edge, in the order edges were given (3n+1 Bézier points). */
  edges: [number, number][][];
}

export interface LayoutOptions {
  rankdir?: "TB" | "LR";
  nodesep?: number;
  ranksep?: number;
  clusterPadding?: number;
}

const PX_PER_INCH = 72;

/** True when `dot` runs. Cached per process. */
let graphvizChecked: string | null | undefined;
export function graphvizVersion(): string | null {
  if (graphvizChecked !== undefined) return graphvizChecked;
  const r = spawnSync("dot", ["-V"], { encoding: "utf8" });
  graphvizChecked = r.error || r.status !== 0 ? null : `${r.stderr}${r.stdout}`.trim();
  return graphvizChecked;
}

function emitCluster(
  c: LayoutCluster,
  index: { n: number },
  ids: Map<string, string>,
  pad: number,
): string {
  const name = `cluster_${index.n++}`;
  const own = c.members.map((m) => `${ids.get(m)};`).join(" ");
  const children = (c.children ?? [])
    .map((child) => emitCluster(child, index, ids, pad))
    .join("\n");
  return `subgraph ${name} { margin=${pad}; label=""; ${own}\n${children}\n}`;
}

/**
 * Positions nodes with Graphviz (`dot -Tplain`). Boxes keep the sizes we give them, so the result
 * does not depend on any font. Throws ToolUnavailableError when Graphviz is not installed.
 */
export function layoutGraph(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions = {},
  clusters: LayoutCluster[] = [],
): LayoutResult {
  if (graphvizVersion() === null) {
    throw new ToolUnavailableError(
      "Graphviz (dot)",
      "instálalo con tu gestor de paquetes, p. ej. `pacman -S graphviz`",
    );
  }
  const pad = options.clusterPadding ?? 30;
  const ids = new Map(nodes.map((node, i) => [node.id, `n${i}`]));
  const index = { n: 0 };
  const source = [
    "digraph G {",
    `graph [rankdir=${options.rankdir ?? "TB"}, nodesep=${options.nodesep ?? 0.45}, ranksep=${options.ranksep ?? 0.7}, newrank=true];`,
    'node [shape=box, fixedsize=true, label=""];',
    "edge [arrowhead=none];",
    ...nodes.map(
      (node) =>
        `${ids.get(node.id)} [width=${node.w / PX_PER_INCH}, height=${node.h / PX_PER_INCH}];`,
    ),
    ...clusters.map((c) => emitCluster(c, index, ids, pad)),
    ...edges.map((e) => `${ids.get(e.from)} -> ${ids.get(e.to)};`),
    "}",
  ].join("\n");

  const run = spawnSync("dot", ["-Tplain"], {
    input: source,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0) {
    throw new ToolUnavailableError(
      "Graphviz (dot)",
      `falló: ${run.stderr.trim().split("\n")[0] ?? "sin detalle"}`,
    );
  }

  const byName = new Map([...ids].map(([id, name]) => [name, id]));
  let width = 0;
  let height = 0;
  const placed = new Map<string, Rect>();
  const splines = new Map<string, [number, number][][]>();
  const lines = run.stdout.split("\n");
  for (const line of lines) {
    const f = line.trim().split(/\s+/);
    if (f[0] === "graph") {
      width = Number(f[2]) * PX_PER_INCH;
      height = Number(f[3]) * PX_PER_INCH;
    }
  }
  const flip = (y: number): number => height - y * PX_PER_INCH;
  for (const line of lines) {
    const f = line.trim().split(/\s+/);
    if (f[0] === "node") {
      const id = byName.get(f[1] ?? "");
      const [cx, cy, w, h] = [Number(f[2]), Number(f[3]), Number(f[4]), Number(f[5])];
      if (id) {
        placed.set(id, {
          x: cx * PX_PER_INCH - (w * PX_PER_INCH) / 2,
          y: flip(cy) - (h * PX_PER_INCH) / 2,
          w: w * PX_PER_INCH,
          h: h * PX_PER_INCH,
        });
      }
    } else if (f[0] === "edge") {
      const count = Number(f[3]);
      const points: [number, number][] = [];
      for (let i = 0; i < count; i++) {
        points.push([Number(f[4 + i * 2]) * PX_PER_INCH, flip(Number(f[5 + i * 2]))]);
      }
      const key = `${byName.get(f[1] ?? "")}\u0000${byName.get(f[2] ?? "")}`;
      splines.set(key, [...(splines.get(key) ?? []), points]);
    }
  }

  const ordered = edges.map((e) => splines.get(`${e.from}\u0000${e.to}`)?.shift() ?? []);

  const clusterRects = new Map<string, Rect>();
  const boundsOf = (c: LayoutCluster, depth: number): Rect | null => {
    const rects: Rect[] = c.members.flatMap((m) => placed.get(m) ?? []);
    for (const child of c.children ?? []) {
      const r = boundsOf(child, depth + 1);
      if (r) rects.push(r);
    }
    if (rects.length === 0) return null;
    const x1 = Math.min(...rects.map((r) => r.x)) - pad;
    const y1 = Math.min(...rects.map((r) => r.y)) - pad;
    const x2 = Math.max(...rects.map((r) => r.x + r.w)) + pad;
    const y2 = Math.max(...rects.map((r) => r.y + r.h)) + pad;
    const rect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    clusterRects.set(c.id, rect);
    return rect;
  };
  for (const c of clusters) boundsOf(c, 0);

  return { width, height, nodes: placed, clusters: clusterRects, edges: ordered };
}

/** Anything outside [0, width] x [0, height] (clusters can poke out) grows the canvas. */
export function extent(result: LayoutResult): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const rects = [...result.nodes.values(), ...result.clusters.values()];
  const minX = Math.min(0, ...rects.map((r) => r.x));
  const minY = Math.min(0, ...rects.map((r) => r.y));
  const maxX = Math.max(result.width, ...rects.map((r) => r.x + r.w));
  const maxY = Math.max(result.height, ...rects.map((r) => r.y + r.h));
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}
