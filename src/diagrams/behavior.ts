import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { isTestPath } from "../codeintel/native/indexer.js";
import { resolveDiscipline } from "../core/disciplines.js";
import { PHASES } from "../core/phases.js";
import type { Phase } from "../core/phases.js";
import { activeDisciplines } from "../core/pipeline.js";
import { matchFiles } from "../core/verify.js";
import { renderGraph } from "./draw.js";
import type { GraphEdge, GraphNode } from "./draw.js";
import { ok, notApplicable } from "./model.js";
import type { CodeGraph, Diagram, DiagramInput } from "./model.js";
import {
  THEME,
  circle,
  ellipse,
  edge,
  hline,
  polygon,
  rect,
  text,
  textWidth,
  wrapDocument,
} from "./svg.js";
import type { Canvas, ShapeStyle } from "./svg.js";

const NO_GRAPH =
  "el proveedor de código configurado (gitnexus) no expone el grafo; este diagrama necesita codeIntel: native";

const ACCENT: ShapeStyle = { fill: THEME.accentFill, stroke: THEME.accent };
const DONE: ShapeStyle = { fill: THEME.okFill, stroke: THEME.ok };
const FUTURE: ShapeStyle = { fill: THEME.fill, stroke: THEME.line };
const ADOPTED: ShapeStyle = { fill: THEME.fill, stroke: THEME.ok, dash: true };

type PhaseState = "completada" | "adoptada" | "actual" | "pendiente";

function phaseStates(input: DiagramInput): Map<Phase, PhaseState> {
  const done = new Map(input.data.pipeline.completadas.map((c) => [c.fase, c]));
  return new Map(
    PHASES.map((phase) => {
      const entry = done.get(phase);
      const state: PhaseState = entry
        ? entry.adoptada
          ? "adoptada"
          : "completada"
        : input.data.pipeline.fase === phase
          ? "actual"
          : "pendiente";
      return [phase, state];
    }),
  );
}

function styleOf(state: PhaseState): ShapeStyle {
  return state === "completada"
    ? DONE
    : state === "adoptada"
      ? ADOPTED
      : state === "actual"
        ? ACCENT
        : FUTURE;
}

// 8 ── Casos de uso ──────────────────────────────────────────────────────────────────────────────
interface UseCase {
  actor: string;
  caso: string;
}

const AS_A =
  /^\s*(?:[-*]\s*)?(?:Como|As)\s+(?:un|una|el|la|an?|the)?\s*([^,]+?)\s*,?\s+(?:quiero|I want(?: to)?)\s+(.+?)\s*\.?\s*$/i;
const ACTOR_LINE = /^\s*(?:Como|As)\s+(?:un|una|el|la|an?|the)?\s*([^,]+?)\s*,/i;
const SCENARIO =
  /^\s*(?:Scenario Outline|Scenario Template|Scenario|Esquema del escenario|Escenario)\s*:\s*(.*)$/;
const FEATURE = /^\s*(?:Feature|Funcionalidad|Característica|Caracteristica)\s*:\s*(.*)$/;

/** Actor of a feature ("Como <actor>") and its scenarios; the actor is null when none is declared. */
export function parseFeatureActors(content: string): {
  feature: string;
  actor: string | null;
  escenarios: string[];
} {
  let feature = "";
  let actor: string | null = null;
  const escenarios: string[] = [];
  for (const line of content.split("\n")) {
    const f = FEATURE.exec(line);
    if (f) feature = (f[1] ?? "").trim();
    const a = ACTOR_LINE.exec(line);
    if (a?.[1] && actor === null) actor = a[1].trim();
    const s = SCENARIO.exec(line);
    if (s?.[1]) escenarios.push(s[1].trim());
  }
  return { feature, actor, escenarios };
}

function useCases(input: DiagramInput): { cases: UseCase[]; withoutActor: number } {
  const cases: UseCase[] = [];
  let withoutActor = 0;
  for (const module of input.ctx.config.modules) {
    const moduleRoot = join(input.ctx.root, module.root);
    for (const rel of matchFiles("**/*.feature", moduleRoot)) {
      const parsed = parseFeatureActors(readFileSync(join(moduleRoot, rel), "utf8"));
      if (!parsed.actor) {
        withoutActor += 1;
        continue;
      }
      const names = parsed.escenarios.length > 0 ? parsed.escenarios : [parsed.feature];
      for (const caso of names.filter((c) => c !== "")) cases.push({ actor: parsed.actor, caso });
    }
    const sdd = input.ctx.registry.get("SDD");
    const patterns = sdd ? resolveDiscipline(sdd, module).artefactos.map((a) => a.patron) : [];
    for (const pattern of patterns) {
      for (const rel of matchFiles(pattern, moduleRoot)) {
        for (const line of readFileSync(join(moduleRoot, rel), "utf8").split("\n")) {
          const m = AS_A.exec(line);
          if (m?.[1] && m[2]) cases.push({ actor: m[1].trim(), caso: m[2].trim() });
        }
      }
    }
  }
  return { cases, withoutActor };
}

