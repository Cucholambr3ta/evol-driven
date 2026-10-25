/**
 * DocBook (and the SGML that PostgreSQL writes it in) to Markdown. The engine that indexes the
 * documentation reads Markdown, HTML and plain text; the manuals of PostgreSQL and of KDE are DocBook.
 * This is a reader for documentation, not a validating parser: it keeps the structure that matters to
 * a search (headings, paragraphs, lists, code, tables, notes) and drops the rest.
 */

interface El {
  tag: string;
  attrs: Record<string, string>;
  kids: Node[];
}
type Node = El | string;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rarr: "→",
  larr: "←",
  rArr: "⇒",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
  times: "×",
  bull: "•",
  eacute: "é",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  // names the documents use for products; anything else is shown by its name
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  plasma: "Plasma",
  kde: "KDE",
  kappname: "",
  fdlnotice: "",
};

const decode = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[A-Za-z][\w.-]*);/g, (_m, name: string) => {
    if (name.startsWith("#x")) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
    const known = ENTITIES[name] ?? ENTITIES[name.toLowerCase()];
    return known ?? name;
  });

const VOID = new Set(["xref", "anchor", "colspec", "spanspec", "sbr", "imagedata", "co"]);

function parse(source: string): El {
  const cleaned = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/gi, "")
    .replace(/<!\[(?:CDATA)\[([\s\S]*?)\]\]>/g, (_m, c: string) =>
      c.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    );
  const root: El = { tag: "#root", attrs: {}, kids: [] };
  const stack: El[] = [root];
  const top = (): El => stack[stack.length - 1] ?? root;
  const token = /<(\/?)([A-Za-z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|<\/>/g;
  let at = 0;
  for (let m = token.exec(cleaned); m; m = token.exec(cleaned)) {
    if (m.index > at) top().kids.push(cleaned.slice(at, m.index));
    at = token.lastIndex;
    if (m[0] === "</>") {
      // SGML short end tag: closes whatever is open
      if (stack.length > 1) stack.pop();
      continue;
    }
    const closing = m[1] === "/";
    const tag = (m[2] ?? "").toLowerCase();
    if (closing) {
      const i = stack.map((e) => e.tag).lastIndexOf(tag);
      if (i > 0) stack.length = i;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of (m[3] ?? "").matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g))
      attrs[(a[1] ?? "").toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? "";
    const el: El = { tag, attrs, kids: [] };
    top().kids.push(el);
    if (!VOID.has(tag) && !(m[3] ?? "").trimEnd().endsWith("/")) stack.push(el);
  }
  if (at < cleaned.length) top().kids.push(cleaned.slice(at));
  return root;
}

const SECTIONS = new Set([
  "book",
  "part",
  "preface",
  "chapter",
  "appendix",
  "article",
  "section",
  "sect1",
  "sect2",
  "sect3",
  "sect4",
  "sect5",
  "simplesect",
  "reference",
  "refentry",
  "refsect1",
  "refsect2",
  "refsect3",
  "sect",
]);
const SKIP = new Set([
  "refmeta",
  "indexterm",
  "bookinfo",
  "info",
  "chapterinfo",
  "articleinfo",
  "sect1info",
  "refentryinfo",
  "legalnotice",
  "authorgroup",
  "copyright",
  "revhistory",
  "toc",
  "index",
  "colspec",
  "spanspec",
  "imagedata",
  "imageobject",
  "graphic",
  "mediaobject",
  "screenshot",
  "co",
  "anchor",
]);
const CODE_INLINE = new Set([
  "literal",
  "command",
  "filename",
  "option",
  "function",
  "type",
  "varname",
  "parameter",
  "envar",
  "replaceable",
  "structname",
  "structfield",
  "application",
  "systemitem",
  "userinput",
  "computeroutput",
  "constant",
  "symbol",
  "classname",
  "methodname",
  "sgmltag",
  "keycap",
  "keycode",
  "keycombo",
  "markup",
  "token",
  "prompt",
  "firstterm",
]);
const BOLD_INLINE = new Set([
  "guilabel",
  "guimenu",
  "guibutton",
  "guisubmenu",
  "guimenuitem",
  "menuchoice",
]);
const CODE_BLOCK = new Set([
  "programlisting",
  "screen",
  "synopsis",
  "literallayout",
  "cmdsynopsis",
]);
const ADMONITIONS: Record<string, string> = {
  note: "Note",
  warning: "Warning",
  caution: "Caution",
  tip: "Tip",
  important: "Important",
};

function plain(node: Node): string {
  if (typeof node === "string") return decode(node);
  if (SKIP.has(node.tag)) return "";
  return node.kids.map(plain).join("");
}

const squash = (s: string): string => s.replace(/\s+/g, " ").trim();

function inline(nodes: Node[]): string {
  let out = "";
  for (const n of nodes) {
    if (typeof n === "string") {
      out += decode(n).replace(/\s+/g, " ");
      continue;
    }
    if (SKIP.has(n.tag)) continue;
    const inner = inline(n.kids);
    if (CODE_INLINE.has(n.tag)) out += inner.trim() === "" ? "" : `\`${squash(plain(n))}\``;
    else if (BOLD_INLINE.has(n.tag)) out += `**${squash(plain(n)).replace(/\s*\*\*\s*/g, " ")}**`;
    else if (n.tag === "emphasis")
      out +=
        n.attrs["role"] === "bold" || n.attrs["role"] === "strong"
          ? `**${inner.trim()}**`
          : `*${inner.trim()}*`;
    else if (n.tag === "ulink")
      out += `[${inner.trim() || n.attrs["url"] || ""}](${n.attrs["url"] ?? ""})`;
    else if (n.tag === "xref")
      out += n.attrs["endterm"] ? "" : `(see ${n.attrs["linkend"] ?? "above"})`;
    else if (n.tag === "footnote") out += ` (${inner.trim()})`;
    else if (n.tag === "sbr") out += "\n";
    else out += inner;
  }
  return out;
}

function table(el: El): string[] {
  const rows: { head: boolean; cells: string[] }[] = [];
  const walk = (n: El, head: boolean): void => {
    for (const k of n.kids) {
      if (typeof k === "string") continue;
      if (k.tag === "row" || k.tag === "tr") {
        rows.push({
          head,
          cells: k.kids
            .filter((c): c is El => typeof c !== "string" && ["entry", "td", "th"].includes(c.tag))
            .map((c) => squash(inline(c.kids)).replace(/\|/g, "\\|")),
        });
      } else walk(k, head || k.tag === "thead");
    }
  };
  walk(el, false);
  if (rows.length === 0) return [];
  const width = Math.max(...rows.map((r) => r.cells.length));
  const line = (cells: string[]): string =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  const headRow = rows.find((r) => r.head) ?? rows[0];
  const body = rows.filter((r) => r !== headRow);
  return [
    line(headRow?.cells ?? []),
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...body.map((r) => line(r.cells)),
    "",
  ];
}

function blocks(nodes: Node[], depth: number, out: string[], indent = ""): void {
  const flush = (text: string): void => {
    const t = text.trim();
    if (t !== "") out.push(`${indent}${t}`, "");
  };
  let run: Node[] = [];
  const flushRun = (): void => {
    flush(inline(run));
    run = [];
  };
  for (const n of nodes) {
    if (typeof n === "string") {
      run.push(n);
      continue;
    }
    const tag = n.tag;
    if (SKIP.has(tag)) continue;
    if (SECTIONS.has(tag)) {
      flushRun();
      blocks(n.kids, depth + 1, out, indent);
    } else if (tag === "title" || tag === "refname" || tag === "refpurpose" || tag === "term") {
      flushRun();
      const text = squash(inline(n.kids));
      if (text === "") continue;
      if (tag === "title") out.push(`${"#".repeat(Math.min(Math.max(depth, 1), 6))} ${text}`, "");
      else if (tag === "term") out.push(`${indent}**${text}**`, "");
      else out.push(`${indent}${tag === "refpurpose" ? "— " : "# "}${text}`, "");
    } else if (tag === "para" || tag === "simpara" || tag === "member" || tag === "attribution") {
      flushRun();
      flush(squash(inline(n.kids)));
    } else if (CODE_BLOCK.has(tag)) {
      flushRun();
      const code = plain(n).replace(/^\n+|\s+$/g, "");
      if (code !== "")
        out.push(
          `${indent}\`\`\``,
          ...code.split("\n").map((l) => `${indent}${l}`),
          `${indent}\`\`\``,
          "",
        );
    } else if (
      tag === "itemizedlist" ||
      tag === "orderedlist" ||
      tag === "simplelist" ||
      tag === "variablelist" ||
      tag === "procedure" ||
      tag === "stepalternatives"
    ) {
      flushRun();
      let i = 0;
      for (const item of n.kids) {
        if (typeof item === "string") continue;
        const inner: string[] = [];
        if (item.tag === "varlistentry") {
          const term = squash(
            inline(item.kids.filter((k) => typeof k !== "string" && k.tag === "term")),
          );
          const defs = item.kids.filter((k) => typeof k !== "string" && k.tag === "listitem");
          blocks(defs, depth, inner, "  ");
          out.push(`${indent}- **${term}**`, ...inner.map((l) => (l === "" ? "" : l)));
          continue;
        }
        if (!["listitem", "step", "member"].includes(item.tag)) continue;
        i++;
        blocks(item.kids, depth, inner, "  ");
        const marker = tag === "orderedlist" || tag === "procedure" ? `${i}.` : "-";
        const [first = "", ...rest] = inner;
        out.push(
          `${indent}${marker} ${first.trim()}`,
          ...rest.filter((l, k) => !(l === "" && k === rest.length - 1)),
        );
      }
      out.push("");
    } else if (tag in ADMONITIONS) {
      flushRun();
      const inner: string[] = [];
      blocks(n.kids, depth, inner);
      const body = inner.join("\n").trim();
      out.push(`${indent}> **${ADMONITIONS[tag]}:** ${body.replace(/\n/g, `\n${indent}> `)}`, "");
    } else if (tag === "table" || tag === "informaltable") {
      flushRun();
      const title = n.kids.find((k): k is El => typeof k !== "string" && k.tag === "title");
      if (title) out.push(`${indent}**${squash(inline(title.kids))}**`, "");
      out.push(...table(n).map((l) => `${indent}${l}`));
    } else if (
      [
        "listitem",
        "refnamediv",
        "refsynopsisdiv",
        "figure",
        "example",
        "informalexample",
        "blockquote",
        "glossentry",
        "varlistentry",
        "entry",
        "tgroup",
        "tbody",
        "thead",
        "formalpara",
        "qandaset",
        "qandaentry",
        "question",
        "answer",
        "sidebar",
        "abstract",
        "refsect",
        "bridgehead",
      ].includes(tag)
    ) {
      flushRun();
      blocks(n.kids, depth, out, indent);
    } else {
      run.push(n);
    }
  }
  flushRun();
}

export const DOCBOOK_FILE = /\.(sgml|docbook)$/i;

/** The document as Markdown; empty when nothing readable is left. */
export function docbookToMarkdown(source: string): string {
  const out: string[] = [];
  blocks(parse(source).kids, 0, out);
  return `${out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}
