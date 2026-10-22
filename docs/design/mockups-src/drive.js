(function () {
  const log = [], fail = (m) => log.push("FALLA: " + m);
  window.addEventListener("error", (e) => fail("excepción " + e.message));
  const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const btn = (txt) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === txt);
  try {
    const page = location.pathname.split("/").pop();
    if (page.startsWith("index")) {
      click(btn("Ver como tabla")); if (!document.querySelector("table tbody tr")) fail("tabla vacía");
      click(btn("Ver como tabla")); click(btn("Bloqueados"));
      const n = document.querySelectorAll(".card").length; if (n !== 3) fail("bloqueados=" + n + " (esperaba 3)");
      click(btn("Listos para aprobar")); const l = document.querySelectorAll(".card").length; if (l !== 2) fail("listos=" + l + " (esperaba 2)");
      click(btn("Todos")); if (document.querySelectorAll(".card").length !== 6) fail("todos != 6");
      click(btn("Mostrar módulos")); log.push("tablero ok");
    }
    if (page.startsWith("proyecto")) {
      const sel = document.getElementById("sel");
      for (const o of [...sel.options]) { sel.value = o.value; sel.dispatchEvent(new Event("change")); for (const t of ["Resumen", "Disciplinas", "Aprobaciones", "Actividad"]) { click(btn(t)); if (!document.querySelector(".panel")) fail(o.value + "/" + t + " sin panel"); } }
      log.push("proyecto ok " + sel.options.length + " proyectos x 4 pestañas");
    }
    if (page.startsWith("grafos")) {
      click(btn("Proceso")); const gp = document.getElementById("gp"); { const n = document.querySelectorAll("svg.graph g[aria-label]").length; if (n < 40) fail("proceso con todas: pocos nodos " + n); const ids = new Set([...document.querySelectorAll("svg.graph g[aria-label]")].map((g) => (g.getAttribute("aria-label") || "").split(":")[0])); for (const need of ["SDD","TDD","A11yDD","UDD","CHAOS","SLO","PrivacyDD","MDD"]) if (!ids.has(need)) fail("falta " + need + " en el grafo"); }
      for (const o of [...gp.options]) { gp.value = o.value; gp.dispatchEvent(new Event("change")); for (const mode of ["activas", "todas"]) { const gs = document.getElementById("gs"); gs.value = mode; gs.dispatchEvent(new Event("change")); } const gf = document.getElementById("gf"); for (const f of [...gf.options]) { gf.value = f.value; gf.dispatchEvent(new Event("change")); if (!document.querySelector("svg.graph")) fail("proceso " + o.value + "/" + f.value); } }
      click(btn("Memoria")); if (!document.querySelector("svg.graph circle")) fail("memoria sin nodos");
      click(btn("Código"));
      if (typeof sky === "undefined" || !sky) fail("no hay constelación de código");
      else {
        const st = sky.state(); if (st.stars !== 54) fail("estrellas=" + st.stars + " (esperaba 54)");
        if (document.querySelector("svg.graph")) fail("el grafo de código debería ser una constelación, no un SVG");
        let abiertas = 0;
        for (const n of sky.__ids()) {
          sky.select(n, true); sky.step(2500); const s2 = sky.state();
          if (!s2.card || s2.selected !== n) { fail("no abre la estrella " + n); continue; }
          if (s2.zoom < 2.5) fail("no se acerca a " + n + " (zoom " + s2.zoom.toFixed(2) + ")");
          if (!document.querySelector(".sky-card .dtitle")) fail("la estrella " + n + " no despliega su ficha");
          abiertas++;
        }
        sky.reset(true); sky.step(2500); if (sky.state().card || sky.state().zoom > 1.2) fail("«Volver» no vuelve a la vista completa");
        // arrastrar una estrella con el puntero: se mueve y arrastra a las conectadas
        {
          const cv = document.querySelector("canvas.sky-canvas"), r = cv.getBoundingClientRect();
          const e = EVOL.code.aristas.find((x) => x.a !== x.b); const id = e.a, nb = e.b;
          const [sx, sy] = sky.__screen(id), p0 = sky.__pos(id), q0 = sky.__pos(nb);
          const fire = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.left + x, clientY: r.top + y }));
          fire("pointerdown", sx, sy);
          for (let i = 1; i <= 10; i++) { fire("pointermove", sx + i * 14, sy + i * 8); sky.step(120); }
          sky.step(1500); const p1 = sky.__pos(id), q1 = sky.__pos(nb);
          if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 40) fail("arrastrar una estrella no la mueve");
          if (Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) < 5) fail("las estrellas conectadas no siguen a la arrastrada");
          fire("pointerup", sx + 140, sy + 80);
          if (sky.state().card) fail("arrastrar una estrella no debería abrirla");
          sky.step(3000);
        }
        const q = document.querySelector("input[type=search]"); q.value = "paths"; q.dispatchEvent(new Event("input"));
        log.push("grafos ok (" + abiertas + " estrellas abiertas)");
      }
          }
    if (page.startsWith("skills")) {
      const wait = () => new Promise((r) => setTimeout(r, 0));
      const tabBtn = (t) => [...document.querySelectorAll("button[role=tab]")].find((b) => b.textContent.startsWith(t));
      (async () => {
        // 1. La biblioteca de evol está vacía y no arrastra nada del sistema anterior
        if (document.querySelectorAll("a.skill").length) fail("la biblioteca de evol debería estar vacía");
        const celdas = document.querySelectorAll(".disc-cell").length; if (celdas !== 31) fail("disciplinas sin skill = " + celdas + " (esperaba 31)");
        const fases = document.querySelectorAll(".fase-plan").length; if (fases !== 6) fail("fases del plan = " + fases + " (esperaba 6)");
        if (/\bx-?dd\b|evol-system|evol-dd\b/i.test(document.querySelector("main").textContent)) fail("la página menciona X-DD o el sistema evol anterior");
        if (/^null$/m.test(document.querySelector("main").textContent)) fail("sobra un «null» en la página");
        // 2. No se pueden agregar skills desde la página
        for (const prohibido of ["Nueva skill", "Importar…", "Importar a la biblioteca", "Añadir a la biblioteca evol"]) if (btn(prohibido)) fail("la página no debe permitir agregar skills: «" + prohibido + "»");
        if (document.querySelector("input[type=file]")) fail("la página no debe tener un selector de archivos");
        click(btn("¿Cómo se agrega una skill?")); await wait();
        const dlg = document.querySelector("dialog.dlg[open]"); if (!dlg) fail("«¿Cómo se agrega una skill?» no abre el diálogo");
        else { if (!dlg.textContent.includes("evol skills audit") || !dlg.querySelector("ol.audit-steps li")) fail("el diálogo no explica la auditoría"); dlg.close(); }
        // 3. Agentes
        click(tabBtn("Agentes")); await wait();
        const ags = document.querySelectorAll("a.agent").length; if (ags !== 4) fail("agentes = " + ags + " (esperaba 4)");
        if (document.querySelector(".evol-agent")) fail("no deben aparecer los agentes del sistema anterior");
        const orq = document.querySelector(".orchestrator"); if (!orq || !orq.textContent.includes("/evol") || orq.querySelectorAll("ol li").length !== 7) fail("falta el orquestador /evol con sus 7 pasos");
        const primeros = document.querySelectorAll(".ide-row.first").length; if (primeros !== 5) fail("IDE de la primera entrega = " + primeros + " (esperaba 5)");
        const roles = document.querySelectorAll(".role").length; if (roles !== 6) fail("roles = " + roles + " (esperaba 6)");
        const conEnv = [...document.querySelectorAll(".role")].filter((r) => r.textContent.includes("envoltorio de subagente")).map((r) => r.dataset.rol).sort().join(","); if (conEnv !== "seguridad,verificador") fail("envoltorios de subagente: " + conEnv + " (esperaba seguridad,verificador)");
        const ides = document.querySelectorAll(".ide-row").length; if (ides !== 9) fail("IDE = " + ides + " (esperaba 9)");
        for (const n of ["Claude Code", "Codex", "Antigravity", "Hermes", "Gemini CLI", "OpenCode", "Cursor"]) if (!document.querySelector("main").textContent.includes(n)) fail("falta el IDE " + n);
        if (!document.querySelector(".auditor") || !document.querySelector(".auditor").textContent.includes("skill-auditor")) fail("falta el agente auditor");
        if (/\bx-?dd\b|evol-system|evol-dd\b/i.test(document.querySelector("main").textContent)) fail("agentes: la página menciona X-DD o el sistema anterior");
        click(document.querySelector("a.agent")); await wait(); if (document.querySelectorAll("a.skill").length < 1) fail("un agente no lleva a sus skills");
        // 4. Las skills de los agentes: se abren todas y sus acciones muestran el comando
        let abiertas = 0;
        click(tabBtn("Skills de tus agentes")); await wait(); document.querySelector("select[aria-label=Fuente]").value = "todas"; document.querySelector("select[aria-label=Fuente]").dispatchEvent(new Event("change")); await wait();
        const links = [...document.querySelectorAll("a.skill")]; if (links.length < 10) fail("pocas skills de agentes (" + links.length + ")");
        for (const a of links) { click(a); await wait(); if (!document.querySelector(".side .dtitle")) { fail("no abre " + a.textContent.slice(0, 30)); continue; } abiertas++; }
        click(links[0]); await wait();
        for (const d of ["SKILL.md", "Archivos", "Dónde está", "Revisión"]) { click([...document.querySelectorAll(".side button[role=tab]")].find((b) => b.textContent.startsWith(d))); await wait(); if (!document.querySelector(".side table, .side ul.check, .side .empty-state, .side article")) fail("pestaña vacía: " + d); }
        for (const lbl of ["Pedir auditoría para añadirla"]) { const b = btn(lbl); if (!b || b.disabled) continue; click(b); await wait(); if (!document.querySelector(".actionpanel .cmdbox")) fail("«" + lbl + "» no muestra el comando"); }
        click(btn("Descargar"));
        // 5. Filtros
        const total = () => document.querySelectorAll("a.skill").length, antes = total();
        const q = document.querySelector("input[type=search]"); q.value = "zzzz-no-existe"; q.dispatchEvent(new Event("input")); await wait();
        if (total() !== 0 || !document.querySelector(".empty-state")) fail("la búsqueda sin resultados debería vaciar la lista"); q.value = ""; q.dispatchEvent(new Event("input")); await wait();
        if (total() !== antes) fail("al limpiar la búsqueda no vuelven todas");
        click(btn("Con avisos")); await wait(); const avisos = total(); if (avisos < 1 || avisos >= antes) fail("«Con avisos» muestra " + avisos + " de " + antes); click(btn("Con avisos")); await wait();
        log.push("skills ok (biblioteca vacía, " + celdas + " disciplinas por cubrir, " + abiertas + " skills de agentes abiertas, " + ags + " agentes)");
        document.title = "RESULTADO: " + log.join(" | ");
      })().catch((e) => { fail("excepción: " + e.message); document.title = "RESULTADO: " + log.join(" | "); });
      return;
    }
    if (page.startsWith("documentacion")) {
      const wait = () => new Promise((r) => setTimeout(r, 0));
      (async () => {
        const sel = document.getElementById("sel");
        if (!document.querySelector("canvas.sky-canvas")) fail("la vista por defecto debería ser la constelación");
        click(btn("Lista")); await wait();
        let abiertos = 0, sinCuerpo = 0;
        for (const o of [...sel.options]) {
          sel.value = o.value; sel.dispatchEvent(new Event("change")); await wait();
          const grupos = document.querySelectorAll(".docnav h3").length; if (grupos < 5) fail(o.value + ": pocos grupos en el índice (" + grupos + ")");
          if (!document.querySelector(".docs-tiles .tile")) fail(o.value + " sin tarjetas");
          for (const a of [...document.querySelectorAll(".docnav a")]) {
            click(a); await wait();
            if (!document.querySelector(".reader .dtitle")) { fail(o.value + ": no abre " + a.textContent.slice(0, 40)); continue; }
            abiertos++;
            if (!document.querySelector(".reader .panel, .reader .svgwrap, .reader .md")) sinCuerpo++;
            const z = btn("+"); if (z) { click(z); click(btn("Original")); }
          }
          click(document.querySelector(".crumbs a")); await wait();
          if (!document.querySelector(".gallery, .docs-main .panel")) fail(o.value + " sin resumen");
        }
        if (sinCuerpo) fail(sinCuerpo + " documentos abren sin cuerpo");
        sel.value = "ajicolor"; sel.dispatchEvent(new Event("change")); await wait();
        const q = document.querySelector("input[type=search]"); q.value = "amenaza"; q.dispatchEvent(new Event("input")); await wait();
        const hits = document.querySelectorAll(".docs-main .check li").length; if (hits < 1) fail("la búsqueda «amenaza» no encuentra nada");
        q.value = "zzzz-no-existe"; q.dispatchEvent(new Event("input")); await wait();
        if (!document.querySelector(".docs-main .note")) fail("sin mensaje de búsqueda vacía");
        q.value = ""; q.dispatchEvent(new Event("input")); await wait();
        click([...document.querySelectorAll("button.chip")].find((b) => b.textContent.startsWith("Solo lo que falta"))); await wait();
        const soloFaltan = [...document.querySelectorAll(".docnav .mark")].every((m) => m.textContent !== "✓"); if (!soloFaltan) fail("«solo lo que falta» deja documentos completos");
        click(btn("Constelación")); await wait();
        let estrellas = 0, fichas = 0;
        for (const o of [...sel.options]) {
          sel.value = o.value; sel.dispatchEvent(new Event("change")); await wait();
          if (!document.querySelector("canvas.sky-canvas")) { fail(o.value + ": sin constelación"); continue; }
          for (const id of sky.__ids()) {
            estrellas++; sky.select(id, true); sky.step(2500); const st = sky.state();
            if (!st.card || st.zoom < 2.5) { fail(o.value + ": «" + id + "» no se acerca o no despliega (zoom " + st.zoom.toFixed(2) + ")"); continue; }
            if (!document.querySelector(".sky-card .dtitle")) { fail(o.value + ": «" + id + "» sin ficha"); continue; }
            fichas++;
          }
          sky.reset(true);
        }
        sel.value = "evol-driven"; sel.dispatchEvent(new Event("change")); await wait();
        click(btn("Código (54 archivos)")); await wait();
        if (!sky || sky.state().stars !== 54) fail("la constelación de código de evol-driven no tiene 54 estrellas");
        else { sky.select(sky.__ids()[0], true); sky.step(2500); if (!document.querySelector(".sky-card .starcard")) fail("una estrella de código no despliega su ficha"); }
        log.push("documentación ok (" + estrellas + " estrellas, " + fichas + " fichas; " + abiertos + " documentos abiertos en " + sel.options.length + " proyectos)");
        document.title = "RESULTADO: " + log.join(" | ");
      })().catch((e) => { fail("excepción: " + e.message); document.title = "RESULTADO: " + log.join(" | "); });
      return;
    }
  } catch (e) { fail("excepción: " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  document.title = "RESULTADO: " + log.join(" | ");
})();
