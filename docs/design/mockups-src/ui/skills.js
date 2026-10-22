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

/* ---------- state (in the URL as #biblioteca/<id>, #instaladas/<id> or #agentes) ---------- */
const parts = () => (location.hash || "").slice(1).split("/");
const TABS_OK = ["biblioteca", "agentes", "instaladas"];
let tab = TABS_OK.includes(parts()[0]) ? parts()[0] : "biblioteca";
let selected = parts()[1] ? decodeURIComponent(parts()[1]) : null;
let query = "", group = "todas", onlyNew = false, onlyIssues = false, detailTab = "revision";
let actionOpen = null;

const root = el("main", {});
const replaceKids = (node, ...kids) => node.replaceChildren(...kids.filter((k) => k != null && k !== false));
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
        ? el("span", { class: "note", text: s.enBiblioteca ? "En la biblioteca" : `Pendiente de auditar${agentsOf(s).length ? " · ya en " + agentsOf(s).map(agentLabel).join(", ") : ""}` })
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
      el("p", { class: "note", text: `Esta página no copia skills. Pídele al agente auditor (${AUD.agente}) que la revise: la pasa por cuarentena, la audita y solo si el veredicto es favorable la deja en ${FUENTE.biblioteca.dir}/${s.carpeta}.` }),
      cmdBox(`evol skills audit ${s.lugares[0].ruta}${s.grupo ? ` --grupo ${s.grupo}` : ""}`, "Lanza al agente auditor. Escribe el informe en la cuarentena y te pide confirmar el veredicto antes de agregarla."),
      el("button", { class: "chip", type: "button", onclick: () => auditDialogEl.showModal() }, "Ver qué comprueba el agente")),
    quitar: () => el("div", { class: "actionpanel" }, cmdBox(`evol skills remove ${s.nombre}`, "Solo quita la copia de la biblioteca. Pide confirmación y no toca los proyectos que ya la usan.")),
  };
  const btn = (key, label, enabled = true, title) => el("button", { class: "chip", type: "button", disabled: !enabled, title, "aria-pressed": String(actionOpen === key || (actionOpen || "").startsWith(key + ":")), onclick: open(key) }, label);
  const status = el("span", { class: "note", role: "status" });
  return el("div", {},
    el("div", { class: "actions" },
      el("button", { class: "chip primary", type: "button", onclick: () => { s.texto != null ? download(`${s.carpeta}-SKILL.md`, skillMd(s), "text/markdown") : download(`${s.carpeta}.json`, JSON.stringify({ nombre: s.nombre, descripcion: s.descripcion, huella: s.huella, archivos: s.archivos, lugares: s.lugares }, null, 2), "application/json"); } }, "Descargar"),
      s.propia && !s.enBiblioteca ? btn("importar", "Pedir auditoría al agente") : null,
      btn("proyecto", "Usar en un proyecto…", s.propia, s.propia ? "" : "Primero añádela a la biblioteca"),
      btn("agente", "Instalar en un agente…", s.propia, s.propia ? "" : "Primero añádela a la biblioteca"),
      !s.propia ? btn("importar", "Pedir auditoría para añadirla") : null,
      el("button", { class: "chip", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(trigger); status.textContent = `«${trigger}» copiado`; } catch { status.textContent = trigger; } } }, "Copiar invocación"),
      s.enBiblioteca ? btn("quitar", "Quitar") : null, status),
    actionOpen ? (panel[actionOpen.split(":")[0]] ? panel[actionOpen.split(":")[0]]() : null) : null,
    el("p", { class: "note maqueta", text: "Maqueta: las acciones muestran el comando que ejecutaría evol; no escriben nada. Agregar una skill a la biblioteca solo lo hace el agente auditor." }));
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
      s.enBiblioteca ? chip("good", "✓", "En la biblioteca") : s.propia ? chip("info", "↓", "Pendiente de auditar") : chip("muted", "–", "Solo en tus agentes"), healthChip(s), s.nueva ? chip("info", "★", "Nueva") : null),
    el("p", { text: s.descripcion || "Sin descripción." }),
    s.disciplina ? el("div", { class: "disc" }, el("b", { text: "Implementa la disciplina " }), el("span", { class: "mono", text: s.disciplina.id }), ` (${s.disciplina.nombre}, ${s.disciplina.tipo}) · fases: ${s.disciplina.fases.join(", ")}`) : null,
    s.triggers.length ? el("p", { class: "note" }, "Se invoca con: ", s.triggers.slice(0, 5).map((t) => el("span", { class: "pill mono", text: t }))) : null,
    actions(s),
    el("div", { class: "tabs", role: "tablist" }, TABS.map(([id, label]) => el("button", { role: "tab", type: "button", "aria-selected": String(detailTab === id), onclick: () => { detailTab = id; render(); } }, label))),
    detailTab === "revision" ? tabRevision(s) : detailTab === "skill" ? tabSkillMd(s) : detailTab === "archivos" ? tabFiles(s) : tabWhere(s));
}

