/** Small SVG toolkit for the diagrams. Everything it writes is a pure function of its inputs. */

export const THEME = {
  ink: "#1b2430",
  muted: "#5b6675",
  line: "#7a8696",
  fill: "#f4f6f9",
  accent: "#2b5fa8",
  accentFill: "#e4edf9",
  warn: "#b4531d",
  warnFill: "#fbeee6",
  ok: "#2f7d4f",
  okFill: "#e6f3ea",
  paper: "#ffffff",
  font: '"Source Sans 3", sans-serif',
} as const;

export const MARGIN = 24;

/** Rounds to two decimals so that equal inputs always print the same digits. */
export function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const NARROW = new Set("il.,;:'|!()[]{}1 ");
const WIDE = new Set("mwMW@%#—");

/**
 * Text width estimate. Layout must not depend on the fonts installed, so boxes are sized from this
 * rather than measured.
 */
export function textWidth(text: string, size = 13): number {
  let units = 0;
  for (const ch of text) {
    if (NARROW.has(ch)) units += 0.3;
    else if (WIDE.has(ch)) units += 0.85;
    else if (ch >= "A" && ch <= "Z") units += 0.64;
    else units += 0.54;
  }
  return Math.ceil(units * size * 1.04);
}

export interface TextStyle {
  size?: number;
  anchor?: "start" | "middle" | "end";
  weight?: "normal" | "bold";
  fill?: string;
  italic?: boolean;
  underline?: boolean;
  halo?: boolean;
}

export function text(x: number, y: number, content: string, style: TextStyle = {}): string {
  const attrs = [
    `x="${n(x)}"`,
    `y="${n(y)}"`,
    `font-size="${style.size ?? 13}"`,
    `text-anchor="${style.anchor ?? "start"}"`,
    `fill="${style.fill ?? THEME.ink}"`,
  ];
  if (style.weight === "bold") attrs.push('font-weight="bold"');
  if (style.italic) attrs.push('font-style="italic"');
  if (style.underline) attrs.push('text-decoration="underline"');
  if (style.halo) attrs.push(`stroke="${THEME.paper}" stroke-width="3" paint-order="stroke"`);
  return `<text ${attrs.join(" ")}>${esc(content)}</text>`;
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  width?: number;
  dash?: boolean;
  rx?: number;
}

function shapeAttrs(style: ShapeStyle): string {
  return [
    `fill="${style.fill ?? THEME.fill}"`,
    `stroke="${style.stroke ?? THEME.line}"`,
    `stroke-width="${style.width ?? 1.2}"`,
    ...(style.dash ? ['stroke-dasharray="5 4"'] : []),
  ].join(" ");
}

export function rect(x: number, y: number, w: number, h: number, style: ShapeStyle = {}): string {
  const rx = style.rx ? ` rx="${style.rx}"` : "";
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx} ${shapeAttrs(style)}/>`;
}

export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  style: ShapeStyle = {},
): string {
  return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" ${shapeAttrs(style)}/>`;
}