function stickFigure(cx: number, top: number, name: string): string[] {
  return [
    circle(cx, top + 8, 8, { fill: THEME.paper, stroke: THEME.ink, width: 1.4 }),
    edge(
      [
        [cx, top + 16],
        [cx, top + 40],
      ],
      { stroke: THEME.ink, width: 1.4 },
    ),
    edge(
      [
        [cx - 14, top + 25],
        [cx + 14, top + 25],
      ],
      { stroke: THEME.ink, width: 1.4 },
    ),
    edge(
      [
        [cx, top + 40],
        [cx - 12, top + 58],
      ],
      { stroke: THEME.ink, width: 1.4 },
    ),
    edge(
      [
        [cx, top + 40],
        [cx + 12, top + 58],
      ],
      { stroke: THEME.ink, width: 1.4 },
    ),
    text(cx, top + 76, name, { anchor: "middle", weight: "bold" }),
  ];
}

const USE_CASE_CAP = 30;

export function useCaseDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de casos de uso";
  const source = "Archivos .feature («Como <actor>») y SPEC";
  const { cases: all, withoutActor } = useCases(input);
  if (all.length === 0) {
    return notApplicable(
      8,
      title,
      source,
      withoutActor > 0
        ? `ninguno de los ${withoutActor} .feature declara un actor con «Como <actor>, quiero …»`
        : "no hay archivos .feature con actor ni historias «Como <actor>, quiero …» en el SPEC",
    );
  }
  const unique = new Map<string, UseCase[]>();
  for (const c of all) unique.set(c.caso, [...(unique.get(c.caso) ?? []), c]);
  const caseNames = [...unique.keys()].slice(0, USE_CASE_CAP);
  const actors = [...new Set(all.map((c) => c.actor))].sort();

  const rowH = 54;
  const ovalW = Math.max(...caseNames.map((c) => textWidth(c, 12))) + 44;
  const bodyH = caseNames.length * rowH + 20;
  const actorsH = actors.length * 110;
  const height = Math.max(bodyH + 50, actorsH);
  const boundaryX = 190;
  const parts: string[] = [];
  const boundaryW = ovalW + 60;
  parts.push(
    rect(boundaryX, 0, boundaryW, height, { fill: THEME.paper, stroke: THEME.line, width: 1.4 }),
  );
  parts.push(
    text(boundaryX + 12, 18, input.data.proyecto.nombre, { weight: "bold", fill: THEME.muted }),
  );

  const caseY = new Map<string, number>();
  caseNames.forEach((name, i) => {
    const cy = 50 + i * rowH + (height - 50 - bodyH) / 2 + rowH / 2 - 10;
    caseY.set(name, cy);
  });
  const actorY = new Map(
    actors.map((a, i) => [a, (height - actors.length * 110) / 2 + i * 110 + 38] as const),
  );
  for (const c of all) {
    const cy = caseY.get(c.caso);
    const ay = actorY.get(c.actor);
    if (cy === undefined || ay === undefined) continue;
    parts.push(
      edge(
        [
          [70 + 14, ay + 25],
          [boundaryX + 30 + (boundaryW - 60) / 2 - ovalW / 2 + 4, cy],
        ],
        { stroke: THEME.line, width: 1 },
      ),
    );
  }
  for (const [name, cy] of caseY) {
    parts.push(
      ellipse(boundaryX + boundaryW / 2, cy, ovalW / 2, 21, {
        fill: THEME.accentFill,
        stroke: THEME.accent,
      }),
    );
    parts.push(text(boundaryX + boundaryW / 2, cy + 4, name, { size: 12, anchor: "middle" }));
  }
  for (const [actor, ay] of actorY) parts.push(...stickFigure(70, ay, actor));

  const canvas: Canvas = { parts, width: boundaryX + boundaryW, height };
  const notes: string[] = [];
  if (unique.size > caseNames.length)
    notes.push(`Se muestran ${caseNames.length} de ${unique.size} casos de uso.`);
  if (withoutActor > 0) notes.push(`${withoutActor} .feature sin actor («Como …») no se dibujan.`);
  return ok(
    8,
    title,
    source,
    wrapDocument(canvas, title, `${actors.length} actores, ${caseNames.length} casos de uso`),
    notes.join(" ") || null,
  );
}

// 9 ── Actividad ─────────────────────────────────────────────────────────────────────────────────
const PER_ROW = 3;
const UNIT = 326;
const ROW_PITCH = 170;

