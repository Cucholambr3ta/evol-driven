import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import YAML from "yaml";
import { isTestPath } from "../codeintel/native/indexer.js";
import { appliesIn } from "../core/disciplines.js";
import { PHASES } from "../core/phases.js";
import { matchFiles } from "../core/verify.js";
import { componentOf, folderOf, groupedLinks, sourceFiles } from "./data.js";
import { renderGraph } from "./draw.js";
import type { GraphEdge, GraphNode } from "./draw.js";
import type { LayoutCluster, Rect } from "./layout.js";
import { ok, notApplicable } from "./model.js";
import type { CodeGraph, Diagram, DiagramInput } from "./model.js";
import { THEME, clipToBox, edge, polygon, rect, text, textWidth, wrapDocument } from "./svg.js";
import type { BoxContent } from "./svg.js";

const NO_GRAPH =
  "el proveedor de código configurado (gitnexus) no expone el grafo; los diagramas de código necesitan codeIntel: native";

const ACCENT = { fill: THEME.accentFill, stroke: THEME.accent };
const MUTED = { fill: THEME.fill, stroke: THEME.line };

function shortFile(file: string): string {
  return basename(file);
}

/** Members of a class or interface: `Base.hello` -> `hello()`. */
function membersOf(graph: CodeGraph, id: string): string[] {
  return graph.edges
    .filter((e) => e.kind === "CONTAINS" && e.src === id)
    .map((e) => graph.byId.get(e.dst))
    .filter((n): n is NonNullable<typeof n> => n !== undefined && n.kind === "method")
    .map((n) => `${n.name.split(".").pop() ?? n.name}()`);
}

// 1 ── Clases ────────────────────────────────────────────────────────────────────────────────────
const CLASS_CAP = 30;

export function classDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de clases";
  const source = "Índice de código (EXTENDS y miembros CONTAINS)";
  const graph = input.graph;
  if (!graph) return notApplicable(1, title, source, NO_GRAPH);
  const types = graph.nodes.filter(
    (n) => (n.kind === "class" || n.kind === "interface") && !isTestPath(n.file),
  );
  if (types.length === 0) {
    return notApplicable(
      1,
      title,
      source,
      "el índice no contiene clases ni interfaces fuera de los tests",
    );
  }
  const ids = new Set(types.map((t) => t.id));
  const inherits = graph.edges.filter(
    (e) => e.kind === "EXTENDS" && ids.has(e.src) && ids.has(e.dst),
  );
  const linked = new Set(inherits.flatMap((e) => [e.src, e.dst]));
  const rank = (id: string): number => (linked.has(id) ? 0 : 1);
  const members = new Map(types.map((t) => [t.id, membersOf(graph, t.id)]));
  const chosen = [...types]
    .sort(
      (a, b) =>
        rank(a.id) - rank(b.id) ||
        (members.get(b.id)?.length ?? 0) - (members.get(a.id)?.length ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, CLASS_CAP);
  const shown = new Set(chosen.map((c) => c.id));
  const dupes = new Map<string, number>();
  for (const c of chosen) dupes.set(c.name, (dupes.get(c.name) ?? 0) + 1);

  const nodes: GraphNode[] = chosen
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => {
      const list = members.get(c.id) ?? [];
      const lines = list.length > 8 ? [...list.slice(0, 8), `… +${list.length - 8} más`] : list;
      return {
        id: c.id,
        content: {
          ...(c.kind === "interface" ? { stereotype: "interface" } : {}),
          title: (dupes.get(c.name) ?? 0) > 1 ? `${c.name} (${shortFile(c.file)})` : c.name,
          compartments: lines.length > 0 ? [lines] : [],
        },
        style: c.kind === "interface" ? ACCENT : MUTED,
      };
    });
  // Layout runs parent -> child (parents on top); the arrow is drawn child -> parent.
  const edges: GraphEdge[] = inherits
    .filter((e) => shown.has(e.src) && shown.has(e.dst))
    .map((e) => ({ from: e.dst, to: e.src, reverse: true, style: { end: "hollow" } }));
  const canvas = renderGraph({ nodes, edges });
  const note =
    types.length > chosen.length
      ? `Se muestran ${chosen.length} de ${types.length} clases e interfaces: primero las que tienen herencia, luego las de más métodos.`
      : null;
  return ok(
    1,
    title,
    source,
    wrapDocument(canvas, title, `${chosen.length} clases e interfaces`),
    note,
  );
}