export function circle(cx: number, cy: number, r: number, style: ShapeStyle = {}): string {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${shapeAttrs(style)}/>`;
}

export function polygon(points: [number, number][], style: ShapeStyle = {}): string {
  return `<polygon points="${points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}" ${shapeAttrs(style)}/>`;
}

export function hline(x1: number, x2: number, y: number, stroke: string = THEME.line): string {
  return `<line x1="${n(x1)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}" stroke="${stroke}" stroke-width="1"/>`;
}

export type Marker = "open" | "hollow" | "filled" | "diamond" | "none";

export interface EdgeStyle {
  start?: Marker;
  end?: Marker;
  dash?: boolean;
  stroke?: string;
  width?: number;
  /** Draw the points as a polyline even when there are 3n+1 of them. */
  straight?: boolean;
}

/** Straight segments for 2 points, cubic Béziers for 3n+1 points (Graphviz splines). */
export function pathData(points: [number, number][], straight = false): string {
  const [first, ...rest] = points;
  if (!first) return "";
  const move = `M${n(first[0])} ${n(first[1])}`;
  if (!straight && points.length >= 4 && (points.length - 1) % 3 === 0) {
    const curves: string[] = [];
    for (let i = 1; i + 2 < points.length; i += 3) {
      const coords = points
        .slice(i, i + 3)
        .map(([x, y]) => `${n(x)} ${n(y)}`)
        .join(" ");
      curves.push(`C${coords}`);
    }
    return `${move} ${curves.join(" ")}`;
  }
  return `${move} ${rest.map(([x, y]) => `L${n(x)} ${n(y)}`).join(" ")}`;
}

export function edge(points: [number, number][], style: EdgeStyle = {}): string {
  const attrs = [
    `d="${pathData(points, style.straight === true)}"`,
    'fill="none"',
    `stroke="${style.stroke ?? THEME.line}"`,
    `stroke-width="${style.width ?? 1.2}"`,
  ];
  if (style.dash) attrs.push('stroke-dasharray="5 4"');
  if (style.start && style.start !== "none") attrs.push(`marker-start="url(#m-${style.start})"`);
  if (style.end && style.end !== "none") attrs.push(`marker-end="url(#m-${style.end})"`);
  return `<path ${attrs.join(" ")}/>`;
}

const MARKERS = `<defs>
<marker id="m-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="${THEME.line}" stroke-width="1.3"/></marker>
<marker id="m-hollow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11 Z" fill="${THEME.paper}" stroke="${THEME.line}" stroke-width="1.3"/></marker>
<marker id="m-filled" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11 Z" fill="${THEME.line}" stroke="${THEME.line}" stroke-width="1"/></marker>
<marker id="m-diamond" viewBox="0 0 14 10" refX="13" refY="5" markerWidth="13" markerHeight="9" orient="auto-start-reverse"><path d="M1 5 L7 1 L13 5 L7 9 Z" fill="${THEME.paper}" stroke="${THEME.line}" stroke-width="1.2"/></marker>
</defs>`;

export interface Canvas {
  parts: string[];
  width: number;
  height: number;
}

/** Wraps drawn parts (already offset by MARGIN) into a standalone, accessible SVG document. */
export function wrapDocument(canvas: Canvas, title: string, description: string): string {
  const w = Math.ceil(canvas.width + MARGIN * 2);
  const h = Math.ceil(canvas.height + MARGIN * 2);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family='${THEME.font}' role="img">`,
    `<title>${esc(title)}</title>`,
    `<desc>${esc(description)}</desc>`,
    MARKERS,
    `<rect width="${w}" height="${h}" fill="${THEME.paper}"/>`,
    `<g transform="translate(${MARGIN} ${MARGIN})">`,
    ...canvas.parts,
    "</g>",
    "</svg>",
    "",
  ].join("\n");
}

export interface BoxContent {
  /** Small text above the title, e.g. «class». */
  stereotype?: string;
  title: string;
  /** Title underlined, as UML instance names are. */
  underline?: boolean;
  /** Rows of the compartments, each compartment a list of lines. */
  compartments?: string[][];
  muted?: boolean;
}

const ROW = 16;
const PAD = 10;
const HEAD = 24;

export function boxSize(content: BoxContent, minWidth = 90): { w: number; h: number } {
  const lines = [
    content.title,
    ...(content.stereotype ? [`«${content.stereotype}»`] : []),
    ...(content.compartments ?? []).flat(),
  ];
  const w = Math.max(minWidth, ...lines.map((l) => textWidth(l, 13))) + PAD * 2;
  const head = HEAD + (content.stereotype ? 14 : 0);
  const body = (content.compartments ?? []).reduce((sum, c) => sum + c.length * ROW + 8, 0);
  return { w, h: head + body };
}

export function drawBox(
  x: number,
  y: number,
  w: number,
  h: number,
  content: BoxContent,
  style: ShapeStyle = {},
): string[] {
  const parts = [rect(x, y, w, h, { fill: THEME.fill, ...style })];
  let cy = y;
  if (content.stereotype) {
    parts.push(
      text(x + w / 2, y + 15, `«${content.stereotype}»`, {
        size: 11,
        anchor: "middle",
        fill: THEME.muted,
      }),
    );
    cy += 14;
  }
  parts.push(
    text(x + w / 2, cy + 17, content.title, {
      anchor: "middle",
      weight: "bold",
      underline: content.underline === true,
      fill: content.muted ? THEME.muted : THEME.ink,
    }),
  );
  cy += HEAD;
  for (const compartment of content.compartments ?? []) {
    parts.push(hline(x, x + w, cy, style.stroke ?? THEME.line));
    compartment.forEach((line, i) => {
      parts.push(text(x + PAD, cy + 14 + i * ROW, line, { size: 12 }));
    });
    cy += compartment.length * ROW + 8;
  }
  return parts;
}

/** Point where the segment from the centre of a box towards `target` leaves the box. */
export function clipToBox(
  box: { x: number; y: number; w: number; h: number },
  target: [number, number],
): [number, number] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = target[0] - cx;
  const dy = target[1] - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const scale = Math.min(
    dx === 0 ? Infinity : box.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : box.h / 2 / Math.abs(dy),
  );
  return [cx + dx * scale, cy + dy * scale];
}