/* ---------- how a skill gets in: only through the auditing agent ---------- */
const AUD = SK.auditoria;
let auditDialogEl = null;
function auditBody() {
  return el("div", {},
    el("p", { class: "note", text: "La página es de solo lectura para las skills: no tiene botones para crear, subir ni importar. Una skill son instrucciones y scripts que otros agentes obedecen, así que entra únicamente por un agente que la audite." }),
    el("h3", { class: "h3", text: "Cómo entra una skill" }),
    el("ol", { class: "audit-steps" }, AUD.etapas.map(([id, nombre, texto]) => el("li", {}, el("b", { text: nombre + ". " }), texto))),
    el("h3", { class: "h3", text: "Qué comprueba el agente" }),
    el("table", {}, el("tbody", {}, AUD.comprobaciones.map(([k, v]) => el("tr", {}, el("td", { style: "width:170px" }, el("b", { text: k })), el("td", { text: v }))))),
    el("h3", { class: "h3", text: "Pedirlo" }),
    cmdBox("evol skills audit ./mi-skill   # carpeta, .zip o enlace", "Lanza al agente. También sirve decirle a Claude Code: «audita y agrega la skill ./mi-skill a la biblioteca de evol»."),
    el("p", { class: "note", text: `Una skill que alguien copie a mano a ${FUENTE.biblioteca.dir} sin pasar por la auditoría aparece marcada «Sin auditar» y no se puede instalar en agentes ni usar en proyectos.` }));
}
function auditDialog() {
  const dlg = el("dialog", { class: "dlg", "aria-labelledby": "da" });
  dlg.append(el("div", { class: "dlg-head" }, el("h2", { id: "da", text: "Agregar una skill" }), el("button", { class: "chip", type: "button", onclick: () => dlg.close() }, "Cerrar")), auditBody(),
    el("div", { class: "actions" }, el("button", { class: "chip", type: "button", onclick: () => dlg.close() }, "Cerrar")));
  return dlg;
}