// 2 ── Objetos ───────────────────────────────────────────────────────────────────────────────────
export function objectDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de objetos";
  const source = "Estado de evol (pipeline y aprobaciones)";
  const { data } = input;
  const done = new Map(data.pipeline.completadas.map((c) => [c.fase, c]));
  const nodes: GraphNode[] = [
    {
      id: "proyecto",
      content: {
        title: `${data.proyecto.nombre} : Proyecto`,
        underline: true,
        compartments: [
          [
            `fase = ${data.pipeline.fase}`,
            `codeIntel = ${data.proyecto.codeIntel}`,
            `evol = ${data.evol.version}`,
          ],
        ],
      },
      style: ACCENT,
    },
  ];
  const edges: GraphEdge[] = [];
  for (const phase of PHASES) {
    const entry = done.get(phase);
    const current = data.pipeline.fase === phase;
    if (!entry && !current) continue;
    const state = entry ? (entry.adoptada ? "adoptada" : "completada") : "actual";
    nodes.push({
      id: `fase:${phase}`,
      content: {
        title: `${phase} : Fase`,
        underline: true,
        compartments: [[`estado = ${state}`, ...(entry ? [`en = ${entry.en.slice(0, 10)}`] : [])]],
      },
      style: current ? ACCENT : MUTED,
    });
    edges.push({ from: "proyecto", to: `fase:${phase}`, style: { end: "none" } });
  }
  for (const a of data.aprobaciones.entradas) {
    const id = `aprobacion:${a.seq}`;
    nodes.push({
      id,
      content: {
        title: `#${a.seq} : Aprobación`,
        underline: true,
        compartments: [
          [
            `fase = ${a.fase}`,
            `aprobador = ${a.aprobador}`,
            `en = ${a.en.slice(0, 10)}`,
            `huella = ${a.huella.slice(0, 10)}…`,
          ],
        ],
      },
      style: { fill: THEME.okFill, stroke: THEME.ok },
    });
    const owner = nodes.some((n) => n.id === `fase:${a.fase}`) ? `fase:${a.fase}` : "proyecto";
    edges.push({ from: owner, to: id, style: { end: "none" } });
  }
  const canvas = renderGraph({ nodes, edges, options: { rankdir: "LR", ranksep: 0.9 } });
  return ok(2, title, source, wrapDocument(canvas, title, `${nodes.length} objetos`));
}

// 3 ── Componentes ───────────────────────────────────────────────────────────────────────────────
function componentShape(name: string, files: number): GraphNode {
  const content: BoxContent = {
    stereotype: "component",
    title: name,
    compartments: [[`${files} archivo(s)`]],
  };
  return {
    id: name,
    content,
    style: ACCENT,
    draw: (r) => {
      const parts = [rect(r.x, r.y, r.w, r.h, ACCENT)];
      parts.push(rect(r.x - 7, r.y + 10, 14, 7, { fill: THEME.paper, stroke: THEME.accent }));
      parts.push(rect(r.x - 7, r.y + 21, 14, 7, { fill: THEME.paper, stroke: THEME.accent }));
      parts.push(
        text(r.x + r.w / 2, r.y + 17, "«component»", {
          size: 11,
          anchor: "middle",
          fill: THEME.muted,
        }),
      );
      parts.push(text(r.x + r.w / 2, r.y + 36, name, { anchor: "middle", weight: "bold" }));
      parts.push(
        text(r.x + r.w / 2, r.y + 54, `${files} archivo(s)`, {
          size: 12,
          anchor: "middle",
          fill: THEME.muted,
        }),
      );
      return parts;
    },
    size: { w: Math.max(textWidth(name, 13) + 40, 120), h: 66 },
  };
}

export function componentDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de componentes";
  const source = "Índice de código (IMPORTS entre archivos)";
  const graph = input.graph;
  if (!graph) return notApplicable(3, title, source, NO_GRAPH);
  const group = (file: string): string => componentOf(file, input.ctx.config);
  const counts = new Map<string, number>();
  for (const f of sourceFiles(graph)) counts.set(group(f), (counts.get(group(f)) ?? 0) + 1);
  if (counts.size < 2) {
    return notApplicable(
      3,
      title,
      source,
      "el código está todo en un único componente: no hay dependencias entre componentes",
    );
  }
  const nodes = [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, files]) => componentShape(name, files));
  const edges: GraphEdge[] = [...groupedLinks(graph, "IMPORTS", group).values()]
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    .map((l) => ({
      from: l.from,
      to: l.to,
      label: String(l.count),
      style: { end: "open", dash: true },
    }));
  const canvas = renderGraph({ nodes, edges });
  return ok(3, title, source, wrapDocument(canvas, title, `${nodes.length} componentes`));
}

