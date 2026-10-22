shell("grafos");
const P = EVOL.portfolio, CODE = EVOL.code, MEM = EVOL.memory;
const TABS = [["proceso", "Proceso", "¿Qué exige cada fase y qué archivos lo cubren?"], ["memoria", "Memoria", "¿Qué hay en la memoria y cómo se conecta entre proyectos?"], ["codigo", "Código", "¿Qué depende de qué, y qué se rompe si toco este archivo?"]];
const hashParts = (location.hash || "#proceso").slice(1).split("/");
let tab = hashParts[0]; if (!TABS.some((t) => t[0] === tab)) tab = "proceso";
const root = el("main", {}); document.body.append(root);
const ink = "var(--ink)", sub = "var(--ink-2)";

function tiles(items) { return el("div", { class: "tiles" }, items.map(([n, l, s]) => el("div", { class: "tile" }, el("b", { text: n }), el("span", { text: l }), s ? el("small", { text: s }) : null))); }
function twin(title, head, rows) {
  return el("details", { class: "tw" }, el("summary", { text: title }), el("div", { class: "panel", style: "margin-top:8px;overflow:auto" },
    el("table", {}, el("thead", {}, el("tr", {}, head.map((h) => el("th", { class: h.num ? "num" : "", text: h.t })))), el("tbody", {}, rows.map((r) => el("tr", {}, r.map((c, i) => el("td", { class: head[i].num ? "num" : "", text: c }))))))));
}
function legendItem(label, swatch, onclick, pressed) {
  return el("button", { type: "button", "aria-pressed": String(pressed ?? true), onclick }, swatch, label);
}