export function activityDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de actividad";
  const source = "Reglas del pipeline y estado de evol";
  const states = phaseStates(input);
  const parts: string[] = [];
  const ox = 52;
  const cyOf = (row: number): number => 34 + row * ROW_PITCH;
  const line = (points: [number, number][], style: Parameters<typeof edge>[1] = {}): string =>
    edge(points, { end: "open", stroke: THEME.ink, straight: true, ...style });
  const label = (x: number, y: number, t: string, anchor: "start" | "middle" = "middle"): string =>
    text(x, y, t, { size: 11, anchor, fill: THEME.muted, halo: true });

  const first = cyOf(0);
  parts.push(circle(ox - 34, first, 9, { fill: THEME.ink, stroke: THEME.ink }));
  parts.push(
    line([
      [ox - 25, first],
      [ox, first],
    ]),
  );

  PHASES.forEach((phase, i) => {
    const [row, col] = [Math.floor(i / PER_ROW), i % PER_ROW];
    const x = ox + col * UNIT;
    const cy = cyOf(row);
    const state = states.get(phase) ?? "pendiente";
    const n = activeDisciplines(input.ctx, phase).length;
    parts.push(rect(x, cy - 24, 160, 48, { ...styleOf(state), rx: 14 }));
    parts.push(text(x + 80, cy - 4, `Fase ${phase}`, { anchor: "middle", weight: "bold" }));
    parts.push(
      text(x + 80, cy + 13, `${n} disciplina(s) · ${state}`, {
        size: 11,
        anchor: "middle",
        fill: THEME.muted,
      }),
    );
    parts.push(
      line([
        [x + 160, cy],
        [x + 190, cy],
      ]),
    );
    const dx = x + 240;
    parts.push(
      polygon(
        [
          [x + 190, cy],
          [dx, cy - 28],
          [x + 290, cy],
          [dx, cy + 28],
        ],
        { ...styleOf(state), fill: THEME.paper },
      ),
    );
    parts.push(text(dx, cy - 2, "¿verificada", { size: 11, anchor: "middle" }));
    parts.push(text(dx, cy + 10, "y aprobada?", { size: 11, anchor: "middle" }));
    // [no] loops back to the phase: the author fixes what is missing and tries again.
    parts.push(
      line(
        [
          [dx, cy + 28],
          [dx, cy + 52],
          [x + 80, cy + 52],
          [x + 80, cy + 24],
        ],
        { dash: true },
      ),
    );
    parts.push(label(dx + 6, cy + 46, "[no]", "start"));
    const last = i === PHASES.length - 1;
    if (!last && col < PER_ROW - 1) {
      parts.push(
        line([
          [x + 290, cy],
          [x + UNIT, cy],
        ]),
      );
      parts.push(label(x + 308, cy - 6, "[sí]"));
    } else if (!last) {
      // End of the row: the flow goes back to the left edge to start the next one.
      const [right, mid, left] = [x + 290 + 24, cy + 52 + 28, ox - 26];
      const next = cyOf(row + 1);
      parts.push(
        line([
          [x + 290, cy],
          [right, cy],
          [right, mid],
          [left, mid],
          [left, next],
          [ox, next],
        ]),
      );
      parts.push(label(x + 308, cy - 6, "[sí]"));
    } else {
      parts.push(
        line([
          [x + 290, cy],
          [x + UNIT, cy],
        ]),
      );
      parts.push(label(x + 308, cy - 6, "[sí]"));
      parts.push(circle(x + UNIT + 9, cy, 9, { fill: THEME.paper, stroke: THEME.ink, width: 1.6 }));
      parts.push(circle(x + UNIT + 9, cy, 5, { fill: THEME.ink, stroke: THEME.ink }));
    }
  });
  const rows = Math.ceil(PHASES.length / PER_ROW);
  const canvas: Canvas = {
    parts,
    width: ox + PER_ROW * UNIT + 24,
    height: cyOf(rows - 1) + 70,
  };
  return ok(
    9,
    title,
    source,
    wrapDocument(canvas, title, "Pipeline con sus puertas de aprobación"),
  );
}

