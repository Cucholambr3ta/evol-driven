shell("tablero");
const state = { q: "", filter: "todos", mods: false, table: false };
const P = EVOL.portfolio;

const root = el("main", {},
  el("h1", { text: "Tablero de proyectos" }),
  el("p", { class: "lede", text: "En qué fase del pipeline va cada proyecto y qué le falta. Las fases avanzan solo con una aprobación humana (evol approve y evol next), por eso las tarjetas no se arrastran." }),
  el("div", { id: "tiles", class: "tiles" }),
  el("div", { class: "filters", role: "group", "aria-label": "Filtros del tablero" }),
  el("div", { id: "view" }),
  el("p", { class: "foot", text: "Cada tarjeta lee el estado real de un proyecto: fase, disciplinas, aprobaciones y problemas. Con las pruebas de cada proyecto sin ejecutar (el panel solo lee)." }));
document.body.append(root);

function tiles() {
  const b = P.map(badge);
  const t = [
    [P.length, "Proyectos", "en el tablero"],
    [b.filter((x) => x.text === "Listo para aprobar").length, "Listos para aprobar", "esperan a una persona"],
    [b.filter((x) => x.tone === "serious").length, "Bloqueados", "con problemas por resolver"],
    [b.filter((x) => x.text === "Terminado").length, "Terminados", "las 6 fases aprobadas"],
  ];
  document.getElementById("tiles").replaceChildren(...t.map(([n, l, s]) => el("div", { class: "tile" }, el("b", { text: n }), el("span", { text: l }), el("small", { text: s }))));
}

function filters() {
  const bar = root.querySelector(".filters");
  const chip = (key, label) => el("button", { class: "chip", type: "button", "aria-pressed": String(state.filter === key), onclick: () => { state.filter = key; filters(); view(); } }, label);
  bar.replaceChildren(
    el("input", { class: "search", type: "search", placeholder: "Buscar proyecto…", "aria-label": "Buscar proyecto", value: state.q, oninput: (e) => { state.q = e.target.value.toLowerCase(); view(); } }),
    chip("todos", "Todos"), chip("listos", "Listos para aprobar"), chip("bloqueados", "Bloqueados"),
    el("span", { class: "spacer" }),
    el("button", { class: "chip", type: "button", "aria-pressed": String(state.mods), onclick: () => { state.mods = !state.mods; filters(); view(); } }, "Mostrar módulos"),
    el("button", { class: "chip", type: "button", "aria-pressed": String(state.table), onclick: () => { state.table = !state.table; filters(); view(); } }, "Ver como tabla"));
  const input = bar.querySelector("input"); if (document.activeElement === document.body) input.blur();
}

function visible(p) {
  const b = badge(p);
  if (state.q && !(p.nombre + " " + p.id).toLowerCase().includes(state.q)) return false;
  if (state.filter === "listos") return b.text === "Listo para aprobar";
  if (state.filter === "bloqueados") return b.tone === "serious";
  return true;
}

function moduleChips(p) {
  const e = p.estado;
  if (p.modulos.length < 2 && !state.mods) return null;
  return el("div", { class: "mods" }, p.modulos.map((m) => {
    const ds = e.disciplinas.filter((d) => d.module === m.nombre);
    const ok = ds.filter(discOk).length;
    return el("span", { title: `Módulo ${m.nombre}: ${ok} de ${ds.length} disciplinas cumplen en esta fase` }, `${m.nombre} ${ds.length ? `${ok}/${ds.length}` : "·"}`);
  }));
}

function card(p) {
  const b = badge(p), pr = progress(p), first = p.problemas[0];
  return el("a", { class: "card", href: `proyecto.html#${p.id}`, "aria-label": `${p.nombre}, fase ${PHASE_INFO[p.estado.fase][0]}, ${b.text}` },
    el("h4", { text: p.nombre }),
    el("div", { class: "sub", text: p.carpeta + (p.estado.adoptadas.length ? " · adoptado a mitad del pipeline" : "") }),
    statusChip(b),
    stepsBar(p),
    pr.total ? el("div", {}, el("div", { class: "meter", role: "img", "aria-label": `${pr.ok} de ${pr.total} disciplinas cumplen` }, el("b", { style: `width:${Math.round((pr.ok / pr.total) * 100)}%` })),
      el("div", { class: "sub", style: "margin:4px 0 0", text: `Disciplinas de esta fase: ${pr.ok}/${pr.total}` })) : null,
    moduleChips(p),
    first ? el("p", { class: "problem", text: first.mensaje.length > 90 ? first.mensaje.slice(0, 88) + "…" : first.mensaje }) : null,
    el("div", { class: "meta" }, el("span", { text: fmtDate(p.ultimaActividad) }), el("span", { text: `${p.aprobaciones.length} aprob.` })));
}

function board() {
  const cols = [...PHASES, "done"];
  return el("div", { class: "board" }, cols.map((ph) => {
    const items = P.filter((p) => p.estado.fase === ph && visible(p)).sort((a, b) => (b.ultimaActividad || "").localeCompare(a.ultimaActividad || ""));
    return el("section", { class: "col", "aria-label": PHASE_INFO[ph][0] },
      el("h3", {}, PHASE_INFO[ph][0], el("em", { text: items.length })),
      el("p", { text: PHASE_INFO[ph][1] }),
      items.length ? items.map(card) : el("div", { class: "empty", text: "Sin proyectos" }));
  }));
}

function table() {
  const rows = P.filter(visible);
  return el("div", { class: "panel" }, el("table", {},
    el("thead", {}, el("tr", {}, ["Proyecto", "Fase", "Estado", "Disciplinas", "Problemas", "Aprobaciones", "Última actividad"].map((h, i) => el("th", { class: i >= 3 && i <= 5 ? "num" : "", text: h })))),
    el("tbody", {}, rows.map((p) => { const b = badge(p), pr = progress(p);
      return el("tr", {}, el("td", {}, el("a", { href: `proyecto.html#${p.id}`, text: p.nombre })), el("td", { text: PHASE_INFO[p.estado.fase][0] }), el("td", {}, statusChip(b)),
        el("td", { class: "num", text: pr.total ? `${pr.ok}/${pr.total}` : "—" }), el("td", { class: "num", text: p.problemas.length }), el("td", { class: "num", text: p.aprobaciones.length }), el("td", { text: fmtDate(p.ultimaActividad) })); }))));
}

function view() { document.getElementById("view").replaceChildren(state.table ? table() : board()); }
tiles(); filters(); view();