// 4 ── Estructura compuesta ──────────────────────────────────────────────────────────────────────
const PART_CAP = 24;
const PORT_CAP = 10;
const PORT = 12;

export function compositeDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de estructura compuesta";
  const source = "Índice de código (CONTAINS, EXPORTS, CALLS, IMPORTS)";
  const graph = input.graph;
  if (!graph) return notApplicable(4, title, source, NO_GRAPH);
  const group = (file: string): string => componentOf(file, input.ctx.config);
  const files = sourceFiles(graph);
  const counts = new Map<string, number>();
  for (const f of files) counts.set(group(f), (counts.get(group(f)) ?? 0) + 1);
  const [largest] = [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  const component = input.options.componente ?? largest?.[0];
  if (!component || !counts.has(component)) {
    return notApplicable(
      4,
      title,
      source,
      input.options.componente
        ? `no existe el componente «${input.options.componente}» (hay: ${[...counts.keys()].join(", ")})`
        : "no hay código fuente indexado",
    );
  }
  const inside = new Set(files.filter((f) => group(f) === component));
  const exportsOf = new Map<string, number>();
  for (const e of graph.edges)
    if (e.kind === "EXPORTS" && inside.has(e.src))
      exportsOf.set(e.src, (exportsOf.get(e.src) ?? 0) + 1);
  const parts = [...inside]
    .sort((a, b) => (exportsOf.get(b) ?? 0) - (exportsOf.get(a) ?? 0) || a.localeCompare(b))
    .slice(0, PART_CAP)
    .sort();
  const shownParts = new Set(parts);

  // Ports: symbols of the component that code outside it calls.
  const callers = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (e.kind !== "CALLS") continue;
    const target = graph.byId.get(e.dst);
    const caller = graph.byId.get(e.src);
    if (!target || !caller || !shownParts.has(target.file) || isTestPath(caller.file)) continue;
    if (inside.has(caller.file)) continue;
    callers.set(target.id, (callers.get(target.id) ?? new Set()).add(caller.file));
  }
  const ports = [...callers]
    .sort(([a, x], [b, y]) => y.size - x.size || a.localeCompare(b))
    .slice(0, PORT_CAP)
    .map(([id]) => graph.byId.get(id))
    .filter((n): n is NonNullable<typeof n> => n !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id));

  const nodes: GraphNode[] = [
    ...parts.map((f) => ({
      id: f,
      content: {
        title: `${basename(f)} : archivo`,
        compartments: [[`${exportsOf.get(f) ?? 0} exportación(es)`]],
      },
      style: ACCENT,
    })),
    ...ports.map((p) => ({
      id: `port:${p.id}`,
      content: { title: "" },
      size: { w: PORT, h: PORT },
      draw: () => [],
    })),
  ];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind !== "IMPORTS") continue;
    const [a, b] = [graph.byId.get(e.src), graph.byId.get(e.dst)];
    if (!a || !b || !shownParts.has(a.file) || !shownParts.has(b.file) || a.file === b.file)
      continue;
    const key = `${a.file}\u0000${b.file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: a.file, to: b.file, style: { end: "open", dash: true } });
  }
  for (const p of ports) edges.push({ from: `port:${p.id}`, to: p.file, hidden: true });

  const tree: LayoutCluster = { id: "composite", members: parts };
  const canvas = renderGraph(
    {
      nodes,
      edges,
      clusters: {
        tree,
        labels: new Map([["composite", `${component} : componente`]]),
        style: { fill: "none", stroke: THEME.accent, dash: false },
      },
      padding: { left: 190, right: 190, top: 24, bottom: 24 },
      extra: (placed, clusters) => snapPorts(ports, placed, clusters.get("composite")),
    },
    [tree],
  );
  const notes: string[] = [];
  if (inside.size > parts.length)
    notes.push(`Se muestran ${parts.length} de ${inside.size} archivos del componente.`);
  if (ports.length === 0)
    notes.push("Ningún código fuera del componente llama a sus símbolos: no hay puertos.");
  return ok(
    4,
    title,
    source,
    wrapDocument(canvas, title, `Interior del componente ${component}`),
    notes.join(" ") || null,
  );
}

/**
 * Squares on the left or right border of the composite, one per port, joined to the file that owns
 * the symbol. Ports on the same side are spread so their labels never overlap.
 */
function snapPorts(
  ports: { id: string; name: string; file: string }[],
  placed: Map<string, Rect>,
  frame: Rect | undefined,
): string[] {
  if (!frame) return [];
  const GAP = 22;
  const wanted = ports.flatMap((p) => {
    const spot = placed.get(`port:${p.id}`);
    const owner = placed.get(p.file);
    if (!spot || !owner) return [];
    const left = spot.x + spot.w / 2 < frame.x + frame.w / 2;
    return [{ p, owner, left, y: spot.y + spot.h / 2 }];
  });
  const out: string[] = [];
  for (const left of [true, false]) {
    const side = wanted
      .filter((w) => w.left === left)
      .sort((a, b) => a.y - b.y || a.p.id.localeCompare(b.p.id));
    const top = frame.y + 12;
    const bottom = frame.y + frame.h - 12;
    let last = top - GAP;
    for (const w of side) {
      w.y = Math.max(clamp(w.y, top, bottom), last + GAP);
      last = w.y;
    }
    // Pushing down may run past the frame: shift the whole column back up.
    const overflow = last - bottom;
    if (overflow > 0) for (const w of side) w.y = Math.max(top, w.y - overflow);
    for (const w of side) {
      const px = left ? frame.x : frame.x + frame.w;
      out.push(edge([[px, w.y], clipToBox(w.owner, [px, w.y])], { end: "none" }));
      out.push(
        rect(px - PORT / 2, w.y - PORT / 2, PORT, PORT, {
          fill: THEME.paper,
          stroke: THEME.accent,
          width: 1.5,
        }),
        text(px + (left ? -10 : 10), w.y + 4, w.p.name, {
          size: 11,
          anchor: left ? "end" : "start",
          fill: THEME.muted,
          halo: true,
        }),
      );
    }
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

// 5 ── Paquetes ──────────────────────────────────────────────────────────────────────────────────
export function packageDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de paquetes";
  const source = "Índice de código (carpetas e IMPORTS)";
  const graph = input.graph;
  if (!graph) return notApplicable(5, title, source, NO_GRAPH);
  const direct = new Map<string, number>();
  for (const f of sourceFiles(graph)) direct.set(folderOf(f), (direct.get(folderOf(f)) ?? 0) + 1);
  if (direct.size < 2)
    return notApplicable(5, title, source, "todo el código está en una sola carpeta");

  const folders = new Set<string>();
  for (const dir of direct.keys()) {
    const segs = dir === "(raíz)" ? [] : dir.split("/");
    for (let i = 1; i <= segs.length; i++) folders.add(segs.slice(0, i).join("/"));
  }
  if (direct.has("(raíz)")) folders.add("(raíz)");
  const children = (dir: string): string[] =>
    [...folders]
      .filter(
        (f) => f !== "(raíz)" && f.startsWith(`${dir}/`) && !f.slice(dir.length + 1).includes("/"),
      )
      .sort();

  const nodes: GraphNode[] = [];
  const labels = new Map<string, string>();
  const nodeOf = new Map<string, string>();
  const pkgNode = (id: string, name: string, count: number): GraphNode => ({
    id,
    content: { title: name, compartments: [[`${count} archivo(s)`]] },
    style: ACCENT,
    draw: (r) => [
      rect(r.x, r.y, r.w, r.h, ACCENT),
      rect(r.x, r.y - 9, Math.min(46, r.w / 2), 9, ACCENT),
      text(r.x + r.w / 2, r.y + 20, name, { anchor: "middle", weight: "bold" }),
      text(r.x + r.w / 2, r.y + 38, `${count} archivo(s)`, {
        size: 12,
        anchor: "middle",
        fill: THEME.muted,
      }),
    ],
    size: { w: Math.max(textWidth(name, 13) + 28, 110), h: 52 },
  });
  const build = (dir: string): LayoutCluster | null => {
    const kids = children(dir);
    const own = direct.get(dir) ?? 0;
    if (kids.length === 0) {
      nodes.push(pkgNode(`pkg:${dir}`, basename(dir), own));
      nodeOf.set(dir, `pkg:${dir}`);
      return null;
    }
    const members: string[] = [];
    const nested: LayoutCluster[] = [];
    if (own > 0) {
      nodes.push(pkgNode(`own:${dir}`, `archivos de ${basename(dir)}`, own));
      nodeOf.set(dir, `own:${dir}`);
      members.push(`own:${dir}`);
    }
    for (const kid of kids) {
      const cluster = build(kid);
      if (cluster) nested.push(cluster);
      else members.push(`pkg:${kid}`);
    }
    labels.set(`cluster:${dir}`, basename(dir));
    return { id: `cluster:${dir}`, members, children: nested };
  };
  const tops = [...folders].filter((f) => f !== "(raíz)" && !f.includes("/")).sort();
  const roots: LayoutCluster[] = [];
  for (const top of tops) {
    const cluster = build(top);
    if (cluster) roots.push(cluster);
  }
  if (direct.has("(raíz)")) {
    nodes.push(pkgNode("pkg:(raíz)", "(raíz)", direct.get("(raíz)") ?? 0));
    nodeOf.set("(raíz)", "pkg:(raíz)");
  }

  const links = groupedLinks(graph, "IMPORTS", folderOf);
  const edges: GraphEdge[] = [...links.values()]
    .filter((l) => nodeOf.has(l.from) && nodeOf.has(l.to))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    .map((l) => ({
      from: nodeOf.get(l.from) as string,
      to: nodeOf.get(l.to) as string,
      label: String(l.count),
      style: { end: "open" as const, dash: true },
    }));
  const canvas = renderGraph(
    {
      nodes,
      edges,
      ...(roots.length > 0 ? { clusters: { tree: roots[0] as LayoutCluster, labels } } : {}),
    },
    roots,
  );
  return ok(5, title, source, wrapDocument(canvas, title, `${folders.size} paquetes`));
}

// 6 ── Despliegue ────────────────────────────────────────────────────────────────────────────────
interface DeployNode {
  id: string;
  kind: string;
  title: string;
  lines: string[];
  group: string;
}
interface DeployLink {
  from: string;
  to: string;
  label?: string;
  dash?: boolean;
}

function readText(root: string, rel: string): string {
  return existsSync(join(root, rel)) ? readFileSync(join(root, rel), "utf8") : "";
}

function parseDockerfile(
  rel: string,
  content: string,
): { nodes: DeployNode[]; links: DeployLink[] } {
  const nodes: DeployNode[] = [];
  const links: DeployLink[] = [];
  const names = new Map<string, string>();
  let current: DeployNode | null = null;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    const from = /^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
    if (from?.[1]) {
      const index = nodes.length;
      const name = from[2] ?? `etapa ${index + 1}`;
      current = {
        id: `${rel}#${index}`,
        kind: "stage",
        title: name,
        lines: [`FROM ${from[1]}`],
        group: rel,
      };
      nodes.push(current);
      names.set(name, current.id);
      names.set(String(index), current.id);
      const base = names.get(from[1]);
      if (base) links.push({ from: current.id, to: base, label: "FROM" });
    } else if (current) {
      const copy = /^COPY\s+--from=(\S+)/i.exec(line);
      const source = copy?.[1] ? names.get(copy[1]) : undefined;
      if (source) links.push({ from: current.id, to: source, label: "COPY", dash: true });
      const expose = /^EXPOSE\s+(.+)/i.exec(line);
      if (expose?.[1]) current.lines.push(`EXPOSE ${expose[1]}`);
      const cmd = /^(?:CMD|ENTRYPOINT)\s+(.+)/i.exec(line);
      if (cmd?.[1])
        current.lines.push(`${line.split(/\s/)[0]?.toUpperCase()} ${cmd[1]}`.slice(0, 48));
    }
  }
  return { nodes, links };
}