// 10 ── Máquina de estados ───────────────────────────────────────────────────────────────────────
export function stateMachineDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de máquina de estados";
  const source = "Reglas del pipeline (gate de aprobación)";
  const phase = input.data.pipeline.fase;
  const approval = input.data.pipeline.aprobacion.estado;
  const current =
    phase === "done"
      ? null
      : approval === "vigente"
        ? "aprobada"
        : approval === "obsoleta"
          ? "invalidada"
          : "actual";

  const state = (id: string, label: string): GraphNode => ({
    id,
    content: { title: label },
    size: { w: Math.max(textWidth(label, 13) + 36, 96), h: 40 },
    style: current === id ? { ...ACCENT, width: 2.4 } : FUTURE,
    draw: (r) => [
      rect(r.x, r.y, r.w, r.h, {
        ...(current === id ? ACCENT : FUTURE),
        rx: 14,
        ...(current === id ? { width: 2.4 } : {}),
      }),
      text(r.x + r.w / 2, r.y + r.h / 2 + 4, label, { anchor: "middle", weight: "bold" }),
    ],
  });
  const pseudo = (id: string, final: boolean): GraphNode => ({
    id,
    content: { title: "" },
    size: { w: 20, h: 20 },
    draw: (r) =>
      final
        ? [
            circle(r.x + 10, r.y + 10, 9, { fill: THEME.paper, stroke: THEME.ink, width: 1.6 }),
            circle(r.x + 10, r.y + 10, 5, { fill: THEME.ink, stroke: THEME.ink }),
          ]
        : [circle(r.x + 10, r.y + 10, 9, { fill: THEME.ink, stroke: THEME.ink })],
  });
  const nodes: GraphNode[] = [
    pseudo("inicio", false),
    state("pendiente", "pendiente"),
    state("actual", "actual"),
    state("aprobada", "aprobada"),
    state("invalidada", "invalidada"),
    state("completada", "completada"),
    pseudo("fin", true),
  ];
  const go = (from: string, to: string, label?: string): GraphEdge => ({
    from,
    to,
    ...(label ? { label } : {}),
    style: { end: "open", stroke: THEME.ink },
  });
  const edges: GraphEdge[] = [
    go("inicio", "pendiente"),
    go("pendiente", "actual", "evol next (fase anterior)"),
    go("actual", "aprobada", "evol approve"),
    go("aprobada", "invalidada", "cambian artefactos o config"),
    go("invalidada", "aprobada", "evol approve"),
    go("aprobada", "completada", "evol next"),
    go("completada", "fin"),
  ];
  const canvas = renderGraph({
    nodes,
    edges,
    options: { rankdir: "LR", ranksep: 0.35, nodesep: 0.5 },
  });
  const note =
    current === null
      ? "El pipeline terminó: todas las fases están completadas."
      : `Fase actual: «${phase}», en estado «${current}».`;
  return ok(
    10,
    title,
    source,
    wrapDocument(canvas, title, "Estados de una fase del pipeline"),
    note,
  );
}

// 11/12 ── Llamadas de un punto de entrada ──────────────────────────────────────────────────────
interface CallMessage {
  from: string;
  to: string;
  label: string;
}

const CALL_DEPTH = 3;
const MESSAGE_CAP = 14;

function adjacency(graph: CodeGraph): Map<string, string[]> {
  const calls = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.kind !== "CALLS") continue;
    const [a, b] = [graph.byId.get(e.src), graph.byId.get(e.dst)];
    if (!a || !b || isTestPath(a.file) || isTestPath(b.file)) continue;
    calls.set(e.src, [...(calls.get(e.src) ?? []), e.dst]);
  }
  for (const list of calls.values()) list.sort();
  return calls;
}

function reachableCount(calls: Map<string, string[]>, entry: string): number {
  const seen = new Set([entry]);
  let level = [entry];
  for (let depth = 0; depth < CALL_DEPTH; depth++) {
    const next: string[] = [];
    for (const id of level) {
      for (const dst of calls.get(id) ?? []) {
        if (!seen.has(dst)) {
          seen.add(dst);
          next.push(dst);
        }
      }
    }
    level = next;
  }
  return seen.size - 1;
}

interface EntryChoice {
  id: string | null;
  automatic: boolean;
  problem: string | null;
}

function chooseEntry(
  input: DiagramInput,
  graph: CodeGraph,
  calls: Map<string, string[]>,
): EntryChoice {
  const wanted = input.options.entrada;
  if (wanted) {
    const exact = graph.byId.get(wanted);
    const matches = exact
      ? [exact]
      : graph.nodes.filter(
          (n) =>
            n.name === wanted &&
            ["function", "method", "class"].includes(n.kind) &&
            !isTestPath(n.file),
        );
    if (matches.length === 0)
      return { id: null, automatic: false, problem: `no existe el símbolo «${wanted}»` };
    if (matches.length > 1) {
      return {
        id: null,
        automatic: false,
        problem: `«${wanted}» es ambiguo (${matches.map((m) => m.id).join(", ")}): usa el id completo`,
      };
    }
    return { id: (matches[0] as { id: string }).id, automatic: false, problem: null };
  }
  let best: { id: string; count: number } | null = null;
  for (const id of [...calls.keys()].sort()) {
    const node = graph.byId.get(id);
    if (!node || node.kind === "file" || node.kind === "variable") continue;
    const count = reachableCount(calls, id);
    if (count >= 2 && (!best || count > best.count)) best = { id, count };
  }
  return best
    ? { id: best.id, automatic: true, problem: null }
    : {
        id: null,
        automatic: true,
        problem:
          "ningún símbolo del proyecto llama a otros dos o más: no hay secuencia que mostrar",
      };
}

