const PHASES = ["briefing", "spec", "plan", "build", "qa", "retro"];
const PHASE_INFO = {
  briefing: ["Briefing", "Entender el problema y qué se pide"],
  spec: ["Spec", "Definir qué se construye y cómo se acepta"],
  plan: ["Plan", "Cómo y en qué orden se hace"],
  build: ["Build", "Construir guiado por pruebas"],
  qa: ["QA", "Verificar y asegurar"],
  retro: ["Retro", "Registrar lo aprendido"],
  done: ["Terminado", "Todas las fases aprobadas"],
};

/* ---------- helpers ---------- */
function el(tag, attrs, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}
const svgNS = "http://www.w3.org/2000/svg";
function sv(tag, attrs, ...kids) {
  const node = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) node.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return node;
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const hm = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `hoy ${hm}`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short" }) + ` ${hm}`;
}
const fmtNum = (n) => new Intl.NumberFormat("es").format(n);
function storeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

/* ---------- theme ---------- */
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
}
applyTheme(storeGet("evol-theme"));

/* ---------- shell ---------- */
function shell(current) {
  const links = [["index.html", "Tablero", "tablero"], ["proyecto.html", "Proyecto", "proyecto"], ["documentacion.html", "Documentación", "documentacion"], ["skills.html", "Skills", "skills"], ["grafos.html", "Grafos", "grafos"]];
  const top = el("header", { class: "top" }, el("div", { class: "top-in" },
    el("a", { class: "brand", href: "index.html" }, "evol", el("span", { text: " · panel" })),
    el("nav", { class: "nav", "aria-label": "Principal" }, links.map(([h, t, id]) => el("a", { href: h, "aria-current": id === current ? "page" : false }, t))),
    el("div", { class: "spacer" }),
    el("span", { class: "badge-data", title: "Todo lo que ves sale del estado real de los proyectos, no de ejemplos inventados" }, "Datos reales · " + EVOL.generado),
    el("button", { class: "icon-btn", type: "button", "aria-label": "Cambiar tema", onclick: () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      const next = dark ? "light" : "dark"; applyTheme(next); storeSet("evol-theme", next);
    } }, "Tema")));
  document.body.prepend(top);
}

/* ---------- domain: what the real data says about a project ---------- */
function discOk(d) { return d.artefactos.every((a) => a.encontrados >= a.min && a.pendientes === 0); }
function progress(p) {
  const ds = p.estado.disciplinas;
  return { ok: ds.filter(discOk).length, total: ds.length };
}
function badge(p) {
  const e = p.estado;
  if (e.fase === "done") return { tone: "good", icon: "✓", text: "Terminado" };
  if (p.problemas.length > 0) return { tone: "serious", icon: "!", text: `Bloqueado · ${p.problemas.length}` };
  if (e.aprobacion.state === "vigente") return { tone: "info", icon: "→", text: "Aprobada", full: "Aprobada: falta ejecutar evol next" };
  if (e.aprobacion.state === "obsoleta") return { tone: "warning", icon: "!", text: "Aprobación obsoleta" };
  if (e.aprobacion.state === "no-integro") return { tone: "critical", icon: "×", text: "Registro no íntegro" };
  return { tone: "good", icon: "✓", text: "Listo para aprobar" };
}
function statusChip(b) { return el("span", { class: "st " + b.tone, title: b.full || b.text }, el("i", { "aria-hidden": "true", text: b.icon }), b.text); }
function stepsBar(p) {
  const e = p.estado;
  return el("div", { class: "steps", role: "img", "aria-label": "Pipeline: " + PHASES.map((ph) => `${ph} ${e.adoptadas.includes(ph) ? "adoptada" : e.completadas.includes(ph) ? "hecha" : e.fase === ph ? "actual" : "pendiente"}`).join(", ") },
    PHASES.map((ph) => el("span", { class: e.adoptadas.includes(ph) ? "adopted" : e.completadas.includes(ph) ? "done" : e.fase === ph ? "now" : "", title: PHASE_INFO[ph][0] })));
}
function projectById(id) { return EVOL.portfolio.find((p) => p.id === id); }