/* ================= PROCESO ================= */
let procProject = "tienda-online", procPhase = "todas", procShow = "todas";
function appliesCat(c, ph) { const first = Math.min(...c.fases.map((x) => PHASES.indexOf(x))); return c.transversal ? PHASES.indexOf(ph) >= first : c.fases.includes(ph); }
function proceso() {
  const p = projectById(procProject), e = p.estado;
  const W = 1100, RH = 26, M = 16;
  const rows = []; // artifact rows with their discipline and phase
  const bands = [];
  for (const f of p.fases) {
    if (procPhase !== "todas" && f.phase !== procPhase) continue;
    const band = { phase: f.phase, start: rows.length, discs: [] };
    for (const d of f.disciplines) {
      const dStart = rows.length;
      for (const a of d.artefactos) {
        if (a.archivos.length) for (const file of a.archivos) rows.push({ tipo: "ok", text: file });
        else rows.push({ tipo: a.min === 0 ? "opt" : "no", text: a.patron });
      }
      band.discs.push({ d, start: dStart, end: rows.length });
    }
    if (procShow === "todas") {
      const activeIds = new Set(p.modulos.flatMap((m) => m.disciplinas));
      for (const c of EVOL.catalogo.filter((c) => !activeIds.has(c.id) && appliesCat(c, f.phase))) {
        const dStart = rows.length;
        for (const a of c.artefactos.filter((a) => a.min >= 1)) rows.push({ tipo: "inact", text: a.patron });
        band.discs.push({ d: { id: c.id, nombre: c.nombre, module: "", tipo: c.tipo }, start: dStart, end: rows.length, inactive: true });
      }
    }
    if (!band.discs.length) rows.push({ tipo: "vacio", text: "ninguna disciplina en esta fase" });
    band.end = rows.length; bands.push(band);
  }
  const gap = 10, total = rows.length + bands.length;
  const H = total * RH + M * 2 + bands.length * gap;
  const svg = sv("svg", { class: "graph", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Proceso de ${p.nombre}: fases, disciplinas y archivos` });
  let y = M; const yOf = (i, b) => y; // placeholder
  const xP = 16, wP = 170, xD = 300, wD = 300, xA = 700, wA = 380;
  let cursor = M;
  for (const b of bands) {
    const top = cursor, rowsN = Math.max(b.end - b.start, 1), mid = top + (rowsN * RH) / 2;
    // rows
    for (let i = b.start; i < b.end; i++) {
      const r = rows[i], ry = top + (i - b.start) * RH + RH / 2;
      r.y = ry;
      const mk = r.tipo === "ok" ? "✓" : r.tipo === "no" ? "✗" : r.tipo === "opt" ? "–" : r.tipo === "inact" ? "·" : "";
      svg.append(sv("text", { x: xA + 18, y: ry + 4, "font-size": 12, fill: r.tipo === "ok" ? ink : "var(--muted)", "font-family": "ui-monospace,monospace" }, r.text.length > 48 ? "…" + r.text.slice(-46) : r.text));
      if (mk) svg.append(sv("text", { x: xA, y: ry + 4, "font-size": 12, fill: r.tipo === "no" ? "var(--serious)" : r.tipo === "ok" ? "var(--good)" : "var(--muted)", "font-weight": 700 }, mk));
    }
    // disciplines
    for (const dd of b.discs) {
      const n = Math.max(dd.end - dd.start, 1), dy = top + (dd.start - b.start) * RH + (n * RH) / 2;
      const g = sv("g", { tabindex: 0, role: "img", "aria-label": `${dd.d.id}: ${dd.d.nombre}` });
      const off = !!dd.inactive;
      g.append(sv("rect", { x: xD, y: dy - 11, width: wD, height: 22, rx: 6, fill: "var(--surface)", stroke: off ? "var(--grid)" : "var(--border)" }),
        sv("rect", { x: xD, y: dy - 11, width: 4, height: 22, rx: 2, fill: off ? "var(--axis)" : "var(--s1)" }),
        sv("text", { x: xD + 14, y: dy + 4, "font-size": 12.5, fill: off ? "var(--muted)" : ink }, `${dd.d.id}  `, sv("tspan", { fill: off ? "var(--muted)" : sub, "font-size": 11.5 }, off ? "no activada" : (dd.d.nombre.length > 34 ? dd.d.nombre.slice(0, 33) + "…" : dd.d.nombre))));
      g.addEventListener("mousemove", (ev) => tip(dd.inactive ? [el("b", { text: dd.d.id + " · " + dd.d.nombre }), el("div", { text: "No activada en este proyecto (" + (dd.d.tipo === "base" ? "base" : "extendida") + ")." }), el("div", { text: "Para activarla, añade «" + dd.d.id + "» a las disciplinas del módulo en evol.config.json." })] : [el("b", { text: dd.d.id }), el("div", { text: dd.d.nombre + (p.modulos.length > 1 ? " · módulo " + dd.d.module : "") })], ev.clientX, ev.clientY));
      g.addEventListener("mouseleave", () => tip(null));
      // edges discipline -> artifacts
      for (let i = dd.start; i < dd.end; i++) svg.append(sv("path", { d: `M${xD + wD},${dy} C${xD + wD + 40},${dy} ${xA - 40},${rows[i].y} ${xA - 4},${rows[i].y}`, fill: "none", stroke: dd.inactive ? "var(--grid)" : "var(--axis)", "stroke-width": 1 }));
      // edge phase -> discipline
      svg.append(sv("path", { d: `M${xP + wP},${mid} C${xP + wP + 50},${mid} ${xD - 50},${dy} ${xD},${dy}`, fill: "none", stroke: dd.inactive ? "var(--grid)" : "var(--axis)", "stroke-width": 1 }));
      svg.append(g);
    }
    // phase node
    const ap = [...p.aprobaciones].reverse().find((a) => a.fase === b.phase);
    const st = e.adoptadas.includes(b.phase) ? "adoptada" : e.completadas.includes(b.phase) ? "hecha" : e.fase === b.phase ? "actual" : "pendiente";
    const ph = sv("g", { tabindex: 0, role: "img", "aria-label": `Fase ${PHASE_INFO[b.phase][0]}, ${st}` });
    ph.append(sv("rect", { x: xP, y: mid - 20, width: wP, height: 40, rx: 8, fill: st === "actual" ? "var(--wash)" : "var(--surface)", stroke: st === "actual" ? "var(--seq-450)" : "var(--axis)", "stroke-width": st === "actual" ? 2 : 1 }),
      sv("text", { x: xP + 12, y: mid - 3, "font-size": 13, "font-weight": 650, fill: ink }, PHASE_INFO[b.phase][0]),
      sv("text", { x: xP + 12, y: mid + 13, "font-size": 11, fill: sub }, ap ? `✓ ${ap.aprobador} · ${fmtDate(ap.fecha)}` : st));
    svg.append(ph);
    cursor = top + rowsN * RH + gap;
    svg.append(sv("line", { x1: M, x2: W - M, y1: cursor - gap / 2, y2: cursor - gap / 2, stroke: "var(--grid)" }));
  }
  svg.setAttribute("viewBox", `0 0 ${W} ${cursor + M}`);
  const tr = []; for (const b of bands) for (const dd of b.discs) for (let i = dd.start; i < dd.end; i++) tr.push([PHASE_INFO[b.phase][0], dd.d.id, dd.inactive ? "no activada" : "activada", rows[i].text, rows[i].tipo === "ok" ? "existe" : rows[i].tipo === "opt" ? "opcional, no existe" : rows[i].tipo === "inact" ? "no se exige" : "falta"]);
  return el("div", {},
    el("div", { class: "filters" },
      el("label", { class: "note", for: "gp", text: "Proyecto" }), el("select", { id: "gp", class: "sel", onchange: (ev) => { procProject = ev.target.value; render(); } }, P.map((x) => el("option", { value: x.id, selected: x.id === procProject }, x.nombre))),
      el("label", { class: "note", for: "gs", text: "Disciplinas" }), el("select", { id: "gs", class: "sel", onchange: (ev) => { procShow = ev.target.value; render(); } }, [["todas", "Todas (" + EVOL.catalogo.length + ")"], ["activas", "Solo las activadas"]].map(([v, t]) => el("option", { value: v, selected: v === procShow }, t))),
      el("label", { class: "note", for: "gf", text: "Fase" }), el("select", { id: "gf", class: "sel", onchange: (ev) => { procPhase = ev.target.value; render(); } }, ["todas", ...PHASES].map((x) => el("option", { value: x, selected: x === procPhase }, x === "todas" ? "Todas" : PHASE_INFO[x][0])))),
    el("div", { class: "legend", "aria-label": "Leyenda" }, el("span", { style: "display:inline-flex;gap:6px;align-items:center" }, el("span", { class: "sw", style: "background:var(--ink);border-radius:3px", text: "" }), "Fase (con su aprobación)"), el("span", { style: "display:inline-flex;gap:6px;align-items:center" }, el("span", { class: "sw", style: "background:var(--s1);border-radius:3px" }), "Disciplina"), el("span", { style: "display:inline-flex;gap:6px;align-items:center" }, el("span", { class: "sw", style: "background:var(--axis);border-radius:3px" }), "Disciplina no activada"), el("span", { class: "note", text: "✓ archivo existe · ✗ falta · – opcional · · no se exige" })),
    svg, twin("Ver como tabla", [{ t: "Fase" }, { t: "Disciplina" }, { t: "Activación" }, { t: "Artefacto" }, { t: "Estado" }], tr));
}

/* ================= MEMORIA ================= */
function memoria() {
  const wings = Object.entries(MEM.alas.wings).sort((a, b) => b[1] - a[1]);
  const rooms = {}; for (const [w, rs] of Object.entries(MEM.taxonomia.taxonomy)) for (const [r, n] of Object.entries(rs)) { (rooms[r] ||= []).push([w, n]); }
  const roomList = Object.entries(rooms).map(([r, ws]) => ({ r, ws, total: ws.reduce((s, x) => s + x[1], 0) })).sort((a, b) => b.total - a.total);
  const total = wings.reduce((s, x) => s + x[1], 0);
  // The canvas is sized from the labels, so the two columns sit in the middle with equal margins.
  const rad = (n) => 6 + 5 * Math.log10(n + 1);
  const CH = 7.6, PAD = 44, GAP = 300;
  const leftW = Math.max(...wings.map(([w, n]) => (w.length + fmtNum(n).length + 2) * CH + rad(n) + 18));
  const rightW = Math.max(...roomList.map((o) => (o.r.length + fmtNum(o.total).length + 2 + (o.ws.length > 1 ? `· túnel entre ${o.ws.length} wings`.length + 1 : 0)) * CH + rad(o.total) + 18));
  const xL = PAD + leftW, xR = xL + GAP, W = Math.round(xR + rightW + PAD);
  const H = Math.max(wings.length, roomList.length) * 64 + 84;
  const yW = new Map(wings.map(([w], i) => [w, 68 + i * ((H - 138) / Math.max(wings.length - 1, 1))]));
  const yR = new Map(roomList.map((o, i) => [o.r, 68 + i * ((H - 138) / Math.max(roomList.length - 1, 1))]));
  const svg = sv("svg", { class: "graph", style: "max-width:1060px;margin:0 auto", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Wings de MemPalace conectados a sus salas" });
  for (const o of roomList) for (const [w, n] of o.ws) svg.append(sv("path", { d: `M${xL},${yW.get(w)} C${xL + 110},${yW.get(w)} ${xR - 110},${yR.get(o.r)} ${xR},${yR.get(o.r)}`, fill: "none", stroke: o.ws.length > 1 ? "var(--s2)" : "var(--axis)", "stroke-width": 1 + Math.log10(n + 1) * 1.2, opacity: o.ws.length > 1 ? 0.55 : 0.9 }));
  for (const [w, n] of wings) {
    const g = sv("g", { tabindex: 0, role: "img", "aria-label": `Wing ${w}: ${n} recuerdos` });
    g.append(sv("circle", { cx: xL, cy: yW.get(w), r: rad(n), fill: "var(--s1)", stroke: "var(--surface)", "stroke-width": 2 }), sv("text", { x: xL - rad(n) - 10, y: yW.get(w) + 4, "text-anchor": "end", "font-size": 13, fill: ink }, w, sv("tspan", { fill: sub, dx: 8 }, fmtNum(n))));
    g.addEventListener("mousemove", (ev) => tip([el("b", { text: "Wing " + w }), el("div", { text: fmtNum(n) + " recuerdos" }), el("div", { text: "Salas: " + Object.keys(MEM.taxonomia.taxonomy[w]).join(", ") })], ev.clientX, ev.clientY)); g.addEventListener("mouseleave", () => tip(null)); svg.append(g);
  }
  for (const o of roomList) {
    const tun = o.ws.length > 1, g = sv("g", { tabindex: 0, role: "img", "aria-label": `Sala ${o.r}: ${o.total} recuerdos${tun ? ", túnel entre " + o.ws.length + " wings" : ""}` });
    g.append(sv("circle", { cx: xR, cy: yR.get(o.r), r: rad(o.total), fill: "var(--s2)", stroke: "var(--surface)", "stroke-width": 2 }),
      tun ? sv("circle", { cx: xR, cy: yR.get(o.r), r: rad(o.total) + 5, fill: "none", stroke: "var(--s2)", "stroke-width": 1.5 }) : null,
      sv("text", { x: xR + rad(o.total) + 12, y: yR.get(o.r) + 4, "font-size": 13, fill: ink }, o.r, sv("tspan", { fill: sub, dx: 8 }, fmtNum(o.total)), tun ? sv("tspan", { fill: sub, dx: 8 }, `· túnel entre ${o.ws.length} wings`) : null));
    g.addEventListener("mousemove", (ev) => tip([el("b", { text: "Sala " + o.r }), ...o.ws.map(([w, n]) => el("div", { text: `${w}: ${fmtNum(n)}` }))], ev.clientX, ev.clientY)); g.addEventListener("mouseleave", () => tip(null)); svg.append(g);
  }
  svg.append(sv("text", { x: xL, y: 20, "text-anchor": "middle", "font-size": 12, fill: sub, "font-weight": 600 }, "WINGS (proyectos y personas)"), sv("text", { x: xR, y: 20, "text-anchor": "middle", "font-size": 12, fill: sub, "font-weight": 600 }, "SALAS (temas)"));
  // Fit the canvas to what was really drawn (label widths depend on the font), so the graph is centred.
  queueMicrotask(() => {
    try { const b = svg.getBBox(); if (b.width > 0) svg.setAttribute("viewBox", `${Math.floor(b.x - PAD)} ${Math.floor(b.y - 16)} ${Math.ceil(b.width + 2 * PAD)} ${Math.ceil(b.height + 32)}`); } catch { /* not rendered: keep the estimate */ }
  });
  const kg = MEM.kg;
  return el("div", {},
    tiles([[wings.length, "Wings"], [roomList.length, "Salas"], [fmtNum(total), "Recuerdos"], [MEM.grafo.tunnel_rooms, "Túneles pasivos", "salas compartidas entre wings"], [kg.entities, "Entidades del grafo de conocimiento", kg.entities ? null : "vacío por ahora"]]),
    el("div", { class: "legend" }, el("span", { style: "display:inline-flex;gap:6px;align-items:center" }, el("span", { class: "sw", style: "background:var(--s1)" }), "Wing"), el("span", { style: "display:inline-flex;gap:6px;align-items:center" }, el("span", { class: "sw", style: "background:var(--s2)" }), "Sala"), el("span", { class: "note", text: "El tamaño y el grosor crecen con el número de recuerdos (escala logarítmica). El anillo marca una sala compartida." })),
    svg,
    kg.entities === 0 ? el("div", { class: "empty-state", style: "margin-top:14px" }, el("b", { text: "El grafo de conocimiento está vacío. " }), "MemPalace guarda recuerdos (esto) y, aparte, entidades y relaciones con fechas de validez (kg). Hoy nadie lo alimenta; cuando evol registre decisiones como relaciones aparecerán aquí.") : null,
    twin("Ver como tabla", [{ t: "Wing" }, { t: "Sala" }, { t: "Recuerdos", num: true }], wings.flatMap(([w]) => Object.entries(MEM.taxonomia.taxonomy[w]).map(([r, n]) => [w, r, fmtNum(n)]))));
}

/* ================= CÓDIGO ================= */
const GRP = { core: ["Núcleo (src/core)", "var(--s1)"], comandos: ["Comandos (src/commands)", "var(--s2)"], codeintel: ["Código (src/codeintel)", "var(--s3)"], otros: ["Otros de src", "var(--muted)"], pruebas: ["Pruebas", null] };
let colorMode = "calor";
let selected = hashParts[0] === "codigo" && hashParts[1] ? decodeURIComponent(hashParts.slice(1).join("/")) : null, groupsOn = new Set(Object.keys(GRP)), query = "";
function codigo() {
  const W = 980, H = 640, m = 44, nodes = CODE.nodos, byId = new Map(nodes.map((n) => [n.id, n]));
  const px = (n) => m + n.x * (W - 2 * m), py = (n) => m + n.y * (H - 2 * m), maxImp = Math.max(1, ...nodes.map((n) => n.impacto)), rd = (n) => 3.2 + 16 * Math.sqrt(n.impacto / maxImp);
  const fillOf = (n) => (n.prueba ? null : colorMode === "calor" ? heat(Math.pow(n.impacto / maxImp, 0.8)) : GRP[n.grupo][1]);
  const svg = sv("svg", { class: "graph", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Grafo de archivos: cada punto es un archivo y cada línea un import" });
  const top = [...nodes].sort((a, b) => b.impacto - a.impacto).slice(0, 8).map((n) => n.id);
  const edgeEls = [];
  const edgeColor = (a, b) => { const hub = a.impacto >= b.impacto ? a : b; return fillOf(hub) || "var(--axis)"; };
  for (const e of CODE.aristas) { const a = byId.get(e.a), b = byId.get(e.b); const l = sv("line", { x1: px(a), y1: py(a), x2: px(b), y2: py(b), stroke: edgeColor(a, b), "stroke-width": 1, opacity: 0.3 }); l.dataset.a = e.a; l.dataset.b = e.b; svg.append(l); edgeEls.push(l); }
  const dots = [];
  for (const n of [...nodes].sort((a, b) => a.impacto - b.impacto)) {
    const g = sv("g", { tabindex: 0, role: "button", "aria-label": `${n.id}, alcance ${n.impacto} archivos`, "data-id": n.id, style: "cursor:pointer" });
    const fill = fillOf(n);
    g.append(sv("circle", { cx: px(n), cy: py(n), r: rd(n) + 4, fill: "transparent" }), // larger hit area
      sv("circle", { cx: px(n), cy: py(n), r: rd(n), fill: fill || "var(--surface)", stroke: fill ? "var(--surface)" : "var(--muted)", "stroke-width": fill ? 2 : 1.8 }));
    g.addEventListener("click", () => { selected = n.id; paint(); });
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selected = n.id; paint(); } });
    g.addEventListener("mousemove", (ev) => tip([el("b", { text: n.id }), el("div", { text: `alcance ${n.impacto} archivos · ${n.totalSimbolos} símbolos` })], ev.clientX, ev.clientY));
    g.addEventListener("mouseleave", () => tip(null));
    svg.append(g); dots.push([n, g]);
  }
  const labels = sv("g", {}); svg.append(labels);
  const side = el("div", { class: "panel side" });
  function paint() {
    const q = query.trim().toLowerCase();
    for (const [n, g] of dots) { const on = groupsOn.has(n.grupo) && (!q || n.id.toLowerCase().includes(q)); g.style.opacity = on ? 1 : 0.12; g.style.pointerEvents = on ? "" : "none"; }
    for (const l of edgeEls) { const a = byId.get(l.dataset.a), b = byId.get(l.dataset.b); const on = groupsOn.has(a.grupo) && groupsOn.has(b.grupo); const sel = selected && (l.dataset.a === selected || l.dataset.b === selected);
      l.setAttribute("opacity", sel ? 0.95 : on ? (selected ? 0.1 : 0.28) : 0.03); l.setAttribute("stroke", sel ? "var(--ink)" : edgeColor(a, b)); l.setAttribute("stroke-width", sel ? 1.6 : 1); }
    labels.replaceChildren();
    for (const n of nodes) if ((top.slice(0, 6).includes(n.id) || n.id === selected) && groupsOn.has(n.grupo)) labels.append(sv("text", { x: px(n), y: py(n) - rd(n) - 6, "text-anchor": "middle", "font-size": 11.5, fill: ink, "paint-order": "stroke", stroke: "var(--surface)", "stroke-width": 3 }, n.label));
    side.replaceChildren(...detail());
  }
  function detail() {
    const n = selected && byId.get(selected);
    if (!n) return [el("h2", { text: "Mayor alcance" }), el("p", { class: "note", text: "Archivos que arrastran más código si se rompen. Elige uno para ver su detalle." }),
      el("table", {}, el("tbody", {}, [...nodes].sort((a, b) => b.impacto - a.impacto).slice(0, 8).map((x) => el("tr", { style: "cursor:pointer", onclick: () => { selected = x.id; paint(); } }, el("td", { class: "mono", text: x.id }), el("td", { class: "num", text: x.impacto })))))];
    return [el("h3", { text: n.id }), el("span", { class: "note", text: GRP[n.grupo][0] }),
      el("dl", {}, el("dt", { text: "Símbolos" }), el("dd", { text: n.totalSimbolos }), el("dt", { text: "Lo importan" }), el("dd", { text: n.importadores + " archivos" }), el("dt", { text: "Alcance transitivo" }), el("dd", { text: `${n.impacto} archivos (${Math.round((n.impacto / nodes.length) * 100)}%)` }), el("dt", { text: "Pruebas que lo cubren" }), el("dd", { text: n.pruebas.length })),
      n.simbolos.length ? el("div", {}, el("div", { class: "note", text: "Símbolos" }), n.simbolos.map((s) => el("span", { class: "pill", title: s.tipo, text: s.nombre })), n.totalSimbolos > n.simbolos.length ? el("span", { class: "note", text: ` +${n.totalSimbolos - n.simbolos.length} más` }) : null) : null,
      el("div", { style: "margin-top:10px" }, el("div", { class: "note", text: "Pruebas" }), n.pruebas.length ? n.pruebas.map((t) => el("div", { class: "mono", text: t })) : el("div", { class: "note", text: "Ninguna prueba lo importa directamente." })),
      el("button", { class: "chip", type: "button", style: "margin-top:12px", onclick: () => { selected = null; paint(); } }, "Quitar selección")];
  }
  const legend = el("div", { class: "legend", role: "group", "aria-label": "Leyenda: grupos de archivos" }, Object.entries(GRP).map(([k, [label, col]]) =>
    legendItem(label, el("span", { class: "sw" + (col ? "" : " ring"), style: col ? `background:${col}` : "" }), () => { groupsOn.has(k) ? groupsOn.delete(k) : groupsOn.add(k); if (!groupsOn.size) groupsOn = new Set(Object.keys(GRP)); render(); }, groupsOn.has(k))));
  const R = CODE.resumen, mayor = [...nodes].sort((a, b) => b.impacto - a.impacto)[0];
  const out = el("div", {},
    tiles([[R.archivos, "Archivos", `de ${R.indexados} indexados`], [R.simbolos, "Símbolos"], [R.relaciones, "Relaciones", "imports entre archivos"], [R.pruebas, "Archivos de prueba"], [mayor.impacto, "Mayor alcance", mayor.label]]),
    el("div", { class: "filters" }, el("input", { class: "search", type: "search", placeholder: "Buscar archivo…", "aria-label": "Buscar archivo", value: query, oninput: (ev) => { query = ev.target.value; paint(); } }),
      el("span", { class: "note", text: "El tamaño del punto es el alcance: cuántos archivos dependen de él, directa o indirectamente." })),
    el("div", { class: "filters" }, el("span", { class: "note", text: "Colorear por" }),
      [["calor", "Alcance (mapa de calor)"], ["carpeta", "Carpeta"]].map(([k, label]) => el("button", { class: "chip", type: "button", "aria-pressed": String(colorMode === k), onclick: () => { colorMode = k; render(); } }, label)),
      colorMode === "calor" ? el("span", { class: "heatbar", role: "img", "aria-label": "De poco alcance (azul) a mucho alcance (rojo)" }, el("small", { text: "poco" }), el("i", { style: `background:linear-gradient(90deg,${[0, 0.25, 0.5, 0.72, 1].map((t) => heat(t)).join(",")})` }), el("small", { text: "mucho" })) : null),
    colorMode === "carpeta" ? legend : el("p", { class: "note", style: "margin:4px 0 10px" }, "Los puntos grandes y rojos son los que más arrastran si se rompen; los pequeños y azules casi no afectan a nadie. Las líneas toman el color del archivo más importante de cada import."),
    el("div", { class: "grid2", style: "grid-template-columns:minmax(0,2fr) minmax(260px,1fr)" }, svg, side),
    twin("Ver como tabla", [{ t: "Archivo" }, { t: "Grupo" }, { t: "Símbolos", num: true }, { t: "Lo importan", num: true }, { t: "Alcance", num: true }, { t: "Pruebas", num: true }],
      [...nodes].sort((a, b) => b.impacto - a.impacto).map((n) => [n.id, GRP[n.grupo][0], n.totalSimbolos, n.importadores, n.impacto, n.pruebas.length])));
  queueMicrotask(paint);
  return out;
}

function render() {
  root.replaceChildren(el("h1", { text: "Grafos de conocimiento" }), el("p", { class: "lede", text: TABS.find((t) => t[0] === tab)[2] }),
    el("div", { class: "tabs", role: "tablist" }, TABS.map(([id, label]) => el("button", { role: "tab", type: "button", "aria-selected": String(tab === id), onclick: () => { tab = id; location.hash = id; render(); } }, label))),
    tab === "proceso" ? proceso() : tab === "memoria" ? memoria() : codigo(),
    el("p", { class: "foot", text: tab === "codigo" ? `Código: el propio repositorio ${CODE.proyecto}, indexado con el indexador nativo (ts-morph + SQLite).` : tab === "memoria" ? "Memoria: la estructura real de tu MemPalace. Solo se muestran nombres y conteos, nunca el contenido de los recuerdos." : "Proceso: salido del estado y de los archivos reales del proyecto elegido." }));
}
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (TABS.some((t) => t[0] === h) && h !== tab) { tab = h; render(); } });
render();
