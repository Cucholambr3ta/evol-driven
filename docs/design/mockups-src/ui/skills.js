shell("skills");
const SK = window.EVOL_SKILLS;
const BYID = new Map(SK.skills.map((s) => [s.id, s]));
const FUENTE = Object.fromEntries(SK.fuentes.map((f) => [f.id, f]));
const GRUPO = Object.fromEntries(SK.grupos.map((g) => [g.id, g]));
const LEVEL = { ok: ["good", "✓"], aviso: ["warning", "!"], error: ["critical", "×"] };

const library = SK.skills.filter((s) => s.propia);
const others = SK.skills.filter((s) => !s.propia);
const issues = (s) => s.revision.filter((c) => c.nivel !== "ok");
const worst = (s) => (s.revision.some((c) => c.nivel === "error") ? "error" : s.revision.some((c) => c.nivel === "aviso") ? "aviso" : "ok");
const agentsOf = (s) => [...new Set(s.lugares.map((l) => l.agente).filter(Boolean))];
const agentLabel = (id) => (SK.agentes.find((a) => a.id === id) || { label: id }).label;

/* ---------- state (in the URL as #biblioteca/<id> or #agentes/<id>) ---------- */
const parts = () => (location.hash || "").slice(1).split("/");
let tab = parts()[0] === "agentes" ? "agentes" : "biblioteca";
let selected = parts()[1] ? decodeURIComponent(parts()[1]) : null;
let query = "", group = "todas", onlyNew = false, onlyIssues = false, detailTab = "revision";
let actionOpen = null;

const root = el("main", {});
document.body.append(root);
const href = (t, id) => `#${t}${id ? "/" + encodeURIComponent(id) : ""}`;

