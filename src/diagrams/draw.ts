import type { BoxContent, Canvas, EdgeStyle, ShapeStyle } from "./svg.js";
import { THEME, drawBox, boxSize, edge, rect, text, textWidth } from "./svg.js";
import { extent, layoutGraph } from "./layout.js";
import type { LayoutCluster, LayoutOptions, LayoutResult, Rect } from "./layout.js";

const GRID_GAP = 24;
const GRID_MIN_WIDTH = 900;

export interface GraphNode {
  id: string;
  content: BoxContent;
  style?: ShapeStyle;
  /** Overrides the default size (from the content). */
  size?: { w: number; h: number };
  /** Replaces the default box drawing. Receives the final rectangle. */
  draw?: (r: Rect) => string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  style?: EdgeStyle;
  label?: string;
  /** Draw from `to` to `from`: the layout runs one way, the UML arrow points the other. */
  reverse?: boolean;
  /** Only shapes the layout (keeps two nodes close); nothing is drawn. */
  hidden?: boolean;
}

export interface GraphCluster {
  tree: LayoutCluster;
  /** Label per cluster id (also for nested ones). */
  labels: Map<string, string>;
  style?: ShapeStyle;
}

export interface GraphSpec {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: GraphCluster;
  options?: LayoutOptions;
  /** Free space around the drawing, for things `extra` draws outside the layout. */
  padding?: { left?: number; right?: number; top?: number; bottom?: number };
  /** Called after layout, with the final rectangles, to add shapes of its own (ports, notes). */
  extra?: (placed: Map<string, Rect>, clusters: Map<string, Rect>) => string[];
}

/** Puts `labelId` in the deepest cluster that holds both ends of an edge, if there is one. */
function addToCommonCluster(roots: LayoutCluster[], a: string, b: string, labelId: string): void {
  const pathTo = (node: string, level: LayoutCluster[]): LayoutCluster[] | null => {
    for (const c of level) {
      if (c.members.includes(node)) return [c];
      const inner = pathTo(node, c.children ?? []);
      if (inner) return [c, ...inner];
    }
    return null;
  };
  const pa = pathTo(a, roots);
  const pb = pathTo(b, roots);
  if (!pa || !pb) return;
  let common: LayoutCluster | undefined;
  for (let i = 0; i < Math.min(pa.length, pb.length) && pa[i] === pb[i]; i++) common = pa[i];
  common?.members.push(labelId);
}

function flattenClusters(c: LayoutCluster): LayoutCluster[] {
  return [c, ...(c.children ?? []).flatMap(flattenClusters)];
}