/** Calls reachable from the entry, breadth first, each relation once. The index keeps no call order. */
function callMessages(
  graph: CodeGraph,
  calls: Map<string, string[]>,
  entry: string,
): CallMessage[] {
  const messages: CallMessage[] = [];
  const seenEdges = new Set<string>();
  const seenNodes = new Set([entry]);
  let level = [entry];
  for (let depth = 0; depth < CALL_DEPTH && messages.length < MESSAGE_CAP; depth++) {
    const next: string[] = [];
    for (const src of level) {
      for (const dst of calls.get(src) ?? []) {
        const a = graph.byId.get(src);
        const b = graph.byId.get(dst);
        if (!a || !b || seenEdges.has(`${src}\u0000${dst}`) || messages.length >= MESSAGE_CAP)
          continue;
        seenEdges.add(`${src}\u0000${dst}`);
        messages.push({ from: a.file, to: b.file, label: `${b.name}()` });
        if (!seenNodes.has(dst)) {
          seenNodes.add(dst);
          next.push(dst);
        }
      }
    }
    level = next;
  }
  return messages;
}

interface Lifeline {
  key: string;
  label: string;
}

interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  reply?: boolean;
}

const COL_MIN = 130;
const ROW = 36;

/** One sequence diagram: lifelines at the top, one row per message. Returns the drawn parts. */
function drawSequence(
  lifelines: Lifeline[],
  messages: SequenceMessage[],
  originY: number,
): { parts: string[]; width: number; height: number } {
  const widths = lifelines.map((l) => Math.max(textWidth(l.label, 13) + 28, 96));
  const index = new Map(lifelines.map((l, i) => [l.key, i]));
  const gaps = lifelines
    .slice(1)
    .map((_, i) => Math.max(COL_MIN, (widths[i] ?? 0) / 2 + (widths[i + 1] ?? 0) / 2 + 24));
  for (const m of messages) {
    const [a, b] = [index.get(m.from), index.get(m.to)];
    if (a === undefined || b === undefined || a === b) continue;
    const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
    const need = (textWidth(m.label, 12) + 34) / (hi - lo);
    for (let g = lo; g < hi; g++) gaps[g] = Math.max(gaps[g] ?? 0, need);
  }
  const xs: number[] = [(widths[0] ?? 0) / 2];
  gaps.forEach((g, i) => xs.push((xs[i] ?? 0) + g));
  const top = originY;
  const headH = 30;
  const bodyTop = top + headH + 22;
  const bottom = bodyTop + messages.length * ROW + 10;
  const parts: string[] = [];
  lifelines.forEach((l, i) => {
    const x = xs[i] ?? 0;
    const w = widths[i] ?? 0;
    parts.push(
      edge(
        [
          [x, top + headH],
          [x, bottom],
        ],
        { dash: true, stroke: THEME.line, width: 1 },
      ),
    );
    parts.push(rect(x - w / 2, top, w, headH, ACCENT));
    parts.push(text(x, top + 20, l.label, { anchor: "middle", weight: "bold" }));
  });
  messages.forEach((m, i) => {
    const y = bodyTop + i * ROW + 10;
    const [a, b] = [index.get(m.from), index.get(m.to)];
    if (a === undefined || b === undefined) return;
    const [x1, x2] = [xs[a] ?? 0, xs[b] ?? 0];
    if (a === b) {
      parts.push(
        edge(
          [
            [x1, y - 6],
            [x1 + 38, y - 6],
            [x1 + 38, y + 8],
            [x1, y + 8],
          ],
          { end: "filled", stroke: THEME.ink, straight: true },
        ),
      );
      parts.push(text(x1 + 44, y + 3, m.label, { size: 12 }));
      return;
    }
    parts.push(
      edge(
        [
          [x1, y],
          [x2, y],
        ],
        { end: m.reply ? "open" : "filled", dash: m.reply === true, stroke: THEME.ink },
      ),
    );
    parts.push(text((x1 + x2) / 2, y - 6, m.label, { size: 12, anchor: "middle", halo: true }));
  });
  const last = xs[xs.length - 1] ?? 0;
  const selfMargin = messages.some((m) => m.from === m.to) ? 200 : 0;
  return {
    parts,
    width: last + (widths[widths.length - 1] ?? 0) / 2 + selfMargin,
    height: bottom - originY,
  };
}

function frame(x: number, y: number, w: number, h: number, label: string): string[] {
  const tab = textWidth(label, 12) + 20;
  return [
    rect(x, y, w, h, { fill: "none", stroke: THEME.line, width: 1.2 }),
    polygon(
      [
        [x, y],
        [x + tab, y],
        [x + tab, y + 10],
        [x + tab - 8, y + 20],
        [x, y + 20],
      ],
      { fill: THEME.fill, stroke: THEME.line },
    ),
    text(x + 8, y + 14, label, { size: 12, weight: "bold" }),
  ];
}