function chip(tone, icon, text, title) { return el("span", { class: "st " + tone, title }, el("i", { "aria-hidden": "true", text: icon }), text); }
function healthChip(s) {
  const n = issues(s).length, w = worst(s);
  return w === "ok" ? chip("good", "✓", "Sin problemas") : chip(LEVEL[w][0], LEVEL[w][1], `${n} ${n === 1 ? (w === "error" ? "error" : "aviso") : w === "error" ? "con problemas" : "avisos"}`);
}
function cmdBox(cmd, note) {
  const status = el("span", { class: "note", role: "status" });
  return el("div", { class: "cmdbox" }, el("code", { text: cmd }),
    el("button", { class: "chip", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(cmd); status.textContent = "Copiado"; } catch { status.textContent = "Selecciónalo y cópialo"; } } }, "Copiar"),
    status, note ? el("p", { class: "note", text: note }) : null);
}
function download(name, text, type) {
  const a = el("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
}
function skillMd(s) {
  const front = { ...s.frontmatter };
  const lines = [`name: ${JSON.stringify(s.nombre)}`, `description: ${JSON.stringify(s.descripcion)}`, ...Object.entries(front).filter(([k]) => k !== "description").map(([k, v]) => `${k}: ${JSON.stringify(v)}`)];
  return `---\n${lines.join("\n")}\n---\n${s.texto}`;
}

/* ---------- filtering ---------- */
function visible(list) {
  const q = query.trim().toLowerCase();
  return list.filter((s) => (group === "todas" || s.grupo === group || s.fuente === group)
    && (!onlyNew || s.nueva) && (!onlyIssues || issues(s).length > 0)
    && (!q || `${s.nombre} ${s.descripcion} ${s.triggers.join(" ")} ${s.disciplina ? s.disciplina.id : ""} ${GRUPO[s.grupo] ? GRUPO[s.grupo].nombre : ""}`.toLowerCase().includes(q)));
}

/* ---------- list ---------- */
function card(s) {
  const w = worst(s);
  return el("li", {}, el("a", { class: "skill", href: href(tab, s.id), "aria-current": s.id === selected ? "true" : false },
    el("div", { class: "skill-top" }, el("b", { class: "mono", text: s.nombre }),
      s.nueva ? el("span", { class: "tag new", text: "Nueva" }) : null,
      w !== "ok" ? el("span", { class: "tag " + (w === "error" ? "bad" : "warn"), title: issues(s).map((c) => c.texto).join("\n"), text: w === "error" ? "Con errores" : "Con avisos" }) : null),
    el("p", { class: "skill-desc", text: s.descripcion || "Sin descripción: el agente no sabrá cuándo usarla." }),
    el("div", { class: "skill-meta" },
      s.disciplina ? el("span", { class: "pill", title: s.disciplina.nombre }, `${s.disciplina.id} · ${s.disciplina.fases.length ? s.disciplina.fases[0] + (s.disciplina.fases.length > 1 ? "…" : "") : "—"}`) : null,
      s.triggers.slice(0, 2).map((t) => el("span", { class: "pill mono", text: t })),
      tab === "biblioteca"
        ? el("span", { class: "note", text: s.enBiblioteca ? "En la biblioteca" : `Pendiente de importar${agentsOf(s).length ? " · ya en " + agentsOf(s).map(agentLabel).join(", ") : ""}` })
        : el("span", { class: "note", text: s.lugares.map((l) => FUENTE[l.fuente].label).filter((v, i, a) => a.indexOf(v) === i).join(", ") }))));
}
function listing() {
  const base = tab === "biblioteca" ? library : others;
  const items = visible(base);
  const box = el("div", { class: "skill-list" });
  if (!items.length) return el("div", { class: "empty-state", text: "Ninguna skill coincide con el filtro." });
  const sections = tab === "biblioteca" ? SK.grupos.map((g) => [g.id, g.nombre, g.descripcion]) : SK.fuentes.filter((f) => others.some((o) => o.fuente === f.id)).map((f) => [f.id, f.label, f.dir]);
  for (const [id, name, desc] of sections) {
    let rows = items.filter((s) => (tab === "biblioteca" ? s.grupo : s.fuente) === id);
    if (!rows.length) continue;
    if (id === "disciplinas") rows = [...rows].sort((a, b) => (a.disciplina.tipo === b.disciplina.tipo ? a.nombre.localeCompare(b.nombre) : a.disciplina.tipo === "base" ? -1 : 1));
    box.append(el("details", { open: true, class: "skill-group" }, el("summary", {}, el("b", { text: name }), el("span", { class: "count", text: rows.length }), el("span", { class: "note", text: desc })),
      el("ul", {}, rows.map(card))));
  }
  return box;
}

/* ---------- detail ---------- */
function actions(s) {
  const open = (name) => () => { actionOpen = actionOpen === name ? null : name; render(); };
  const trigger = s.triggers[0] || `usa la skill ${s.nombre}`;
  const panel = {
    proyecto: () => {
      const pick = el("select", { class: "sel", "aria-label": "Proyecto", onchange: (e) => { actionOpen = "proyecto:" + e.target.value; render(); } },
        EVOL.portfolio.map((p) => el("option", { value: p.id, selected: actionOpen === "proyecto:" + p.id }, p.nombre)));
      const id = actionOpen.split(":")[1] || EVOL.portfolio[0].id;
      return el("div", { class: "actionpanel" }, el("label", { class: "note", text: "Proyecto " }), pick,
        cmdBox(`evol skills add ${s.nombre} --proyecto ${id}`, "Copia la skill a la carpeta del proyecto y la deja visible para los agentes que use. No toca nada más del proyecto."));
    },
    agente: () => el("div", { class: "actionpanel" }, el("p", { class: "note", text: "Enlaza la skill de la biblioteca en la carpeta del agente: se actualiza sola cuando la edites." }),
      SK.agentes.map((a) => el("div", {}, el("b", { text: a.label }), " ", el("span", { class: "note mono", text: a.dir }), cmdBox(`evol skills install ${s.nombre} --agente ${a.id}`)))),
    importar: () => el("div", { class: "actionpanel" },
      cmdBox(`evol skills import ${s.lugares[0].ruta}${s.grupo ? "" : " --grupo <grupo>"}`,
        s.grupo ? `La copia a ${FUENTE.biblioteca.dir}/${s.carpeta} y le aplica el grupo «${GRUPO[s.grupo].nombre}». Desde ese momento está disponible en cualquier proyecto o tarea.`
          : `La copia a ${FUENTE.biblioteca.dir}/${s.carpeta}. Elige su grupo con --grupo (${SK.grupos.map((g) => g.id).slice(0, 4).join(", ")}…); sin él queda en «Sin grupo». Desde ese momento está disponible en cualquier proyecto o tarea.`)),
    quitar: () => el("div", { class: "actionpanel" }, cmdBox(`evol skills remove ${s.nombre}`, "Solo quita la copia de la biblioteca. Pide confirmación y no toca los proyectos que ya la usan.")),
  };
  const btn = (key, label, enabled = true, title) => el("button", { class: "chip", type: "button", disabled: !enabled, title, "aria-pressed": String(actionOpen === key || (actionOpen || "").startsWith(key + ":")), onclick: open(key) }, label);
  const status = el("span", { class: "note", role: "status" });
  return el("div", {},
    el("div", { class: "actions" },
      el("button", { class: "chip primary", type: "button", onclick: () => { s.texto != null ? download(`${s.carpeta}-SKILL.md`, skillMd(s), "text/markdown") : download(`${s.carpeta}.json`, JSON.stringify({ nombre: s.nombre, descripcion: s.descripcion, huella: s.huella, archivos: s.archivos, lugares: s.lugares }, null, 2), "application/json"); } }, "Descargar"),
      s.propia && !s.enBiblioteca ? btn("importar", "Importar a la biblioteca") : null,
      btn("proyecto", "Usar en un proyecto…", s.propia, s.propia ? "" : "Primero añádela a la biblioteca"),
      btn("agente", "Instalar en un agente…", s.propia, s.propia ? "" : "Primero añádela a la biblioteca"),
      !s.propia ? btn("importar", "Añadir a la biblioteca evol") : null,
      el("button", { class: "chip", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(trigger); status.textContent = `«${trigger}» copiado`; } catch { status.textContent = trigger; } } }, "Copiar invocación"),
      s.enBiblioteca ? btn("quitar", "Quitar") : null, status),
    actionOpen ? (panel[actionOpen.split(":")[0]] ? panel[actionOpen.split(":")[0]]() : null) : null,
    el("p", { class: "note maqueta", text: "Maqueta: las acciones muestran el comando que ejecutaría evol; no escriben nada." }));
}
function tabRevision(s) {
  const flags = [];
  if (s.archivos.some((f) => /\.(sh|bash|py|js|mjs|ts)$/i.test(f.ruta))) flags.push("Incluye scripts que el agente puede ejecutar.");
  if (s.revision.some((c) => /red/.test(c.texto) && c.nivel === "aviso")) flags.push("Algún script accede a la red.");
  return el("div", {},
    el("ul", { class: "check" }, s.revision.map((c) => el("li", {}, el("span", { class: "mark " + (c.nivel === "ok" ? "ok" : c.nivel === "error" ? "no" : "opt"), "aria-hidden": "true", text: LEVEL[c.nivel][1] }), el("span", { text: c.texto })))),
    el("dl", { class: "meta", style: "margin-top:12px" },
      [["Huella (SHA-256)", s.huella + "…"], ["Tamaño", `${s.archivos.length} archivo(s) · ${s.bytes < 1024 ? s.bytes + " B" : (s.bytes / 1024).toFixed(1) + " KB"}`], ["Modificada", fmtDate(s.modificado)],
        s.origen ? ["Origen", s.origen] : null, s.licencia ? ["Licencia", s.licencia] : null, s.version ? ["Versión", s.version] : null,
        s.categoriaOriginal && GRUPO[s.grupo] && s.categoriaOriginal !== s.grupo ? ["Categoría anterior", `${s.categoriaOriginal} → ahora «${GRUPO[s.grupo].nombre}»`] : null,
        s.compatible.length ? ["Compatible con", s.compatible.join(", ")] : null].filter(Boolean).flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { class: k.startsWith("Huella") ? "mono" : "", text: v })])));
}
function tabSkillMd(s) {
  const fm = Object.entries(s.frontmatter);
  return el("div", {},
    el("h3", { class: "h3", text: "Frontmatter" }),
    el("table", {}, el("tbody", {}, [["name", s.nombre], ["description", s.descripcion || "—"], ...fm.map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)])].map(([k, v]) => el("tr", {}, el("td", { class: "mono", style: "width:150px", text: k }), el("td", { text: v }))))),
    s.texto != null
      ? [el("h3", { class: "h3", text: "Instrucciones" }), s.cuerpoCompleto === false ? el("p", { class: "note", text: "Se muestran los primeros 8 000 caracteres." }) : null, el("article", { class: "panel" }, mdToDom(s.texto, {}))]
      : el("div", { class: "empty-state", style: "margin-top:12px", text: "El texto de esta skill es de terceros y no va en la maqueta; en evol ui se lee del disco." }));
}
function tabFiles(s) {
  return el("div", {}, el("table", {}, el("thead", {}, el("tr", {}, el("th", { text: "Archivo" }), el("th", { class: "num", text: "Tamaño" }))),
    el("tbody", {}, s.archivos.map((f) => el("tr", {}, el("td", { class: "mono", text: f.ruta }), el("td", { class: "num", text: f.bytes < 1024 ? f.bytes + " B" : (f.bytes / 1024).toFixed(1) + " KB" }))))),
    el("p", { class: "note", style: "margin-top:8px", text: "Se descarga todo este contenido junto: una skill es una carpeta, no un solo archivo." }));
}
function tabWhere(s) {
  const agents = new Set(agentsOf(s));
  return el("div", {},
    el("h3", { class: "h3", text: "Agentes" }),
    el("table", {}, el("tbody", {}, SK.agentes.map((a) => el("tr", {}, el("td", { text: a.label }), el("td", { class: "mono note", text: a.dir }),
      el("td", {}, agents.has(a.id) ? chip("good", "✓", "Disponible") : chip("muted", "–", "No instalada")))))),
    el("h3", { class: "h3", text: "Proyectos" }),
    s.enBiblioteca ? el("p", { class: "note", text: "Está en la biblioteca: se puede usar en cualquier proyecto o tarea." })
      : s.propia ? el("p", { class: "note", text: "Todavía no está en la biblioteca, así que no hay proyecto que pueda usarla desde evol." }) : null,
    s.proyectos.length ? el("ul", { class: "check" }, s.proyectos.map((p) => el("li", {}, el("span", { class: "mark ok", text: "✓" }), el("span", {}, el("a", { href: "documentacion.html#" + p.proyecto }, p.proyecto), " ", el("span", { class: "mono note", text: p.ruta })))))
      : el("p", { class: "note", text: "Ningún proyecto de muestra la lleva copiada." }),
    el("h3", { class: "h3", text: "Ubicaciones en disco" }),
    el("table", {}, el("tbody", {}, s.lugares.map((l) => el("tr", {}, el("td", { text: FUENTE[l.fuente].label }), el("td", { class: "mono", text: l.ruta }), el("td", { class: "note", text: l.enlace ? "enlace simbólico" : "carpeta" }))))));
}
function detail() {
  const s = selected && BYID.get(selected);
  if (!s) return el("div", { class: "panel side-empty" }, el("h2", { text: tab === "biblioteca" ? "Elige una skill para revisarla" : "Skills de tus agentes" }),
    el("p", { class: "note", text: tab === "biblioteca"
      ? "Verás qué hace, si pasa las comprobaciones, qué archivos trae, dónde está disponible, y podrás descargarla o usarla en un proyecto."
      : "Son las que ya tienen instaladas Claude Code, Codex, Hermes y Omarchy. Si alguna te sirve, añádela a la biblioteca evol y quedará disponible en todos tus proyectos." }));
  const TABS = [["revision", "Revisión"], ["skill", "SKILL.md"], ["archivos", `Archivos (${s.archivos.length})`], ["donde", "Dónde está"]];
  return el("section", { class: "panel side", "aria-label": s.nombre },
    el("h2", { class: "mono dtitle", text: s.nombre }),
    el("div", { class: "chips" }, s.grupo ? el("span", { class: "pill", text: GRUPO[s.grupo].nombre }) : el("span", { class: "pill", text: FUENTE[s.fuente].label }),
      s.enBiblioteca ? chip("good", "✓", "En la biblioteca") : s.propia ? chip("info", "↓", "Pendiente de importar") : chip("muted", "–", "Solo en tus agentes"), healthChip(s), s.nueva ? chip("info", "★", "Nueva") : null),
    el("p", { text: s.descripcion || "Sin descripción." }),
    s.disciplina ? el("div", { class: "disc" }, el("b", { text: "Implementa la disciplina " }), el("span", { class: "mono", text: s.disciplina.id }), ` (${s.disciplina.nombre}, ${s.disciplina.tipo}) · fases: ${s.disciplina.fases.join(", ")}`) : null,
    s.triggers.length ? el("p", { class: "note" }, "Se invoca con: ", s.triggers.slice(0, 5).map((t) => el("span", { class: "pill mono", text: t }))) : null,
    actions(s),
    el("div", { class: "tabs", role: "tablist" }, TABS.map(([id, label]) => el("button", { role: "tab", type: "button", "aria-selected": String(detailTab === id), onclick: () => { detailTab = id; render(); } }, label))),
    detailTab === "revision" ? tabRevision(s) : detailTab === "skill" ? tabSkillMd(s) : detailTab === "archivos" ? tabFiles(s) : tabWhere(s));
}

