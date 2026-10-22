shell("documentacion");
const D = window.EVOL_DOCS;
const P = EVOL.portfolio;

const GROUPS = [
  ["especificaciones", "Especificaciones", "SPEC, dominio, features, amenazas, plan y escenarios"],
  ["evidencias", "Evidencias", "Aprobaciones firmadas, verificación, QA, pruebas y trazabilidad"],
  ["mejoras", "Mejoras", "Propuestas, lecciones, riesgo y huecos por cerrar"],
  ["decisiones", "Decisiones y memoria", "ADR, constitución y memoria del proyecto"],
  ["diagramas", "Diagramas", "Los diagramas UML, generados con los datos reales"],
  ["informe", "Informe", "El dossier del proyecto en DOCX y PDF"],
  ["general", "Documentación general", "README, guías y archivos para agentes"],
];
const GROUP_LABEL = Object.fromEntries(GROUPS.map(([id, label]) => [id, label]));
const STATE = {
  ok: ["good", "✓", "Completo"],
  pendiente: ["warning", "!", "Por completar"],
  falta: ["serious", "✗", "No existe"],
};

/* ---------- state kept in the URL: #proyecto/elemento ---------- */
const hashParts = () => (location.hash || "").slice(1).split("/");
let current = decodeURIComponent(hashParts()[0] || "");
if (!projectById(current)) current = storeGet("evol-docs-project") && projectById(storeGet("evol-docs-project")) ? storeGet("evol-docs-project") : "ajicolor";
let selected = hashParts()[1] ? decodeURIComponent(hashParts().slice(1).join("/")) : null;
let query = "";
let onlyGaps = false;
let mdView = "vista";
let zoom = 1;
let view = storeGet("evol-docs-view") === "lista" ? "lista" : "cielo";   // the sky is the default view
let source = "documentos";                                                // "documentos" | "codigo" (only where the project has a code graph)
let sky = null;

const root = el("main", {});
document.body.append(root);
const link = (projectId, itemId) => `#${encodeURIComponent(projectId)}${itemId ? "/" + encodeURIComponent(itemId) : ""}`;
const allItems = (dd) => GROUPS.flatMap(([g]) => dd.items[g]);
const itemById = (dd, id) => allItems(dd).find((i) => i.id === id);
const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function stateChip(estado) {
  const [tone, icon, text] = STATE[estado] || STATE.ok;
  return el("span", { class: "st " + tone }, el("i", { "aria-hidden": "true", text: icon }), text);
}