export function sequenceDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de secuencia";
  const source = "Reglas del pipeline y llamadas CALLS del índice de código";
  const approve = drawSequence(
    [
      { key: "persona", label: "Persona" },
      { key: "cli", label: "evol approve" },
      { key: "pipeline", label: "pipeline" },
      { key: "gate", label: "registro firmado" },
      { key: "diario", label: "diario y memoria" },
    ],
    [
      { from: "persona", to: "cli", label: "evol approve <fase>" },
      { from: "cli", to: "pipeline", label: "verifyPhase(fase)" },
      { from: "pipeline", to: "cli", label: "sin problemas", reply: true },
      { from: "cli", to: "gate", label: "verifyChain(registro)" },
      { from: "cli", to: "persona", label: "pide escribir el nombre de la fase" },
      { from: "persona", to: "cli", label: "escribe la fase" },
      { from: "cli", to: "gate", label: "appendApproval(artefactos, firma HMAC)" },
      { from: "gate", to: "cli", label: "entrada #n", reply: true },
      { from: "cli", to: "diario", label: "record(approved)" },
      { from: "cli", to: "persona", label: "fase aprobada", reply: true },
    ],
    30,
  );

  const parts: string[] = [];
  const pad = 14;
  let width = approve.width + pad * 2;
  let y = 0;
  parts.push(
    ...frame(0, y, approve.width + pad * 2, approve.height + 30 + pad, "sd Aprobación de una fase"),
  );
  parts.push(`<g transform="translate(${pad} 0)">${approve.parts.join("")}</g>`);
  y += approve.height + 30 + pad + 28;

  let note: string;
  const graph = input.graph;
  if (graph) {
    const calls = adjacency(graph);
    const choice = chooseEntry(input, graph, calls);
    if (choice.id) {
      const messages = callMessages(graph, calls, choice.id);
      const keys = [...new Set(messages.flatMap((m) => [m.from, m.to]))];
      const entryNode = graph.byId.get(choice.id);
      const second = drawSequence(
        keys.map((k) => ({ key: k, label: basename(k) })),
        messages,
        y + 30,
      );
      const label = `sd Llamadas de ${entryNode?.name ?? choice.id}`;
      parts.push(
        ...frame(
          0,
          y,
          Math.max(second.width + pad * 2, textWidth(label, 12) + 40),
          second.height + 30 + pad,
          label,
        ),
      );
      parts.push(`<g transform="translate(${pad} 0)">${second.parts.join("")}</g>`);
      width = Math.max(width, second.width + pad * 2);
      y += second.height + 30 + pad;
      note = `Llamadas desde «${choice.id}»${choice.automatic ? " (elegido automáticamente: el que más llama; usa --entrada para otro)" : ""}. El índice no guarda el orden de las llamadas: se muestran por niveles.`;
    } else {
      note = `Solo se dibuja la aprobación: ${choice.problem}.`;
    }
  } else {
    note = `Solo se dibuja la aprobación: ${NO_GRAPH}.`;
  }
  y -= 28;
  const canvas: Canvas = { parts, width, height: Math.max(y, approve.height + 60) };
  return ok(
    11,
    title,
    source,
    wrapDocument(canvas, title, "Aprobación de una fase y llamadas de un punto de entrada"),
    note,
  );
}

// 12 ── Comunicación ─────────────────────────────────────────────────────────────────────────────
export function communicationDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de comunicación";
  const source = "Índice de código (CALLS)";
  const graph = input.graph;
  if (!graph) return notApplicable(12, title, source, NO_GRAPH);
  const calls = adjacency(graph);
  const choice = chooseEntry(input, graph, calls);
  if (!choice.id) return notApplicable(12, title, source, choice.problem ?? "sin punto de entrada");
  const messages = callMessages(graph, calls, choice.id);
  const keys = [...new Set(messages.flatMap((m) => [m.from, m.to]))].sort();
  const nodes: GraphNode[] = keys.map((k) => ({
    id: k,
    content: { title: `${basename(k)} : archivo` },
    style: ACCENT,
    size: { w: Math.max(textWidth(`${basename(k)} : archivo`, 13) + 24, 110), h: 34 },
  }));
  const grouped = new Map<string, { from: string; to: string; labels: string[] }>();
  messages.forEach((m, i) => {
    if (m.from === m.to) return;
    const key = `${m.from}\u0000${m.to}`;
    const g = grouped.get(key) ?? { from: m.from, to: m.to, labels: [] };
    g.labels.push(`${i + 1}: ${m.label}`);
    grouped.set(key, g);
  });
  const edges: GraphEdge[] = [...grouped.values()].map((g) => ({
    from: g.from,
    to: g.to,
    label: g.labels.join("  "),
    style: { end: "filled", stroke: THEME.ink },
  }));
  const inner = messages.filter((m) => m.from === m.to).length;
  const canvas = renderGraph({
    nodes,
    edges,
    options: { rankdir: "LR", ranksep: 1.3, nodesep: 0.25 },
  });
  const entryNode = graph.byId.get(choice.id);
  const note = `Llamadas desde «${entryNode?.id ?? choice.id}»${choice.automatic ? " (elegido automáticamente; usa --entrada para otro)" : ""}; los números siguen el orden por niveles, no el de ejecución.${inner > 0 ? ` ${inner} llamada(s) dentro del mismo archivo no se dibujan.` : ""}`;
  return ok(
    12,
    title,
    source,
    wrapDocument(canvas, title, `Comunicación desde ${entryNode?.name ?? choice.id}`),
    note,
  );
}