/* ---------- the agents themselves ---------- */
const IDE_CELL = { si: ["good", "✓"], parcial: ["info", "◐"], verificar: ["warning", "?"] };
const PHASE_NAMES = { briefing: "Briefing", spec: "Especificación", plan: "Plan", build: "Construcción", qa: "Calidad", retro: "Retrospectiva" };
function orchestratorView() {
  const o = SK.orquestador;
  return el("section", { class: "panel orchestrator" },
    el("h2", {}, el("span", { class: "mono", text: o.id }), " ", el("span", { class: "note", text: "el orquestador" })),
    el("div", { class: "chips" }, chip("info", "★", "Primer agente de evol-driven"), chip("muted", "–", o.estado), chip("good", "✓", "Funciona en cualquier IDE")),
    el("p", { text: o.resumen }),
    el("h3", { class: "h3", text: "Cómo trabaja" }),
    el("ol", { class: "audit-steps" }, o.pasos.map(([k, v]) => el("li", {}, el("b", { text: k + ". " }), v))),
    el("div", { class: "grid2" },
      el("div", {}, el("h3", { class: "h3", text: "Cómo reparte" }), el("ul", { class: "check" }, o.patrones.map(([k, v]) => el("li", {}, el("span", { class: "mark ok", "aria-hidden": "true", text: "•" }), el("span", {}, el("b", { text: k + ". " }), v))))),
      el("div", {}, el("h3", { class: "h3", text: "Skills de razonamiento en puntos fijos" }), el("ul", { class: "check" }, o.razonamiento.map(([k, v]) => el("li", {}, el("span", { class: "mark ok", "aria-hidden": "true", text: "•" }), el("span", {}, el("b", { text: k + ". " }), v)))))),
    el("div", { class: "grid2", style: "margin-top:12px" },
      el("div", {}, el("h3", { class: "h3", text: "Qué hace" }), el("ul", { class: "check" }, o.hace.map((t) => el("li", {}, el("span", { class: "mark ok", "aria-hidden": "true", text: "✓" }), el("span", { text: t }))))),
      el("div", {}, el("h3", { class: "h3", text: "Qué no hace" }), el("ul", { class: "check" }, o.noHace.map((t) => el("li", {}, el("span", { class: "mark no", "aria-hidden": "true", text: "✗" }), el("span", { text: t })))))));
}
function rolesView() {
  return el("section", {},
    el("h2", { class: "h3", style: "margin-top:24px", text: `Subagentes: un rol por fase (${SK.roles.length})` }),
    el("p", { class: "note", text: "Cada rol aplica las skills de las disciplinas de su fase. Es una propuesta: los roles y sus nombres se pueden cambiar." }),
    el("div", { class: "cards wide" }, SK.roles.map((r) => el("article", { class: "panel agent role", "data-fase": r.fase },
      el("h2", {}, el("span", { class: "mono", text: r.rol }), " ", el("span", { class: "note", text: PHASE_NAMES[r.fase] })),
      el("div", { class: "chips" }, chip("muted", "–", "por crear"), chip("info", "•", `${r.disciplinas.length} ${r.disciplinas.length === 1 ? "disciplina" : "disciplinas"}`)),
      el("p", {}, r.disciplinas.map((d) => el("span", { class: "pill mono" + (d.tipo === "base" ? "" : " dim"), title: d.tipo, text: d.id })))))));
}
function idesView() {
  const cols = [["instrucciones", "Instrucciones"], ["skills", "Skills"], ["mcp", "MCP"], ["entrada", "Entrada /evol"], ["subagentes", "Subagentes"], ["bloqueo", "Bloquear evol approve"]];
  const cell = (v) => el("td", {}, el("span", { class: "st " + IDE_CELL[v[0]][0], title: v[0] === "si" ? "Confirmado" : v[0] === "parcial" ? "Funciona, con límites" : "Por verificar en la documentación oficial" }, el("i", { "aria-hidden": "true", text: IDE_CELL[v[0]][1] }), el("small", { text: v[1] })));
  return el("section", {},
    el("h2", { class: "h3", style: "margin-top:24px", text: `Compatibilidad con IDE (${SK.ides.length})` }),
    el("p", { class: "note", text: "La primera entrega cubre los cinco que usas: Claude Code (en terminal y en VS Code, con la misma configuración), Codex, Antigravity, OpenCode y Hermes. Los demás esperan, pero el diseño no cambia. evol-driven no depende de un IDE: se apoya en tres capas que todos comparten (AGENTS.md, carpetas SKILL.md y la CLI de evol, con su MCP como apoyo opcional) y en un adaptador fino por IDE que expone /evol. Donde un IDE no tiene subagentes, /evol ejecuta los roles uno tras otro en la misma sesión. ✓ = confirmado por la propia herramienta, ◐ = funciona con límites, ? = por confirmar en su documentación oficial antes de construirlo." }),
    el("div", { class: "panel", style: "overflow:auto" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", { text: "IDE" }), cols.map(([, l]) => el("th", { text: l })))),
      el("tbody", {}, SK.ides.map((i) => el("tr", { class: "ide-row" + (i.entrega === "primera" ? " first" : "") }, el("td", {}, el("b", { text: i.label }), i.entrega === "primera" ? el("div", {}, chip("info", "★", "Primera entrega")) : el("div", { class: "note", text: "después" })), cols.map(([k]) => cell(i[k]))))))));
}
function agentsView() {
  const need = SK.agentes.length;
  return el("div", {},
    orchestratorView(), rolesView(), idesView(),
    el("h2", { class: "h3", style: "margin-top:24px", text: `Dónde se instalan las skills (${need})` }),
    el("p", { class: "note", text: "Las herramientas que usan las skills en este equipo. Cada una lee las suyas de su carpeta; las de la biblioteca evol llegan a ellas solo por enlace, una vez auditadas." }),
    el("div", { class: "cards" }, SK.agentes.map((a) => el("a", { class: "panel agent", href: href("instaladas"), onclick: () => { group = a.id; } },
      el("h2", { text: a.label }),
      el("p", { class: "mono note", text: a.dir }),
      el("div", { class: "chips" }, a.existe ? chip("good", "✓", "Instalado") : chip("muted", "–", "No encontrado"),
        a.conAvisos ? chip("warning", "!", `${a.conAvisos} con avisos`) : chip("good", "✓", "Sin avisos")),
      el("dl", { class: "meta" },
        [["Skills que ve", a.total], ["De la biblioteca evol", a.deLaBiblioteca], ["Propias del agente", a.ajenas], ["Enlazadas (symlink)", a.enlazadas]].flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: String(v) })]))))),
    el("section", { class: "panel auditor" },
      el("h2", { text: "Agente auditor" }),
      el("p", {}, el("span", { class: "mono", text: AUD.agente }), " · por crear"),
      el("p", { text: "Será el único que propone agregar skills a la biblioteca. Es efímero: vive durante la auditoría y se retira dejando sus lecciones. Trabaja en cuarentena, audita y emite un veredicto; solo una persona la agrega." }),
      el("div", { class: "chips" }, chip("info", "★", "Única vía de entrada"), chip("muted", "–", `${AUD.comprobaciones.length} comprobaciones`)),
      auditBody()),
    el("p", { class: "note", text: `${need} agentes detectados. Para sumar otro, evol lo reconoce al aparecer su carpeta de skills.` }));
}