function parseCompose(rel: string, content: string): { nodes: DeployNode[]; links: DeployLink[] } {
  const nodes: DeployNode[] = [];
  const links: DeployLink[] = [];
  let doc: unknown;
  try {
    doc = YAML.parse(content);
  } catch {
    return { nodes, links };
  }
  const root = (doc ?? {}) as {
    services?: Record<string, Record<string, unknown>>;
    volumes?: Record<string, unknown>;
  };
  const volumes = new Set(Object.keys(root.volumes ?? {}));
  for (const [name, svc] of Object.entries(root.services ?? {})) {
    const lines: string[] = [];
    if (typeof svc["image"] === "string") lines.push(`image: ${svc["image"]}`);
    if (svc["build"] !== undefined) lines.push("build: Dockerfile");
    if (Array.isArray(svc["ports"])) lines.push(`ports: ${svc["ports"].map(String).join(", ")}`);
    nodes.push({ id: `${rel}:${name}`, kind: "container", title: name, lines, group: rel });
    const needs = svc["depends_on"];
    const deps = Array.isArray(needs)
      ? needs.map(String)
      : needs && typeof needs === "object"
        ? Object.keys(needs)
        : [];
    for (const dep of deps)
      links.push({ from: `${rel}:${name}`, to: `${rel}:${dep}`, label: "depende de" });
    for (const v of Array.isArray(svc["volumes"]) ? svc["volumes"] : []) {
      const volume = String(v).split(":")[0] ?? "";
      if (volumes.has(volume))
        links.push({ from: `${rel}:${name}`, to: `${rel}:vol:${volume}`, dash: true });
    }
  }
  for (const v of volumes)
    nodes.push({ id: `${rel}:vol:${v}`, kind: "volume", title: v, lines: [], group: rel });
  return { nodes, links };
}