/* ---------- dialogs: the two ways a skill gets in ---------- */
function newDialog() {
  const dlg = el("dialog", { class: "dlg", "aria-labelledby": "dn" });
  const name = el("input", { class: "search", id: "nn", placeholder: "nombre-en-minusculas", "aria-label": "Nombre", value: "mi-skill" });
  const desc = el("textarea", { class: "search", rows: 3, "aria-label": "Descripción", placeholder: "Qué hace y cuándo usarla (esto decide si el agente la elige)" }, "");
  const sel = el("select", { class: "sel", "aria-label": "Grupo" }, SK.grupos.map((g) => el("option", { value: g.id, text: g.nombre })));
  const out = el("div", {});
  const update = () => {
    const n = name.value.trim() || "mi-skill";
    out.replaceChildren(el("p", { class: "note", text: `Se crea ${FUENTE.biblioteca.dir}/${n}/SKILL.md con esta plantilla y aparece aquí sola:` }),
      el("pre", { class: "rawtext" }, el("code", { text: `---\nname: ${n}\ndescription: ${JSON.stringify(desc.value.trim() || "Qué hace y cuándo usarla.")}\ncategory: ${sel.value}\ntriggers:\n  - /${n}\n---\n\n# ${n}\n\n## Cuándo usarla\n\n## Pasos\n` })),
      cmdBox(`evol skills new ${n} --grupo ${sel.value}`));
  };
  for (const c of [name, desc, sel]) c.addEventListener("input", update);
  update();
  dlg.append(el("h2", { id: "dn", text: "Nueva skill" }),
    el("div", { class: "form" }, el("label", { for: "nn", text: "Nombre" }), name, el("label", { text: "Descripción" }), desc, el("label", { text: "Grupo" }), sel), out,
    el("div", { class: "actions" }, el("button", { class: "chip", type: "button", onclick: () => dlg.close() }, "Cerrar")));
  return dlg;
}
function importDialog() {
  const dlg = el("dialog", { class: "dlg", "aria-labelledby": "di" });
  const pending = library.filter((s) => !s.enBiblioteca).length;
  dlg.append(el("h2", { id: "di", text: "Importar skills" }),
    el("p", { class: "note", text: "Hay tres maneras. En todas, la skill aparece en esta pantalla en cuanto está en la biblioteca." }),
    el("h3", { class: "h3", text: `1. Las ${pending} del legado (evol-system)` }), cmdBox(`evol skills import ~/Projects/evol-system/skills`, "Las copia a la biblioteca, las reparte en grupos y ata las 31 de disciplinas a su disciplina. Las 7 con el frontmatter roto se importan marcadas para corregir."),
    el("h3", { class: "h3", text: "2. Una carpeta o un archivo .zip" }), cmdBox("evol skills import ./mi-skill   # o  evol skills import mi-skill.zip"),
    el("h3", { class: "h3", text: "3. Soltarla en la carpeta de la biblioteca" }), cmdBox(`cp -r mi-skill ${FUENTE.biblioteca.dir}/`, "No hace falta ningún comando de evol: el panel la detecta sola y la revisa."),
    el("div", { class: "actions" }, el("button", { class: "chip", type: "button", onclick: () => dlg.close() }, "Cerrar")));
  return dlg;
}

