shell("proyecto");
const P = EVOL.portfolio;
let current = (location.hash || "").slice(1);
if (!projectById(current)) current = "tienda-online";
let tab = "resumen";

const root = el("main", {}); document.body.append(root);
const EVENT = { "project-created": "Proyecto creado", "project-adopted": "Proyecto adoptado", approved: "Fase aprobada", "phase-completed": "Fase completada" };
const idx = (ph) => PHASES.indexOf(ph);

function approvalOf(p, ph) { return [...p.aprobaciones].reverse().find((a) => a.fase === ph); }
function stepState(p, ph) {
  const e = p.estado;
  if (e.adoptadas.includes(ph)) return ["adopted", "Adoptada (hecha antes de evol)"];
  if (e.completadas.includes(ph)) { const a = approvalOf(p, ph); return ["done", a ? `Aprobada · ${fmtDate(a.fecha)}` : "Completada"]; }
  if (e.fase === ph) return ["now", "Fase actual"];
  return ["", "Pendiente"];
}
function header(p) {
  const b = badge(p);
  return el("div", {},
    el("div", { class: "filters" },
      el("label", { for: "sel", class: "note", text: "Proyecto" }),
      el("select", { id: "sel", class: "sel", onchange: (e) => { current = e.target.value; location.hash = current; render(); } },
        P.map((x) => el("option", { value: x.id, selected: x.id === p.id }, `${x.nombre} — ${PHASE_INFO[x.estado.fase][0]}`)))),
    el("h1", { text: p.nombre }),
    el("p", { class: "lede" }, p.carpeta + " · ", p.modulos.length === 1 ? "1 módulo" : `${p.modulos.length} módulos (${p.modulos.map((m) => m.nombre).join(", ")})`, " · ", statusChip(b), " ", el("a", { class: "chip", href: "documentacion.html#" + p.id }, "Ver documentación")),
    el("div", { class: "stepper", role: "list" }, PHASES.map((ph) => { const [cls, txt] = stepState(p, ph);
      return el("div", { class: "step " + cls, role: "listitem" }, el("b", { text: PHASE_INFO[ph][0] }), el("small", { text: txt })); })));
}

function resumen(p) {
  const e = p.estado, pr = progress(p);
  const left = el("div", { class: "panel" }, el("h2", { text: e.fase === "done" ? "Pipeline terminado" : `Fase actual: ${PHASE_INFO[e.fase][0]} — qué falta` }));
  if (e.fase === "done") left.append(el("p", { class: "note", text: "Las seis fases tienen aprobación humana registrada." }));
  else {
    if (!e.disciplinas.length) left.append(el("p", { class: "note", text: "Ninguna disciplina activa en esta fase." }));
    for (const d of e.disciplinas) {
      left.append(el("div", { style: "margin-bottom:12px" },
        el("div", { style: "font-weight:600" }, `${d.id} `, el("span", { class: "note", text: `${d.nombre}${p.modulos.length > 1 ? " · módulo " + d.module : ""}` })),
        el("ul", { class: "check" }, d.artefactos.map((a) => { const ok = a.encontrados >= a.min && a.pendientes === 0; const opt = a.min === 0 && a.encontrados === 0;
          return el("li", {}, el("span", { class: "mark " + (ok ? "ok" : opt ? "opt" : "no"), "aria-hidden": "true", text: ok ? "✓" : opt ? "–" : "✗" }),
            el("span", {}, el("span", { class: "mono", text: a.patron }), el("br"), el("span", { class: "note", text: (ok ? "cumple" : opt ? "opcional, no existe" : a.encontrados < a.min ? `faltan archivos (hay ${a.encontrados}, se esperan ${a.min})` : `${a.pendientes} archivo(s) con [[COMPLETAR]]`) }))); }))));
    }
    if (p.problemas.length) left.append(el("h2", { style: "margin-top:16px", text: "Lo que bloquea la aprobación" }),
      el("ul", { class: "check" }, p.problemas.map((q) => el("li", {}, el("span", { class: "mark no", "aria-hidden": "true", text: "!" }), el("span", {}, el("b", { text: `${q.disciplina} `}), q.mensaje)))));
    const next = p.problemas.length ? "Resuelve lo marcado y vuelve a mirar con evol status." : e.aprobacion.state === "vigente" ? "La aprobación está vigente: ejecuta evol next." : `Revisa los artefactos y, si todo está bien, una persona ejecuta evol approve ${e.fase} y luego evol next.`;
    left.append(el("p", { class: "note", style: "margin-top:14px" }, el("b", { text: "Siguiente paso: " }), next));
  }
  const right = el("div", {},
    el("div", { class: "tiles", style: "grid-template-columns:repeat(2,1fr)" },
      el("div", { class: "tile" }, el("b", { text: pr.total ? `${pr.ok}/${pr.total}` : "—" }), el("span", { text: "Disciplinas que cumplen" }), el("small", { text: "en la fase actual" })),
      el("div", { class: "tile" }, el("b", { text: p.aprobaciones.length }), el("span", { text: "Aprobaciones" }), el("small", { text: "firmadas por personas" })),
      el("div", { class: "tile" }, el("b", { text: p.lecciones.length }), el("span", { text: "Lecciones" }), el("small", { text: "en lecciones.md" })),
      el("div", { class: "tile" }, el("b", { style: "font-size:20px", text: fmtDate(p.ultimaActividad) }), el("span", { text: "Última actividad" }))),
    el("div", { class: "panel" }, el("h2", { text: "Lecciones registradas" }),
      p.lecciones.length ? el("ul", { class: "check" }, p.lecciones.slice(0, 8).map((l) => el("li", {}, el("span", { class: "mark opt", "aria-hidden": "true", text: "•" }), el("span", { text: l }))))
        : el("p", { class: "note", text: "Todavía no hay lecciones. La fase retro exige al menos una." })));
  return el("div", { class: "grid2" }, left, right);
}