function parseWorkflow(rel: string, content: string): { nodes: DeployNode[]; links: DeployLink[] } {
  const nodes: DeployNode[] = [];
  const links: DeployLink[] = [];
  let doc: unknown;
  try {
    doc = YAML.parse(content);
  } catch {
    return { nodes, links };
  }
  const jobs = ((doc ?? {}) as { jobs?: Record<string, Record<string, unknown>> }).jobs ?? {};
  for (const [name, job] of Object.entries(jobs)) {
    const runs = job["runs-on"];
    nodes.push({
      id: `${rel}:${name}`,
      kind: "job",
      title: typeof job["name"] === "string" ? job["name"] : name,
      lines: typeof runs === "string" ? [`runs-on: ${runs}`] : [],
      group: rel,
    });
    const needs = job["needs"];
    for (const dep of Array.isArray(needs) ? needs : needs ? [needs] : []) {
      links.push({ from: `${rel}:${name}`, to: `${rel}:${String(dep)}`, label: "needs" });
    }
  }
  return { nodes, links };
}

function cube(r: Rect, node: DeployNode): string[] {
  const d = 8;
  const style =
    node.kind === "volume"
      ? MUTED
      : node.kind === "job"
        ? { fill: THEME.okFill, stroke: THEME.ok }
        : ACCENT;
  const parts = [
    polygon(
      [
        [r.x, r.y],
        [r.x + d, r.y - d],
        [r.x + r.w + d, r.y - d],
        [r.x + r.w, r.y],
      ],
      { ...style, fill: THEME.paper },
    ),
    polygon(
      [
        [r.x + r.w, r.y],
        [r.x + r.w + d, r.y - d],
        [r.x + r.w + d, r.y + r.h - d],
        [r.x + r.w, r.y + r.h],
      ],
      { ...style, fill: THEME.paper },
    ),
    rect(r.x, r.y, r.w, r.h, style),
    text(r.x + r.w / 2, r.y + 15, `«${node.kind}»`, {
      size: 11,
      anchor: "middle",
      fill: THEME.muted,
    }),
    text(r.x + r.w / 2, r.y + 33, node.title, { anchor: "middle", weight: "bold" }),
  ];
  node.lines.forEach((l, i) => parts.push(text(r.x + 10, r.y + 52 + i * 15, l, { size: 12 })));
  return parts;
}