/* ---------- page ---------- */
function render() {
  const pend = library.filter((s) => !s.enBiblioteca).length;
  const newCount = library.filter((s) => s.nueva).length;
  const withIssues = library.filter((s) => issues(s).length).length;
  const discOk = new Set(library.filter((s) => s.disciplina).map((s) => s.disciplina.id)).size;
  const base = tab === "biblioteca" ? library : others;
  const dlgNew = newDialog(), dlgImport = importDialog();
  root.replaceChildren(
    el("h1", { text: "Skills" }),
    el("p", { class: "lede", text: "Las capacidades reutilizables de evol. Todo lo que se agrega a la biblioteca aparece aquí y queda disponible para cualquier proyecto o tarea." }),
    el("div", { class: "filters" },
      el("button", { class: "chip primary", type: "button", onclick: () => dlgNew.showModal() }, "Nueva skill"),
      el("button", { class: "chip", type: "button", onclick: () => dlgImport.showModal() }, "Importar…"),
      el("span", { class: "note", text: `Biblioteca: ${FUENTE.biblioteca.dir} · se vigila sola` })),
    el("div", { class: "tabs", role: "tablist" },
      [["biblioteca", `Biblioteca evol (${library.length})`], ["agentes", `En tus agentes (${others.length})`]].map(([id, label]) =>
        el("button", { role: "tab", type: "button", "aria-selected": String(tab === id), onclick: () => { tab = id; selected = null; group = "todas"; location.hash = href(id); render(); } }, label))),
    tab === "biblioteca" ? el("div", {},
      el("div", { class: "tiles" },
        el("div", { class: "tile" }, el("b", { text: library.length }), el("span", { text: "Skills de evol" }), el("small", { text: `${library.length - pend} en la biblioteca · ${pend} por importar` })),
        el("div", { class: "tile" }, el("b", { text: `${discOk}/${SK.totalDisciplinas}` }), el("span", { text: "Disciplinas con su skill" }), el("small", { text: "cada una tiene quien la aplique" })),
        el("div", { class: "tile" }, el("b", { text: SK.grupos.length }), el("span", { text: "Grupos" }), el("small", { text: "antes 18 categorías sueltas" })),
        el("div", { class: "tile" }, el("b", { text: newCount }), el("span", { text: `Nuevas (${SK.diasNueva} días)` })),
        el("div", { class: "tile" }, el("b", { text: withIssues }), el("span", { text: "Con avisos o errores" }), el("small", { text: "para corregir antes de usarlas" }))),
      pend ? el("div", { class: "empty-state banner" }, el("b", { text: `La biblioteca está ${pend === library.length ? "vacía" : "incompleta"}. ` }),
        `Las ${pend} skills de evol-system todavía no están importadas, así que ningún proyecto puede usarlas desde evol. `, el("button", { class: "chip", type: "button", onclick: () => dlgImport.showModal() }, `Importar las ${pend}`)) : null)
      : el("p", { class: "note", text: "Solo lectura: son las instaladas en otros agentes. Añade a la biblioteca las que quieras usar en evol." }),
    el("div", { class: "filters" },
      el("input", { class: "search", type: "search", placeholder: "Buscar por nombre, descripción, trigger o disciplina…", "aria-label": "Buscar skills", value: query, oninput: (e) => { query = e.target.value; render(); document.querySelector("input[type=search]").focus(); } }),
      tab === "biblioteca"
        ? el("select", { class: "sel", "aria-label": "Grupo", onchange: (e) => { group = e.target.value; render(); } }, el("option", { value: "todas", text: "Todos los grupos" }), SK.grupos.map((g) => el("option", { value: g.id, selected: group === g.id }, `${g.nombre} (${library.filter((s) => s.grupo === g.id).length})`)))
        : el("select", { class: "sel", "aria-label": "Fuente", onchange: (e) => { group = e.target.value; render(); } }, el("option", { value: "todas", text: "Todos los agentes" }), SK.fuentes.filter((f) => others.some((o) => o.fuente === f.id)).map((f) => el("option", { value: f.id, selected: group === f.id }, `${f.label} (${others.filter((o) => o.fuente === f.id).length})`))),
      el("button", { class: "chip", type: "button", "aria-pressed": String(onlyNew), onclick: () => { onlyNew = !onlyNew; render(); } }, "Solo nuevas"),
      el("button", { class: "chip", type: "button", "aria-pressed": String(onlyIssues), onclick: () => { onlyIssues = !onlyIssues; render(); } }, "Con avisos"),
      el("span", { class: "note", role: "status", text: `${visible(base).length} de ${base.length}` })),
    el("div", { class: "skills-layout" }, listing(), el("div", { class: "skills-side" }, detail())),
    el("p", { class: "foot", text: "Datos reales de este equipo: la biblioteca de evol-system y las skills instaladas en tus agentes. El texto solo se incluye en las tuyas; el de terceros se lee del disco en evol ui." }),
    dlgNew, dlgImport);
}
window.addEventListener("hashchange", () => {
  const [t, id] = parts();
  tab = t === "agentes" ? "agentes" : "biblioteca";
  selected = id ? decodeURIComponent(id) : null;
  actionOpen = null; detailTab = "revision";
  render();
});
render();