function disciplinas(p) {
  const e = p.estado, cur = e.fase === "done" ? 99 : idx(e.fase);
  const rows = new Map();
  for (const f of p.fases) for (const d of f.disciplines) rows.set(d.module + "/" + d.id, d);
  const cell = (d, ph) => {
    const has = p.fases[idx(ph)].disciplines.some((x) => x.module === d.module && x.id === d.id);
    if (!has) return el("td", { "aria-label": "no aplica", class: "note", text: "·" });
    if (e.adoptadas.includes(ph)) return el("td", { title: "Adoptada", "aria-label": "adoptada" }, el("span", { class: "mark opt", text: "~" }));
    if (idx(ph) < cur) return el("td", { "aria-label": "hecha" }, el("span", { class: "mark ok", text: "✓" }));
    if (idx(ph) === cur) { const live = e.disciplinas.find((x) => x.module === d.module && x.id === d.id); const ok = live && discOk(live);
      return el("td", { "aria-label": ok ? "cumple" : "falta" }, el("span", { class: "mark " + (ok ? "ok" : "no"), text: ok ? "✓" : "✗" })); }
    return el("td", { "aria-label": "pendiente", class: "note", text: "○" });
  };
  return el("div", { class: "panel" }, el("h2", { text: "En qué fase interviene cada disciplina" }),
    el("table", { class: "matrix" }, el("thead", {}, el("tr", {}, el("th", { text: "Disciplina" }), PHASES.map((ph) => el("th", { text: PHASE_INFO[ph][0] })))),
      el("tbody", {}, [...rows.values()].map((d) => el("tr", {}, el("td", {}, el("b", { text: d.id }), " ", el("span", { class: "note", text: d.nombre + (p.modulos.length > 1 ? " · " + d.module : "") })), PHASES.map((ph) => cell(d, ph)))))),
    el("p", { class: "note", style: "margin-top:10px", text: "✓ hecha · ✗ falta algo en la fase actual · ○ pendiente · ~ adoptada · · no interviene" }));
}

function aprobaciones(p) {
  const integ = p.estado.aprobacion.state;
  const note = integ === "no-integro" ? el("span", { class: "st critical" }, el("i", { text: "×" }), "Registro no íntegro")
    : integ === "no-verificable" ? el("span", { class: "st warning" }, el("i", { text: "!" }), "No verificable en este equipo")
    : el("span", { class: "st good" }, el("i", { text: "✓" }), "Registro íntegro (firmado y encadenado)");
  return el("div", { class: "panel" }, el("h2", { text: "Aprobaciones humanas" }), el("p", {}, note),
    p.aprobaciones.length ? el("table", {}, el("thead", {}, el("tr", {}, ["#", "Fase", "Aprobó", "Cuándo", "Archivos firmados", "Huella"].map((h, i) => el("th", { class: i === 0 || i === 4 ? "num" : "", text: h })))),
      el("tbody", {}, p.aprobaciones.map((a) => el("tr", {}, el("td", { class: "num", text: a.seq }), el("td", { text: PHASE_INFO[a.fase][0] }), el("td", { text: a.aprobador }), el("td", { text: fmtDate(a.fecha) }), el("td", { class: "num", text: a.artefactos }), el("td", { class: "mono", text: a.hash })))))
      : el("div", { class: "empty-state", text: p.estado.adoptadas.length ? "Las fases anteriores se adoptaron sin aprobación: no hay nada que firmar todavía." : "Aún no hay aprobaciones. Cada una la registra una persona con evol approve." }));
}

function actividad(p) {
  return el("div", { class: "panel" }, el("h2", { text: "Actividad" }),
    el("table", {}, el("thead", {}, el("tr", {}, ["Cuándo", "Qué pasó"].map((h) => el("th", { text: h })))),
      el("tbody", {}, [...p.diario].reverse().map((d) => el("tr", {}, el("td", { text: fmtDate(d.ts) }), el("td", { text: (EVENT[d.tipo] || d.tipo) + (d.fase ? ` · ${PHASE_INFO[d.fase][0]}` : "") }))))));
}

const TABS = [["resumen", "Resumen", resumen], ["disciplinas", "Disciplinas", disciplinas], ["aprobaciones", "Aprobaciones", aprobaciones], ["actividad", "Actividad", actividad]];
function render() {
  const p = projectById(current);
  root.replaceChildren(header(p),
    el("div", { class: "tabs", role: "tablist" }, TABS.map(([id, label]) => el("button", { role: "tab", type: "button", "aria-selected": String(tab === id), onclick: () => { tab = id; render(); } }, label))),
    TABS.find((t) => t[0] === tab)[2](p));
}
window.addEventListener("hashchange", () => { const id = location.hash.slice(1); if (projectById(id)) { current = id; render(); } });
render();