export function deploymentDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de despliegue";
  const source = "Dockerfile, compose y workflows de CI del proyecto";
  const root = input.ctx.root;
  const found: { nodes: DeployNode[]; links: DeployLink[] }[] = [];
  if (existsSync(join(root, "Dockerfile")))
    found.push(parseDockerfile("Dockerfile", readText(root, "Dockerfile")));
  for (const name of ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"]) {
    if (existsSync(join(root, name))) found.push(parseCompose(name, readText(root, name)));
  }
  for (const rel of matchFiles(".github/workflows/*.{yml,yaml}", root)) {
    found.push(
      parseWorkflow(
        `.github/workflows/${rel.split("/").pop()}`,
        readText(root, `.github/workflows/${rel.split("/").pop()}`),
      ),
    );
  }
  const all = { nodes: found.flatMap((f) => f.nodes), links: found.flatMap((f) => f.links) };
  if (all.nodes.length === 0) {
    return notApplicable(
      6,
      title,
      source,
      "el proyecto no tiene Dockerfile, compose ni workflows de CI con servicios o trabajos",
    );
  }
  const ids = new Set(all.nodes.map((n) => n.id));
  const groups = [...new Set(all.nodes.map((n) => n.group))];
  const nodes: GraphNode[] = all.nodes.map((n) => ({
    id: n.id,
    content: { title: n.title },
    size: {
      w: Math.max(...[n.title, `«${n.kind}»`, ...n.lines].map((l) => textWidth(l, 12))) + 28,
      h: 40 + n.lines.length * 15,
    },
    draw: (r) => cube(r, n),
  }));
  const uniqueLinks = new Map(
    all.links.map((l) => [`${l.from}\u0000${l.to}\u0000${l.label ?? ""}`, l] as const),
  );
  const edges: GraphEdge[] = [...uniqueLinks.values()]
    .filter((l) => ids.has(l.from) && ids.has(l.to))
    .map((l) => ({
      from: l.from,
      to: l.to,
      ...(l.label ? { label: l.label } : {}),
      style: { end: "open" as const, dash: l.dash === true },
    }));
  const roots: LayoutCluster[] = groups.map((g) => ({
    id: g,
    members: all.nodes.filter((n) => n.group === g).map((n) => n.id),
  }));
  const canvas = renderGraph(
    {
      nodes,
      edges,
      options: { rankdir: "LR" },
      clusters: { tree: roots[0] as LayoutCluster, labels: new Map(groups.map((g) => [g, g])) },
    },
    roots,
  );
  return ok(6, title, source, wrapDocument(canvas, title, `${nodes.length} nodos de despliegue`));
}