function resolveRelative(dd, from, href) {
  const clean = href.split("#")[0].replace(/^\.\//, "");
  if (!clean) return null;
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  const found = allItems(dd).find((i) => i.ruta === clean || i.ruta === base + clean);
  return found ? found.id : null;
}
/* ---------- search ---------- */
function matches(item, q) {
  if (!q) return true;
  const hay = `${item.titulo} ${item.ruta} ${item.tipo} ${item.texto || ""}`.toLowerCase();
  return hay.includes(q);
}
function snippet(text, q) {
  const lines = (text || "").split("\n");
  const hits = lines.filter((l) => l.toLowerCase().includes(q)).slice(0, 2);
  return hits.map((l) => l.trim().slice(0, 160));
}

/* ---------- header ---------- */
function header(p, dd) {
  const b = badge(p);
  const gaps = Object.values(dd.items).flat().filter((i) => i.estado === "falta" || i.estado === "pendiente").length;
  return el("div", {},
    el("div", { class: "filters" },
      el("label", { for: "sel", class: "note", text: "Proyecto" }),
      el("select", { id: "sel", class: "sel", onchange: (e) => { current = e.target.value; selected = null; storeSet("evol-docs-project", current); location.hash = link(current); render(); } },
        P.map((x) => el("option", { value: x.id, selected: x.id === p.id }, `${x.nombre} — ${PHASE_INFO[x.estado.fase][0]}`))),
      el("input", { class: "search", type: "search", placeholder: "Buscar en toda la documentación…", "aria-label": "Buscar en la documentación del proyecto", value: query,
        oninput: (e) => { query = e.target.value; selected = null; render(true); } }),
      el("button", { class: "chip", type: "button", "aria-pressed": String(onlyGaps), onclick: () => { onlyGaps = !onlyGaps; render(); } }, `Solo lo que falta (${gaps})`)),
    el("h1", { text: "Documentación de " + p.nombre }),
    el("p", { class: "lede", text: "Todo lo asociado al proyecto en un solo lugar: lo que se especificó, lo que lo demuestra, lo que hay que mejorar y cómo está modelado." }),
    el("div", { class: "filters" }, statusChip(b), el("a", { class: "chip", href: "proyecto.html#" + p.id }, "Ver estado del pipeline"),
      p.id === "evol-driven" ? el("a", { class: "chip", href: "grafos.html#codigo" }, "Ver grafo de código") : null));
}

function kpis(dd) {
  return el("div", { class: "tiles docs-tiles" }, GROUPS.map(([g, label]) => {
    const r = dd.resumen[g] || { hay: 0, faltan: 0 };
    const first = dd.items[g].find((i) => i.estado !== "falta") || dd.items[g][0];
    return el("a", { class: "tile tile-link", href: first ? link(current, first.id) : "#" + current, "aria-label": `${label}: ${r.hay} elementos${r.faltan ? `, ${r.faltan} sin crear` : ""}` },
      el("b", { text: r.hay }), el("span", { text: label }),
      el("small", { class: r.faltan ? "warnline" : "", text: g === "diagramas" ? (r.faltan ? `${r.faltan} no aplican` : "todos generados") : r.faltan ? `${r.faltan} sin crear` : "al día" }));
  }));
}

/* ---------- navigation ---------- */
function nav(dd) {
  const q = query.trim().toLowerCase();
  const side = el("nav", { class: "panel docnav", "aria-label": "Documentos del proyecto" });
  let shown = 0;
  for (const [g, label] of GROUPS) {
    const items = dd.items[g].filter((i) => matches(i, q) && (!onlyGaps || i.estado !== "ok"));
    shown += items.length;
    if ((q || onlyGaps) && !items.length) continue;
    side.append(el("h3", {}, label, el("em", { text: items.length })));
    if (!items.length) { side.append(el("p", { class: "note", text: "Sin documentos todavía." })); continue; }
    side.append(el("ul", {}, items.map((i) => el("li", {}, el("a", { href: link(current, i.id), "aria-current": i.id === selected ? "true" : false },
      el("span", { class: "mark " + (i.estado === "ok" ? "ok" : i.estado === "falta" ? "no" : "opt"), "aria-hidden": "true", text: i.estado === "ok" ? "✓" : i.estado === "falta" ? "✗" : "!" }),
      el("span", { class: "nm" }, el("b", { text: i.titulo }), el("small", { class: "mono", text: i.ruta })),
      el("span", { class: "sr", text: ` — ${STATE[i.estado][2]}` }))))));
  }
  if ((q || onlyGaps) && !shown) side.append(el("p", { class: "note", text: "Nada coincide con el filtro." }));
  return side;
}

/* ---------- reader: file documents ---------- */
function meta(item) {
  const rows = [["Ruta", el("span", { class: "mono", text: item.ruta })]];
  if (item.bytes != null) rows.push(["Tamaño", fmtBytes(item.bytes)]);
  if (item.modificado) rows.push(["Modificado", fmtDate(item.modificado)]);
  if (item.hash) rows.push(["Huella (SHA-256)", el("span", { class: "mono", text: item.hash + "…" })]);
  if (item.fase) rows.push(["Fase", PHASE_INFO[item.fase] ? PHASE_INFO[item.fase][0] : item.fase]);
  if (item.disciplina) rows.push(["Disciplina", `${item.disciplina} · ${item.nombre}`]);
  return el("dl", { class: "meta" }, rows.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", {}, v)]));
}
function actions(item) {
  const note = el("span", { class: "note", role: "status" });
  const buttons = [el("button", { class: "chip", type: "button", onclick: async () => {
    try { await navigator.clipboard.writeText(item.ruta); note.textContent = "Ruta copiada"; } catch { note.textContent = item.ruta; }
  } }, "Copiar ruta")];
  const blob = item.texto != null ? [item.texto, "text/plain"] : item.svg ? [item.svg, "image/svg+xml"] : null;
  if (blob) buttons.push(el("button", { class: "chip", type: "button", onclick: () => {
    const a = el("a", { href: URL.createObjectURL(new Blob([blob[0]], { type: blob[1] })), download: item.ruta.split("/").pop() });
    document.body.append(a); a.click(); a.remove();
  } }, "Descargar"));
  return el("div", { class: "actions" }, buttons, note);
}
function bodyText(item, dd) {
  const isMd = /\.md$/i.test(item.ruta);
  const tasks = isMd ? taskCount(item.texto) : { total: 0 };
  const wrap = el("div", {});
  if (isMd) {
    wrap.append(el("div", { class: "filters" },
      ["vista", "texto"].map((v) => el("button", { class: "chip", type: "button", "aria-pressed": String(mdView === v), onclick: () => { mdView = v; refresh(); } }, v === "vista" ? "Vista" : "Texto original")),
      tasks.total ? el("span", { class: "st " + (tasks.done === tasks.total ? "good" : "info") }, el("i", { "aria-hidden": "true", text: tasks.done === tasks.total ? "✓" : "…" }), `${tasks.done} de ${tasks.total} tareas hechas`) : null));
  }
  if (item.recortado) wrap.append(el("p", { class: "note", text: "El archivo es largo: se muestran los primeros 60 000 caracteres." }));
  wrap.append(isMd && mdView === "vista" ? el("article", { class: "panel" }, mdToDom(item.texto, { linkFor: (href) => { const t = resolveRelative(dd, item.ruta, href); return t ? link(current, t) : null; } }))
    : el("pre", { class: "panel rawtext" }, el("code", { text: item.texto })));
  return wrap;
}

/* ---------- reader: documents evol computes ---------- */
function bodyGap(item) {
  const special = {
    "evidencia:aprobaciones": ["Todavía no hay aprobaciones.", "Cada una la registra una persona con evol approve <fase>; firma el hash de los artefactos de la fase."],
    "evidencia:cobertura": ["El SPEC no declara criterios con la convención CA-n.", "Escríbelos como «CA-1: …», etiqueta los escenarios con @CA-1 y nombra las pruebas con CA-1 para que evol coverage los cruce."],
    "informe:estado": ["El informe todavía no se ha generado.", "Ejecuta evol report: deja el DOCX y el PDF en informe/ con los 14 diagramas."],
  }[item.id];
  return el("div", { class: "panel empty-big" }, el("h3", { text: special ? special[0] : "Este documento todavía no existe" }),
    special ? el("p", { text: special[1] }) : [
      el("dl", { class: "meta" }, el("dt", { text: "Lo exige" }), el("dd", { text: `${item.disciplina} · ${item.nombre}` }), el("dt", { text: "Archivo esperado" }),
        el("dd", { class: "mono", text: item.ruta }), el("dt", { text: "Encontrados" }), el("dd", { text: `${item.encontrados} de ${item.esperados}` })),
      el("p", {}, "Créalo con ese nombre dentro de la carpeta del módulo y completa lo marcado con ", el("code", { text: "[[COMPLETAR]]" }), ". Con evol status verás que la disciplina lo da por cumplido.")]);
}
function bodyApprovals(item) {
  const integ = item.integridad;
  const chip = integ === "no-integro" ? ["critical", "×", "Registro no íntegro"] : integ === "no-verificable" ? ["warning", "!", "No verificable en este equipo"] : ["good", "✓", "Registro íntegro (firmado y encadenado)"];
  return el("div", { class: "panel" }, el("p", {}, el("span", { class: "st " + chip[0] }, el("i", { text: chip[1] }), chip[2])),
    el("table", {}, el("thead", {}, el("tr", {}, ["#", "Fase", "Aprobó", "Cuándo", "Archivos firmados", "Huella"].map((h, i) => el("th", { class: i === 0 || i === 4 ? "num" : "", text: h })))),
      el("tbody", {}, item.aprobaciones.map((a) => el("tr", {}, el("td", { class: "num", text: a.seq }), el("td", { text: PHASE_INFO[a.fase][0] }), el("td", { text: a.aprobador }), el("td", { text: fmtDate(a.fecha) }), el("td", { class: "num", text: a.artefactos }), el("td", { class: "mono", text: a.hash }))))),
    el("p", { class: "note", style: "margin-top:10px", text: "Cada aprobación firma el hash de los artefactos de la fase y de evol.config.json. Si alguno cambia después, deja de valer." }));
}
function bodyVerification(item, dd) {
  const cur = item.faseActual === "done" ? 99 : PHASES.indexOf(item.faseActual);
  return el("div", {}, item.fases.map((f, idx) => {
    const state = idx < cur ? ["good", "✓", "hecha"] : idx === cur ? ["info", "→", "actual"] : ["muted", "○", "pendiente"];
    return el("div", { class: "panel", style: "margin-bottom:12px" },
      el("h2", {}, PHASE_INFO[f.phase][0], " ", el("span", { class: "st " + state[0] }, el("i", { text: state[1] }), state[2])),
      f.disciplines.length ? f.disciplines.map((d) => el("div", { style: "margin-bottom:10px" },
        el("b", { text: d.id }), " ", el("span", { class: "note", text: d.nombre }),
        el("ul", { class: "check" }, d.artefactos.map((a) => {
          const ok = a.archivos.length >= a.min;
          return el("li", {}, el("span", { class: "mark " + (ok ? "ok" : "no"), "aria-hidden": "true", text: ok ? "✓" : "✗" }),
            el("span", {}, el("span", { class: "mono", text: a.patron }), el("br"),
              a.archivos.length ? a.archivos.map((r) => { const t = allItems(dd).find((i) => i.ruta === r); return t ? el("a", { class: "pill", href: link(current, t.id) }, r) : el("span", { class: "pill", text: r }); })
                : el("span", { class: "note", text: `faltan archivos (hay 0, se esperan ${a.min})` })));
        })))) : el("p", { class: "note", text: "Ninguna disciplina activa en esta fase." }));
  }));
}
function bodyJournal(item) {
  const EV = { "project-created": "Proyecto creado", "project-adopted": "Proyecto adoptado", approved: "Fase aprobada", "phase-completed": "Fase completada" };
  return el("div", { class: "panel" }, el("table", {}, el("thead", {}, el("tr", {}, ["Cuándo", "Qué pasó"].map((h) => el("th", { text: h })))),
    el("tbody", {}, [...item.eventos].reverse().map((d) => el("tr", {}, el("td", { text: fmtDate(d.ts) }), el("td", { text: (EV[d.tipo] || d.tipo) + (d.fase ? ` · ${PHASE_INFO[d.fase][0]}` : "") }))))));
}
function bodyTests(item) {
  const groups = new Map();
  for (const t of item.pruebas) { const dir = t.ruta.split("/").slice(0, -1).join("/") || "."; groups.set(dir, [...(groups.get(dir) || []), t]); }
  return el("div", { class: "panel" }, el("table", {}, el("thead", {}, el("tr", {}, ["Carpeta", "Archivos", "Ejemplos"].map((h, i) => el("th", { class: i === 1 ? "num" : "", text: h })))),
    el("tbody", {}, [...groups].map(([dir, ts]) => el("tr", {}, el("td", { class: "mono", text: dir }), el("td", { class: "num", text: ts.length }), el("td", { class: "mono", text: ts.slice(0, 3).map((t) => t.ruta.split("/").pop()).join(", ") + (ts.length > 3 ? " …" : "") }))))));
}
function bodyCoverage(item) {
  const c = item.cobertura;
  if (!c.criterios.length) return bodyGap(item);
  return el("div", {}, el("div", { class: "panel" }, el("table", {}, el("thead", {}, el("tr", {}, ["Criterio", "Texto", "Escenarios", "Pruebas"].map((h, i) => el("th", { class: i > 1 ? "num" : "", text: h })))),
    el("tbody", {}, c.criterios.map((k) => el("tr", {}, el("td", { class: "mono", text: k.id }), el("td", { text: k.texto }),
      el("td", { class: "num", title: k.escenarios.map((e) => e.nombre).join("\n") }, el("span", { class: "mark " + (k.escenarios.length ? "ok" : "no"), text: k.escenarios.length ? k.escenarios.length : "✗" })),
      el("td", { class: "num", title: k.pruebas.map((e) => e.nombre).join("\n") }, el("span", { class: "mark " + (k.pruebas.length ? "ok" : "no"), text: k.pruebas.length ? k.pruebas.length : "✗" })))))),
    c.huerfanos.length ? el("p", { class: "note", text: "Referencias a criterios que el SPEC no define: " + c.huerfanos.join(", ") }) : null));
}
function bodyRisk(item) {
  const r = item.riesgo;
  if (!r.disponible) return el("div", { class: "panel empty-big" }, el("h3", { text: "El mapa de riesgo no está disponible" }), el("p", { text: r.motivo }));
  if (!r.archivos.length) return el("div", { class: "panel empty-big" }, el("h3", { text: "No hay código TypeScript indexado" }), el("p", { text: "El mapa de riesgo se calcula sobre el índice de código nativo (TypeScript y JavaScript)." }));
  const max = Math.max(...r.archivos.map((f) => f.riesgo), 1);
  return el("div", { class: "panel" },
    el("p", { class: "note", text: `Riesgo = archivos que dependen de él (transitivamente) × la parte de sus funciones y clases sin prueba. Primeros ${r.archivos.length} de ${r.total}.` }),
    el("table", {}, el("thead", {}, el("tr", {}, ["Archivo", "Riesgo", "Alcance", "Con prueba"].map((h, i) => el("th", { class: i ? "num" : "", text: h })))),
      el("tbody", {}, r.archivos.map((f) => el("tr", {}, el("td", { class: "mono", text: f.archivo }),
        el("td", { class: "num" }, el("span", { class: "riskbar", role: "img", "aria-label": `riesgo ${f.riesgo}` }, el("i", { style: `width:${Math.max(3, (f.riesgo / max) * 100)}%;background:${heat(f.riesgo / max)}` }), el("b", { text: f.riesgo }))),
        el("td", { class: "num", text: f.alcance }), el("td", { class: "num", text: `${f.cubiertas}/${f.unidades}` }))))));
}
function bodyGaps(item) {
  if (!item.problemas.length) return el("div", { class: "panel empty-big" }, el("h3", { text: "Nada bloquea la fase actual" }), el("p", { text: "Todas las disciplinas activas cumplen lo que piden. Si una persona revisa y está de acuerdo: evol approve." }));
  return el("div", { class: "panel" }, el("ul", { class: "check" }, item.problemas.map((q) => el("li", {}, el("span", { class: "mark no", "aria-hidden": "true", text: "!" }),
    el("span", {}, el("b", { text: q.disciplina + " " }), el("span", { class: "note", text: q.modulo }), el("br"), q.mensaje)))),
    el("p", { class: "note", text: "Resuelve lo marcado y vuelve a mirar con evol status." }));
}
function svgNode(svg) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
  for (const bad of doc.querySelectorAll("script, foreignObject")) bad.remove();
  for (const n of doc.querySelectorAll("*")) for (const a of [...n.attributes]) if (/^on/i.test(a.name)) n.removeAttribute(a.name);
  return document.importNode(doc, true);
}
function bodyDiagram(item) {
  const node = svgNode(item.svg);
  const baseW = Number(node.getAttribute("width")) || 800;
  const apply = () => { node.setAttribute("width", Math.round(baseW * zoom)); node.removeAttribute("height"); node.style.height = "auto"; };
  apply();
  const zbtn = (label, fn, title) => el("button", { class: "chip", type: "button", title, "aria-label": title, onclick: () => { fn(); apply(); zoomLabel.textContent = Math.round(zoom * 100) + " %"; } }, label);
  const zoomLabel = el("span", { class: "note", text: Math.round(zoom * 100) + " %" });
  return el("div", {},
    el("div", { class: "filters" }, zbtn("−", () => (zoom = Math.max(0.25, zoom - 0.25)), "Alejar"), zbtn("+", () => (zoom = Math.min(3, zoom + 0.25)), "Acercar"),
      zbtn("Original", () => (zoom = 1), "Tamaño original"), zoomLabel),
    el("div", { class: "svgwrap", tabindex: 0, role: "group", "aria-label": item.titulo }, node),
    el("p", { class: "note" }, el("b", { text: "Fuente de datos: " }), item.fuente),
    item.nota ? el("p", { class: "note" }, el("b", { text: "Nota: " }), item.nota) : null,
    el("p", { class: "note" }, "Se regenera con ", el("code", { text: `evol diagrams --solo ${item.id.split(":")[1]}` }), "."));
}
function bodyReport(item) {
  if (!item.archivos.length) return bodyGap(item);
  return el("div", { class: "panel" }, el("ul", { class: "check" }, item.archivos.map((a) => el("li", {}, el("span", { class: "mark ok", text: "✓" }), el("span", {}, el("span", { class: "mono", text: a.ruta }), " ", el("span", { class: "note", text: fmtBytes(a.bytes) }))))),
    el("p", { class: "note", text: "Se regenera con evol report; las cifras salen de los mismos datos que evol export." }));
}

function reader(item, dd) {
  const body = item.texto != null ? bodyText(item, dd)
    : item.estado === "falta" && item.aprobaciones === undefined && !item.cobertura && !item.archivos ? bodyGap(item)
    : item.aprobaciones ? (item.aprobaciones.length ? bodyApprovals(item) : bodyGap(item))
    : item.fases ? bodyVerification(item, dd) : item.eventos ? bodyJournal(item) : item.pruebas ? bodyTests(item)
    : item.cobertura ? bodyCoverage(item) : item.riesgo ? bodyRisk(item) : item.problemas ? bodyGaps(item)
    : item.svg ? bodyDiagram(item) : item.archivos ? bodyReport(item) : bodyGap(item);
  return el("section", { class: "reader", "aria-label": item.titulo },
    el("div", { class: "crumbs" }, el("a", { href: link(current) }, "Documentación"), " › ", GROUP_LABEL[item.grupo], " › ", item.titulo),
    el("h2", { class: "dtitle" }, item.titulo),
    el("div", { class: "chips" }, el("span", { class: "pill", text: item.tipo }), stateChip(item.estado)),
    item.bytes != null || item.disciplina ? meta(item) : el("dl", { class: "meta" }, el("dt", { text: "Origen" }), el("dd", { class: "mono", text: item.ruta })),
    item.texto != null || item.svg ? actions(item) : null,
    body);
}

/* ---------- reader: overview and search results ---------- */
function overview(p, dd) {
  const items = allItems(dd);
  const missing = items.filter((i) => i.estado === "falta" || i.estado === "pendiente");
  return el("div", {},
    el("div", { class: "grid2" },
      el("div", { class: "panel" }, el("h2", { text: "Lo que falta o está a medias" }),
        missing.length ? el("ul", { class: "check" }, missing.slice(0, 14).map((i) => el("li", {}, el("span", { class: "mark " + (i.estado === "falta" ? "no" : "opt"), "aria-hidden": "true", text: i.estado === "falta" ? "✗" : "!" }),
          el("span", {}, el("a", { href: link(current, i.id) }, i.titulo), " ", el("span", { class: "note", text: `· ${GROUP_LABEL[i.grupo]}${i.fase ? " · " + PHASE_INFO[i.fase][0] : ""}` }), el("br"), el("span", { class: "mono note", text: i.ruta })))))
          : el("p", { class: "note", text: "No falta nada: todo lo que el pipeline pide existe y está completo." }),
        missing.length > 14 ? el("p", { class: "note", text: `y ${missing.length - 14} más (usa «Solo lo que falta»)` }) : null),
      el("div", { class: "panel" }, el("h2", { text: "Documentos por fase" }),
        el("ul", { class: "check" }, PHASES.map((ph) => {
          const docs = items.filter((i) => i.fase === ph);
          const cur = p.estado.fase === ph;
          return el("li", {}, el("span", { class: "mark " + (docs.length && docs.every((d) => d.estado === "ok") ? "ok" : docs.length ? "opt" : "opt"), "aria-hidden": "true", text: docs.length && docs.every((d) => d.estado === "ok") ? "✓" : "–" }),
            el("span", {}, el("b", { text: PHASE_INFO[ph][0] }), cur ? el("span", { class: "note", text: " · fase actual" }) : null, el("br"),
              docs.length ? docs.map((d) => el("a", { class: "pill" + (d.estado === "falta" ? " gap" : ""), href: link(current, d.id), title: STATE[d.estado][2] }, d.ruta.split("/").pop())) : el("span", { class: "note", text: "sin documentos asociados" })));
        })))),
    el("div", { class: "panel", style: "margin-top:16px" }, el("h2", { text: "Diagramas" }),
      dd.items.diagramas.length ? el("div", { class: "gallery" }, dd.items.diagramas.map((d) => {
        const thumb = svgNode(d.svg);
        const wide = Number(thumb.getAttribute("width")) / Math.max(1, Number(thumb.getAttribute("height"))) > 2.2;
        thumb.removeAttribute("width"); thumb.removeAttribute("height");
        return el("a", { class: "thumb", style: wide ? "grid-column: span 2" : false, href: link(current, d.id), "aria-label": d.titulo }, el("div", { class: "frame" }, thumb), el("span", { text: d.titulo }));
      })) : el("p", { class: "note", text: "Este proyecto aún no tiene datos para generar diagramas." }),
      dd.noAplica.length ? el("details", { class: "tw" }, el("summary", { text: `${dd.noAplica.length} diagrama(s) no aplican` }),
        el("ul", { class: "check" }, dd.noAplica.map((n) => el("li", {}, el("span", { class: "mark opt", "aria-hidden": "true", text: "–" }), el("span", {}, el("b", { text: `${n.numero}. ${n.tipo}` }), el("br"), el("span", { class: "note", text: n.motivo })))))) : null));
}
function results(dd) {
  const q = query.trim().toLowerCase();
  const hits = allItems(dd).filter((i) => matches(i, q));
  return el("div", { class: "panel" }, el("h2", { text: `${hits.length} resultado(s) para «${query.trim()}»` }),
    hits.length ? el("ul", { class: "check" }, hits.map((i) => el("li", {}, el("span", { class: "mark opt", "aria-hidden": "true", text: "•" }),
      el("span", {}, el("a", { href: link(current, i.id) }, i.titulo), " ", el("span", { class: "note", text: `· ${GROUP_LABEL[i.grupo]}` }), el("br"), el("span", { class: "mono note", text: i.ruta }),
        snippet(i.texto, q).map((s) => el("div", { class: "snip", text: s })))))) : el("p", { class: "note", text: "Nada coincide. La búsqueda mira títulos, rutas y el texto de cada documento." }));
}

/* ---------- the sky: every document of the project as a star ---------- */
const GROUP_COLOR = { especificaciones: "#6da7ec", evidencias: "#4fd1a1", mejoras: "#f5a623", decisiones: "#c792ea", diagramas: "#ff7a59", informe: "#ffd866", general: "#9aa3b2" };
function docSky(dd) {
  const rand = seeded(current);
  const nodes = [], edges = [], clusters = [];
  const active = GROUPS.filter(([g]) => dd.items[g].length);
  active.forEach(([g, label], gi) => {
    const a = (gi / active.length) * Math.PI * 2 - Math.PI / 2, cx = 0.5 + 0.31 * Math.cos(a), cy = 0.5 + 0.34 * Math.sin(a);
    const cl = { id: g, label, x: cx, y: cy, color: GROUP_COLOR[g], dy: -0.09 };
    clusters.push(cl);
    let prev = null;
    dd.items[g].forEach((i, k) => {
      const ang = k * 2.39996 + rand() * 0.6, rad = 0.045 * Math.sqrt(k + 0.6) * (0.8 + rand() * 0.5);
      const missing = i.estado === "falta";
      nodes.push({
        id: i.id, label: i.titulo, grupo: g, hollow: missing, dim: i.estado === "pendiente",
        x: Math.min(0.96, Math.max(0.04, cx + Math.cos(ang) * rad * 1.3)), y: Math.min(0.94, Math.max(0.06, cy + Math.sin(ang) * rad)),
        r: missing ? 4 : 4.5 + 6 * Math.min(1, Math.log10(2 + (i.bytes || 4000)) / 5), color: GROUP_COLOR[g], labelAlways: false,
      });
      cl.dy = Math.min(cl.dy, -(Math.abs(nodes[nodes.length - 1].y - cy) + 0.06));
      if (prev) edges.push({ a: prev, b: i.id, kind: "grupo" });
      prev = i.id;
    });
  });
  const ids = new Set(nodes.map((n) => n.id));
  for (const i of allItems(dd)) {
    if (i.texto && /\.md$/i.test(i.ruta)) for (const m of i.texto.matchAll(/\]\(([^)\s]+)\)/g)) { const t = resolveRelative(dd, i.ruta, m[1]); if (t && t !== i.id && ids.has(t)) edges.push({ a: i.id, b: t }); }
    if (i.fases) for (const f of i.fases) for (const d of f.disciplines) for (const a of d.artefactos) for (const r of a.archivos) { const t = allItems(dd).find((x) => x.ruta === r); if (t && ids.has(t.id)) edges.push({ a: i.id, b: t.id }); }
  }
  return Constellation({
    nodes, edges, clusters, ariaLabel: `Constelación de la documentación de ${projectById(current).nombre}`,
    onSelect: (id) => { selected = id; if (location.hash !== "#" + link(current, id).slice(1)) history.replaceState(null, "", link(current, id)); },
    tooltip: (n) => { const i = itemById(dd, n.id); return [el("b", { text: n.label }), el("div", { class: "mono", text: i.ruta }), el("div", { text: GROUP_LABEL[i.grupo] + " · " + STATE[i.estado][2] })]; },
    renderCard: (n) => reader(itemById(dd, n.id), dd),
  });
}
function skyView(p, dd) {
  const hasCode = p.id === "evol-driven" && EVOL.code;
  if (sky) sky.destroy();
  sky = source === "codigo" && hasCode ? codeSky(EVOL.code, { mode: "calor", onSelect: (id) => { selected = null; } }) : docSky(dd);
  const legend = source === "codigo" ? el("p", { class: "note", text: "Cada estrella es un archivo de código; su tamaño y su color (azul poco, rojo mucho) son su alcance." })
    : el("div", { class: "legend", role: "group", "aria-label": "Leyenda: grupos de documentos" }, GROUPS.filter(([g]) => dd.items[g].length).map(([g, label]) =>
      el("span", { style: "display:inline-flex;gap:6px;align-items:center" }, el("span", { class: "sw", style: `background:${GROUP_COLOR[g]}` }), label)),
      el("span", { class: "note", text: "· estrella hueca = no existe · tenue = por completar" }));
  return el("div", {},
    hasCode ? el("div", { class: "filters" }, el("span", { class: "note", text: "Qué mostrar" }),
      [["documentos", "Documentos"], ["codigo", "Código (54 archivos)"]].map(([k, label]) => el("button", { class: "chip", type: "button", "aria-pressed": String(source === k), onclick: () => { source = k; selected = null; render(); } }, label))) : null,
    legend, sky.el);
}
function refresh() { if (view === "cielo" && sky) sky.refreshCard(); else render(true); }