// 13 ── Tiempos ──────────────────────────────────────────────────────────────────────────────────
interface Segment {
  phase: Phase;
  kind: "trabajo" | "espera";
  from: number;
  to: number;
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

export function timingSegments(
  events: { ts: string; type: string; [key: string]: unknown }[],
): Segment[] {
  const segments: Segment[] = [];
  const startOf = new Map<Phase, number>();
  const approvedAt = new Map<Phase, number>();
  for (const e of events) {
    const t = Date.parse(e.ts);
    if (Number.isNaN(t)) continue;
    const phase = e["phase"];
    const isPhase = (p: unknown): p is Phase =>
      typeof p === "string" && (PHASES as readonly string[]).includes(p);
    if (e.type === "project-created" && startOf.size === 0) startOf.set("briefing", t);
    else if (e.type === "project-adopted" && isPhase(phase)) startOf.set(phase, t);
    else if (e.type === "approved" && isPhase(phase)) {
      const start = startOf.get(phase);
      if (start !== undefined) segments.push({ phase, kind: "trabajo", from: start, to: t });
      approvedAt.set(phase, t);
    } else if (e.type === "phase-completed" && isPhase(phase)) {
      const waited = approvedAt.get(phase);
      const start = startOf.get(phase);
      if (waited !== undefined) segments.push({ phase, kind: "espera", from: waited, to: t });
      else if (start !== undefined) segments.push({ phase, kind: "trabajo", from: start, to: t });
      approvedAt.delete(phase);
      const next = e["next"];
      if (isPhase(next)) startOf.set(next, t);
    }
  }
  return segments;
}

export function timingDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de tiempos";
  const source = "Diario (.evol/journal.jsonl) con sus fechas";
  const segments = timingSegments(input.journal);
  if (segments.length === 0) {
    return notApplicable(
      13,
      title,
      source,
      "el diario aún no registra ninguna fase aprobada ni completada con fecha",
    );
  }
  const t0 = Math.min(...segments.map((s) => s.from));
  const t1 = Math.max(...segments.map((s) => s.to));
  const span = Math.max(t1 - t0, 1);
  const left = 110;
  const plot = 760;
  const laneH = 40;
  const x = (t: number): number => left + ((t - t0) / span) * plot;
  const lanes = PHASES.filter((p) => segments.some((s) => s.phase === p));
  const parts: string[] = [];
  lanes.forEach((phase, i) => {
    const y = 30 + i * laneH;
    parts.push(text(left - 12, y + 19, phase, { anchor: "end", weight: "bold" }));
    parts.push(hline(left, left + plot, y + 28, THEME.fill));
    for (const s of segments.filter((s) => s.phase === phase)) {
      const w = Math.max(x(s.to) - x(s.from), 3);
      parts.push(rect(x(s.from), y + 6, w, 22, s.kind === "trabajo" ? ACCENT : DONE));
      const label = formatDuration(s.to - s.from);
      if (w > textWidth(label, 11) + 8)
        parts.push(text(x(s.from) + w / 2, y + 21, label, { size: 11, anchor: "middle" }));
      else parts.push(text(x(s.from) + w + 4, y + 21, label, { size: 11, fill: THEME.muted }));
    }
  });
  const axisY = 30 + lanes.length * laneH + 6;
  parts.push(
    edge(
      [
        [left, axisY],
        [left + plot, axisY],
      ],
      { stroke: THEME.ink },
    ),
  );
  parts.push(
    text(left, axisY + 16, new Date(t0).toISOString().slice(0, 16).replace("T", " "), {
      size: 11,
      fill: THEME.muted,
    }),
  );
  parts.push(
    text(left + plot, axisY + 16, new Date(t1).toISOString().slice(0, 16).replace("T", " "), {
      size: 11,
      anchor: "end",
      fill: THEME.muted,
    }),
  );
  parts.push(
    text(left + plot / 2, axisY + 16, `duración total ${formatDuration(span)}`, {
      size: 11,
      anchor: "middle",
      fill: THEME.muted,
    }),
  );
  parts.push(rect(left, 4, 14, 12, ACCENT));
  parts.push(text(left + 20, 14, "trabajo hasta aprobar", { size: 11 }));
  parts.push(rect(left + 170, 4, 14, 12, DONE));
  parts.push(text(left + 190, 14, "aprobada hasta avanzar", { size: 11 }));
  const canvas: Canvas = { parts, width: left + plot + 20, height: axisY + 26 };
  return ok(
    13,
    title,
    source,
    wrapDocument(canvas, title, `${segments.length} tramos de ${lanes.length} fases`),
    "Tiempos de reloj según el diario; no miden esfuerzo.",
  );
}