// 7 ── Perfiles ──────────────────────────────────────────────────────────────────────────────────
export function profileDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de perfiles";
  const source = "evol.config.json y disciplines/";
  const { config, registry } = input.ctx;
  const active = [...new Set(config.modules.flatMap((m) => m.disciplinas))].sort();
  const disciplines = active.flatMap((id) => registry.get(id) ?? []);
  if (disciplines.length === 0)
    return notApplicable(7, title, source, "ningún módulo tiene disciplinas activas");

  const nodes: GraphNode[] = disciplines.map((d) => ({
    id: d.id,
    content: {
      title: `«${d.id}»`,
      compartments: [
        [
          `fases: ${d.transversal ? "desde " : ""}${d.fases.join(", ")}`.slice(0, 44),
          `artefactos: ${d.artefactos.length} · nivel ${d.verificaciones.some((v) => v.tipo === "comando") ? "B" : "A"}`,
        ],
      ],
    },
    style: d.tipo === "base" ? ACCENT : MUTED,
  }));
  nodes.push({
    id: "Fase",
    content: { stereotype: "metaclass", title: "Fase", compartments: [[...PHASES]] },
    style: { fill: THEME.warnFill, stroke: THEME.warn },
  });
  const edges: GraphEdge[] = disciplines
    .filter((d) => PHASES.some((p) => appliesIn(d, p)))
    .map((d) => ({ from: d.id, to: "Fase", style: { end: "filled" as const } }));
  if (config.modules.length > 1) {
    nodes.push({
      id: "Modulo",
      content: {
        stereotype: "metaclass",
        title: "Módulo",
        compartments: [config.modules.map((m) => m.name)],
      },
      style: { fill: THEME.warnFill, stroke: THEME.warn },
    });
    for (const m of config.modules) {
      for (const id of m.disciplinas)
        edges.push({ from: "Modulo", to: id, style: { end: "open", dash: true } });
    }
  }
  const tree: LayoutCluster = { id: "profile", members: disciplines.map((d) => d.id) };
  const canvas = renderGraph(
    {
      nodes,
      edges,
      clusters: {
        tree,
        labels: new Map([["profile", `«profile» ${config.name}`]]),
        style: { stroke: THEME.accent },
      },
      options: { rankdir: "LR", nodesep: 0.12, ranksep: 1.6 },
    },
    [tree],
  );
  return ok(7, title, source, wrapDocument(canvas, title, `${disciplines.length} estereotipos`));
}