/** Lays the graph out with Graphviz and draws it: clusters, then edges, then boxes. */
export function renderGraph(spec: GraphSpec, roots: LayoutCluster[] = []): Canvas {
  const sized = spec.nodes.map((node) => {
    const size = node.size ?? boxSize(node.content);
    return { ...node, w: size.w, h: size.h };
  });
  // Nodes with no edge and no cluster would all land on one very wide row: they go in a grid instead.
  const linked = new Set(spec.edges.flatMap((e) => [e.from, e.to]));
  const clustered = new Set(roots.flatMap(flattenClusters).flatMap((c) => c.members));
  const isolated = sized.filter((s) => !linked.has(s.id) && !clustered.has(s.id));
  const connected = sized.filter((s) => !isolated.includes(s));
  // A label is a small node on its own: Graphviz then leaves room for it whatever the fonts are.
  const layoutRoots: LayoutCluster[] = structuredClone(roots);
  const layoutEdges: { from: string; to: string }[] = [];
  const labelNodes: { id: string; w: number; h: number; text: string }[] = [];
  const slots: { first: number; second: number | null; label: string | null }[] = [];
  spec.edges.forEach((e, i) => {
    if (e.label && !e.hidden) {
      const id = `label:${i}`;
      labelNodes.push({ id, w: textWidth(e.label, 11) + 14, h: 18, text: e.label });
      addToCommonCluster(layoutRoots, e.from, e.to, id);
      slots.push({ first: layoutEdges.length, second: layoutEdges.length + 1, label: id });
      layoutEdges.push({ from: e.from, to: id }, { from: id, to: e.to });
    } else {
      slots.push({ first: layoutEdges.length, second: null, label: null });
      layoutEdges.push({ from: e.from, to: e.to });
    }
  });
  const layout: LayoutResult =
    connected.length === 0
      ? { width: 0, height: 0, nodes: new Map(), clusters: new Map(), edges: [] }
      : layoutGraph(
          [...connected.map((s) => ({ id: s.id, w: s.w, h: s.h })), ...labelNodes],
          layoutEdges,
          spec.options,
          layoutRoots,
        );
  const gridTop = connected.length === 0 ? 0 : layout.height + GRID_GAP * 2;
  const gridWidth = Math.max(layout.width, GRID_MIN_WIDTH);
  let gx = 0;
  let gy = gridTop;
  let rowHeight = 0;
  let usedWidth = 0;
  for (const node of isolated) {
    if (gx > 0 && gx + node.w > gridWidth) {
      gx = 0;
      gy += rowHeight + GRID_GAP;
      rowHeight = 0;
    }
    layout.nodes.set(node.id, { x: gx, y: gy, w: node.w, h: node.h });
    gx += node.w + GRID_GAP;
    usedWidth = Math.max(usedWidth, gx - GRID_GAP);
    rowHeight = Math.max(rowHeight, node.h);
  }
  if (isolated.length > 0) {
    layout.width = Math.max(layout.width, usedWidth);
    layout.height = gy + rowHeight;
  }
  const box = extent(layout);
  const pad = { left: 0, right: 0, top: 0, bottom: 0, ...spec.padding };
  const [dx, dy] = [-box.minX + pad.left, -box.minY + pad.top];
  const shift = (r: Rect): Rect => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });

  const parts: string[] = [];
  const placed = new Map([...layout.nodes].map(([id, r]) => [id, shift(r)]));
  const clusterRects = new Map([...layout.clusters].map(([id, r]) => [id, shift(r)]));

  if (spec.clusters) {
    // Outer clusters first so inner ones are drawn over them.
    for (const c of roots.flatMap(flattenClusters)) {
      const r = clusterRects.get(c.id);
      if (!r) continue;
      parts.push(
        rect(r.x, r.y, r.w, r.h, {
          fill: "none",
          stroke: THEME.line,
          dash: true,
          rx: 6,
          ...spec.clusters.style,
        }),
      );
      const label = spec.clusters.labels.get(c.id);
      if (label)
        parts.push(
          text(r.x + 10, r.y + 16, label, { size: 12, weight: "bold", fill: THEME.muted }),
        );
    }
  }

  const labels: string[] = [];
  spec.edges.forEach((e, i) => {
    const slot = slots[i];
    if (!slot || e.hidden) return;
    const first = layout.edges[slot.first] ?? [];
    const second = slot.second === null ? null : (layout.edges[slot.second] ?? []);
    let raw = first;
    if (second && first.length > 0 && second.length > 0) {
      // Both halves are Bézier chains; a straight Bézier through the label joins them.
      const end = first[first.length - 1] as [number, number];
      const start = second[0] as [number, number];
      raw = [...first, end, start, start, ...second.slice(1)];
    }
    if (raw.length === 0) return;
    const points = raw.map(([x, y]): [number, number] => [x + dx, y + dy]);
    parts.push(edge(e.reverse ? [...points].reverse() : points, e.style));
    const box = slot.label ? placed.get(slot.label) : undefined;
    if (box && e.label) {
      labels.push(
        rect(box.x, box.y, box.w, box.h, { fill: THEME.paper, stroke: THEME.paper, width: 0 }),
      );
      labels.push(
        text(box.x + box.w / 2, box.y + box.h / 2 + 4, e.label, {
          size: 11,
          anchor: "middle",
          fill: THEME.muted,
        }),
      );
    }
  });
  parts.push(...labels);

  for (const node of sized) {
    const r = placed.get(node.id);
    if (!r) continue;
    parts.push(
      ...(node.draw ? node.draw(r) : drawBox(r.x, r.y, r.w, r.h, node.content, node.style)),
    );
  }
  if (spec.extra) parts.push(...spec.extra(placed, clusterRects));

  return {
    parts,
    width: box.width + pad.left + pad.right,
    height: box.height + pad.top + pad.bottom,
  };
}

export { textWidth };