/* ---------- tooltip (enhances; every value is also in a table) ---------- */
let tipEl;
function tip(content, x, y) {
  if (!tipEl) { tipEl = el("div", { class: "tip", role: "tooltip" }); document.body.append(tipEl); }
  if (content == null) { tipEl.style.display = "none"; return; }
  tipEl.replaceChildren(...[].concat(content));
  tipEl.style.display = "block";
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.min(x + 14, innerWidth - w - 8) + "px";
  tipEl.style.top = Math.min(y + 14, innerHeight - h - 8) + "px";
}

/* ---------- heat ramp: few = blue, many = red (hubs stand out, like a force-directed network map) ---------- */
const HEAT_STOPS = [[0, [42, 120, 214]], [0.25, [47, 179, 106]], [0.5, [200, 214, 58]], [0.72, [245, 166, 35]], [1, [229, 36, 29]]];
function heat(t) {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [t1, c1] = HEAT_STOPS[i];
    if (x <= t1) {
      const [t0, c0] = HEAT_STOPS[i - 1], k = (x - t0) / (t1 - t0 || 1);
      return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(",")})`;
    }
  }
  return "rgb(229,36,29)";
}

/* ---------- a small, safe Markdown renderer (shared by Documentación and Skills) ---------- */
function mdInline(text, ctx) {
  const out = [];
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\n]+\*)|(\b_[^_\n]+_\b)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (m[1]) out.push(el("code", { text: t.slice(1, -1) }));
    else if (m[2]) out.push(el("strong", {}, ...mdInline(t.slice(2, -2), ctx)));
    else if (m[3]) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t);
      if (/^https?:\/\//.test(href)) out.push(el("a", { href, target: "_blank", rel: "noopener noreferrer" }, label));
      else {
        const to = ctx && ctx.linkFor ? ctx.linkFor(href) : null;
        out.push(to ? el("a", { href: to }, label) : el("span", { class: "deadlink", title: href }, label));
      }
    } else out.push(el("em", {}, ...mdInline(t.slice(1, -1), ctx)));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function mdToDom(src, ctx) {
  const root = el("div", { class: "md" });
  const lines = src.replace(/\r/g, "").split("\n");
  const isBlock = (l) => /^(```|#{1,6}\s|\s*>|\s*([-*+]|\d+\.)\s|\s*\|)/.test(l);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; root.append(el("pre", {}, el("code", { text: buf.join("\n") }))); continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { root.append(el("h" + Math.min(h[1].length + 2, 6), {}, ...mdInline(h[2], ctx))); i++; continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { root.append(el("hr")); i++; continue; }
    if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || "")) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line); i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      root.append(el("div", { class: "tscroll" }, el("table", {}, el("thead", {}, el("tr", {}, head.map((c) => el("th", {}, ...mdInline(c, ctx))))),
        el("tbody", {}, rows.map((r) => el("tr", {}, r.map((c) => el("td", {}, ...mdInline(c, ctx)))))))));
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      root.append(el("blockquote", {}, ...mdInline(buf.join(" "), ctx))); continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const list = el(ordered ? "ol" : "ul", {});
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const m = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i++]);
        const task = /^\[([ xX])\]\s+(.*)$/.exec(m[3]);
        const li = el("li", { class: m[1].length >= 2 ? "nested" : false });
        if (task) li.append(el("input", { type: "checkbox", disabled: true, checked: task[1] !== " " ? true : false, "aria-label": task[1] !== " " ? "hecho" : "pendiente" }), " ", ...mdInline(task[2], ctx));
        else li.append(...mdInline(m[3], ctx));
        list.append(li);
      }
      root.append(list); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && isBlock(lines[i]))) buf.push(lines[i++]);
    root.append(el("p", {}, ...mdInline(buf.join(" "), ctx)));
  }
  return root;
}
const taskCount = (text) => ({ done: (text.match(/^\s*[-*+]\s+\[[xX]\]/gm) || []).length, total: (text.match(/^\s*[-*+]\s+\[[ xX]\]/gm) || []).length });