/* ---------- page ---------- */
function libraryEmpty() {
  const ds = SK.disciplinas, bases = ds.filter((d) => d.tipo === "base"), ext = ds.filter((d) => d.tipo !== "base");
  const star = (d) => el("div", { class: "disc-cell", title: `${d.nombre} · fases: ${d.fases.join(", ")}` }, el("b", { class: "mono", text: d.id }), el("small", { text: d.nombre }), el("span", { class: "st muted" }, el("i", { "aria-hidden": "true", text: "–" }), "Sin skill"));
  return el("div", {},
    el("div", { class: "tiles" },
      el("div", { class: "tile" }, el("b", { text: "0" }), el("span", { text: "Skills de evol" }), el("small", { text: "la biblioteca está vacía" })),
      el("div", { class: "tile" }, el("b", { text: `0/${ds.length}` }), el("span", { text: "Disciplinas con su skill" }), el("small", { text: "todas por crear" })),
      el("div", { class: "tile" }, el("b", { text: others.length }), el("span", { text: "Skills en tus agentes" }), el("small", { text: "no son de evol" }))),
    el("div", { class: "empty-state banner" }, el("b", { text: "Todavía no hay skills de evol-driven. " }),
      "Las skills y los agentes de evol se crean nuevos, sin nada del sistema anterior, y cada una entra a la biblioteca solo después de que un agente la audite. ",
      el("button", { class: "chip", type: "button", onclick: () => auditDialogEl.showModal() }, "Cómo se agrega una skill")),
    el("h2", { class: "h3", style: "margin-top:16px", text: `Lo que hay que construir: una skill por disciplina (${ds.length})` }),
    el("p", { class: "note", text: "Las 31 disciplinas son las de evol-driven (disciplines/*.json). Cada una necesita la skill que la aplica; una disciplina sin skill se marca." }),
    el("details", { open: true, class: "skill-group" }, el("summary", {}, el("b", { text: "Base" }), el("span", { class: "count", text: bases.length })), el("div", { class: "disc-grid" }, bases.map(star))),
    el("details", { open: true, class: "skill-group" }, el("summary", {}, el("b", { text: "Extendidas" }), el("span", { class: "count", text: ext.length })), el("div", { class: "disc-grid" }, ext.map(star))));
}
function render() {
  const pend = library.filter((s) => !s.enBiblioteca).length;
  const newCount = library.filter((s) => s.nueva).length;
  const withIssues = library.filter((s) => issues(s).length).length;
  const discOk = new Set(library.filter((s) => s.disciplina).map((s) => s.disciplina.id)).size;
  const base = tab === "biblioteca" ? library : others;
  auditDialogEl = auditDialog();
  replaceKids(root,
    el("h1", { text: "Skills" }),
    el("p", { class: "lede", text: "Las capacidades reutilizables de evol y los agentes que las usan. Una skill solo entra a la biblioteca después de que un agente la audite." }),
    el("div", { class: "filters" },
      el("button", { class: "chip primary", type: "button", onclick: () => auditDialogEl.showModal() }, "¿Cómo se agrega una skill?"),
      el("span", { class: "note", text: `Biblioteca: ${FUENTE.biblioteca.dir} · solo la modifica el agente auditor` })),
    el("div", { class: "tabs", role: "tablist" },
      [["biblioteca", `Biblioteca evol (${library.length})`], ["agentes", `Agentes (${SK.agentes.length})`], ["instaladas", `Skills de tus agentes (${others.length})`]].map(([id, label]) =>
        el("button", { role: "tab", type: "button", "aria-selected": String(tab === id), onclick: () => { tab = id; selected = null; group = "todas"; location.hash = href(id); render(); } }, label))),
    tab === "biblioteca" && !library.length ? libraryEmpty() : tab === "biblioteca" ? el("div", {},
      el("div", { class: "tiles" },
        el("div", { class: "tile" }, el("b", { text: library.length }), el("span", { text: "Skills de evol" }), el("small", { text: `${library.length - pend} en la biblioteca · ${pend} por importar` })),
        el("div", { class: "tile" }, el("b", { text: `${discOk}/${SK.disciplinas.length}` }), el("span", { text: "Disciplinas con su skill" }), el("small", { text: "cada una tiene quien la aplique" })),
        el("div", { class: "tile" }, el("b", { text: newCount }), el("span", { text: `Nuevas (${SK.diasNueva} días)` })),
        el("div", { class: "tile" }, el("b", { text: withIssues }), el("span", { text: "Con avisos o errores" }), el("small", { text: "para corregir antes de usarlas" }))),
      pend ? el("div", { class: "empty-state banner" }, el("b", { text: `La biblioteca está ${pend === library.length ? "vacía" : "incompleta"}. ` }),
        `Hay ${pend} skills sin auditar, así que ningún proyecto puede usarlas desde evol. `, el("button", { class: "chip", type: "button", onclick: () => auditDialogEl.showModal() }, "Cómo se auditan")) : null)
      : tab === "instaladas" ? el("p", { class: "note", text: "Solo lectura: son las instaladas en otros agentes. Si alguna te sirve, pide al agente auditor que la revise antes de añadirla a la biblioteca." }) : null,
    tab === "agentes" ? agentsView() : tab === "biblioteca" && !library.length ? null : el("div", { class: "filters" },
      el("input", { class: "search", type: "search", placeholder: "Buscar por nombre, descripción, trigger o disciplina…", "aria-label": "Buscar skills", value: query, oninput: (e) => { query = e.target.value; render(); document.querySelector("input[type=search]").focus(); } }),
      tab === "biblioteca"
        ? (SK.grupos.length ? el("select", { class: "sel", "aria-label": "Grupo", onchange: (e) => { group = e.target.value; render(); } }, el("option", { value: "todas", text: "Todos los grupos" }), SK.grupos.map((g) => el("option", { value: g.id, selected: group === g.id }, `${g.nombre} (${library.filter((s) => s.grupo === g.id).length})`))) : null)
        : el("select", { class: "sel", "aria-label": "Fuente", onchange: (e) => { group = e.target.value; render(); } }, el("option", { value: "todas", text: "Todos los agentes" }), SK.fuentes.filter((f) => others.some((o) => o.fuente === f.id)).map((f) => el("option", { value: f.id, selected: group === f.id }, `${f.label} (${others.filter((o) => o.fuente === f.id).length})`))),
      el("button", { class: "chip", type: "button", "aria-pressed": String(onlyNew), onclick: () => { onlyNew = !onlyNew; render(); } }, "Solo nuevas"),
      el("button", { class: "chip", type: "button", "aria-pressed": String(onlyIssues), onclick: () => { onlyIssues = !onlyIssues; render(); } }, "Con avisos"),
      el("span", { class: "note", role: "status", text: `${visible(base).length} de ${base.length}` })),
    tab === "agentes" ? null : el("div", { class: "skills-layout" }, listing(), el("div", { class: "skills-side" }, detail())),
    el("p", { class: "foot", text: "Datos reales de este equipo: la biblioteca de evol (vacía) y las skills instaladas en tus agentes. El texto de las de terceros no se incluye; en evol ui se lee del disco." }),
    auditDialogEl);
}
window.addEventListener("hashchange", () => {
  const [t, id] = parts();
  tab = TABS_OK.includes(t) ? t : "biblioteca";
  selected = id ? decodeURIComponent(id) : null;
  actionOpen = null; detailTab = "revision";
  render();
});
render();