// 14 ── Visión de interacción ────────────────────────────────────────────────────────────────────
export function interactionOverviewDiagram(input: DiagramInput): Diagram {
  const title = "Diagrama de visión de interacción";
  const source = "Reglas del pipeline";
  const states = phaseStates(input);
  const perRow = 3;
  const w = 210;
  const h = 74;
  const gapX = 70;
  const gapY = 70;
  const parts: string[] = [];
  const pos = (i: number): { x: number; y: number } => ({
    x: 40 + (i % perRow) * (w + gapX),
    y: Math.floor(i / perRow) * (h + gapY),
  });
  PHASES.forEach((phase, i) => {
    const { x, y } = pos(i);
    const state = states.get(phase) ?? "pendiente";
    parts.push(rect(x, y, w, h, { ...styleOf(state), fill: THEME.paper }));
    parts.push(
      polygon(
        [
          [x, y],
          [x + 38, y],
          [x + 38, y + 10],
          [x + 30, y + 18],
          [x, y + 18],
        ],
        styleOf(state),
      ),
    );
    parts.push(text(x + 8, y + 13, "ref", { size: 11, weight: "bold" }));
    parts.push(
      text(x + w / 2, y + 38, `Aprobación de «${phase}»`, { anchor: "middle", weight: "bold" }),
    );
    parts.push(
      text(x + w / 2, y + 58, "→ diagrama de secuencia 11", {
        size: 11,
        anchor: "middle",
        fill: THEME.muted,
      }),
    );
    if (i > 0) {
      const prev = pos(i - 1);
      if (Math.floor((i - 1) / perRow) === Math.floor(i / perRow)) {
        parts.push(
          edge(
            [
              [prev.x + w, prev.y + h / 2],
              [x, y + h / 2],
            ],
            { end: "open", stroke: THEME.ink },
          ),
        );
        parts.push(
          text((prev.x + w + x) / 2, y + h / 2 - 6, "[aprobada]", {
            size: 11,
            anchor: "middle",
            fill: THEME.muted,
            halo: true,
          }),
        );
      } else {
        const mid = prev.y + h + gapY / 2;
        parts.push(
          edge(
            [
              [prev.x + w / 2, prev.y + h],
              [prev.x + w / 2, mid],
              [x + w / 2, mid],
              [x + w / 2, y],
            ],
            { end: "open", stroke: THEME.ink, straight: true },
          ),
        );
        parts.push(text(x + w / 2 + 8, mid - 5, "[aprobada]", { size: 11, fill: THEME.muted }));
      }
    }
  });
  const first = pos(0);
  parts.push(circle(14, first.y + h / 2, 9, { fill: THEME.ink, stroke: THEME.ink }));
  parts.push(
    edge(
      [
        [23, first.y + h / 2],
        [first.x, first.y + h / 2],
      ],
      { end: "open", stroke: THEME.ink },
    ),
  );
  const last = pos(PHASES.length - 1);
  parts.push(
    edge(
      [
        [last.x + w, last.y + h / 2],
        [last.x + w + 36, last.y + h / 2],
      ],
      { end: "open", stroke: THEME.ink },
    ),
  );
  parts.push(
    circle(last.x + w + 45, last.y + h / 2, 9, {
      fill: THEME.paper,
      stroke: THEME.ink,
      width: 1.6,
    }),
  );
  parts.push(circle(last.x + w + 45, last.y + h / 2, 5, { fill: THEME.ink, stroke: THEME.ink }));
  const rows = Math.ceil(PHASES.length / perRow);
  const canvas: Canvas = {
    parts,
    width: 40 + perRow * w + (perRow - 1) * gapX + 70,
    height: rows * h + (rows - 1) * gapY,
  };
  return ok(
    14,
    title,
    source,
    wrapDocument(
      canvas,
      title,
      "Flujo del pipeline; cada nodo remite a la secuencia de aprobación",
    ),
  );
}