/* ---------- render ---------- */
function render(keepFocus) {
  const p = projectById(current), dd = D[current];
  const item = selected && itemById(dd, selected);
  const q = query.trim();
  if (sky && view !== "cielo") { sky.destroy(); sky = null; }
  root.replaceChildren(header(p, dd), kpis(dd),
    el("div", { class: "filters" }, el("span", { class: "note", text: "Vista" }),
      [["cielo", "Constelación"], ["lista", "Lista"]].map(([k, label]) => el("button", { class: "chip", type: "button", "aria-pressed": String(view === k), onclick: () => { view = k; storeSet("evol-docs-view", k); render(); } }, label))),
    view === "cielo" ? skyView(p, dd)
      : el("div", { class: "docs-layout" }, nav(dd), el("div", { class: "docs-main" }, item ? reader(item, dd) : q ? results(dd) : overview(p, dd))),
    el("p", { class: "foot", text: "Documentación leída de los archivos reales de cada proyecto; las trazabilidades, el riesgo y los diagramas los calcula evol. Un documento que no existe se marca como tal: no se inventa." }));
  if (view === "cielo" && source === "documentos" && item) queueMicrotask(() => sky.select(item.id, true));
  if (keepFocus) { const s = root.querySelector("input[type=search]"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
}
window.addEventListener("hashchange", () => {
  const [pid, ...rest] = hashParts();
  const id = decodeURIComponent(pid || "");
  const sameProject = id === current;
  if (projectById(id)) current = id;
  selected = rest.length ? decodeURIComponent(rest.join("/")) : null;
  zoom = 1;
  if (view === "cielo" && sky && sameProject && source === "documentos") { selected ? sky.select(selected, true) : sky.reset(true); return; }
  render();
  if (selected) window.scrollTo({ top: 0 });
});
render();
