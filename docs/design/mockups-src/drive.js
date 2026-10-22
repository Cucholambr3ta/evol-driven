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
      click(btn("Código")); const nodes = document.querySelectorAll("svg.graph g[data-id]"); if (nodes.length !== 54) fail("nodos=" + nodes.length);
      for (const g of nodes) click(g);
      const side = document.querySelector(".side h3"); if (!side) fail("sin detalle tras seleccionar");
      for (const b of [...document.querySelectorAll(".legend button")]) click(b);
      const q = document.querySelector("input[type=search]"); q.value = "paths"; q.dispatchEvent(new Event("input"));
      const vis = [...document.querySelectorAll("svg.graph g[data-id]")].filter((g) => g.style.opacity === "1").length; if (vis < 1) fail("la búsqueda no deja ningún nodo");
      log.push("grafos ok (" + nodes.length + " nodos clicados, " + vis + " visibles tras buscar)");
    }
    if (page.startsWith("skills")) {
      const wait = () => new Promise((r) => setTimeout(r, 0));
      (async () => {
        let abiertas = 0;
        for (const t of ["Biblioteca evol", "En tus agentes"]) {
          click([...document.querySelectorAll("button[role=tab]")].find((b) => b.textContent.startsWith(t))); await wait();
          const links = [...document.querySelectorAll("a.skill")]; if (links.length < 10) fail(t + ": pocas skills (" + links.length + ")");
          for (const a of links) {
            click(a); await wait();
            if (!document.querySelector(".side .dtitle")) { fail("no abre " + a.textContent.slice(0, 30)); continue; }
            abiertas++;
          }
          const first = document.querySelector("a.skill"); click(first); await wait();
          for (const d of ["SKILL.md", "Archivos", "Dónde está", "Revisión"]) { click([...document.querySelectorAll(".side button[role=tab]")].find((b) => b.textContent.startsWith(d))); await wait(); if (!document.querySelector(".side table, .side ul.check, .side .empty-state")) fail(t + "/" + d + " sin contenido"); }
          for (const lbl of ["Usar en un proyecto…", "Instalar en un agente…", "Importar a la biblioteca", "Añadir a la biblioteca evol", "Quitar"]) {
            const b = btn(lbl); if (!b || b.disabled) continue; click(b); await wait();
            if (!document.querySelector(".actionpanel .cmdbox")) fail(t + ": «" + lbl + "» no muestra el comando");
          }
          click(btn("Descargar"));
        }
        click([...document.querySelectorAll("button[role=tab]")].find((b) => b.textContent.startsWith("Biblioteca evol"))); await wait();
        click(btn("Nueva skill")); await wait();
        const dlg = document.querySelector("dialog.dlg[open]"); if (!dlg) fail("«Nueva skill» no abre el diálogo");
        else { const n = dlg.querySelector("#nn"); n.value = "mi-prueba"; n.dispatchEvent(new Event("input")); if (!dlg.textContent.includes("evol skills new mi-prueba")) fail("el comando no sigue al nombre"); dlg.close(); }
        click(btn("Importar…")); await wait(); if (!document.querySelector("dialog.dlg[open]")) fail("«Importar…» no abre el diálogo"); document.querySelectorAll("dialog[open]").forEach((d) => d.close());
        const total = () => document.querySelectorAll("a.skill").length;
        const q = document.querySelector("input[type=search]"); q.value = "tdd"; q.dispatchEvent(new Event("input")); await wait();
        if (total() < 1) fail("la búsqueda «tdd» no encuentra nada"); q.value = ""; q.dispatchEvent(new Event("input")); await wait();
        click(btn("Solo nuevas")); await wait(); if (total() !== 0 || !document.querySelector(".empty-state")) fail("«Solo nuevas» debería quedar vacío (la biblioteca está vacía)"); click(btn("Solo nuevas")); await wait();
        click(btn("Con avisos")); await wait(); const avisos = total(); if (avisos < 7) fail("«Con avisos» muestra " + avisos + " (esperaba al menos 7)"); click(btn("Con avisos")); await wait();
        const sel = document.querySelector("select[aria-label=Grupo]"); sel.value = "disciplinas"; sel.dispatchEvent(new Event("change")); await wait(); if (total() !== 31) fail("grupo disciplinas = " + total() + " (esperaba 31)");
        log.push("skills ok (" + abiertas + " skills abiertas)");
        document.title = "RESULTADO: " + log.join(" | ");
      })().catch((e) => { fail("excepción: " + e.message); document.title = "RESULTADO: " + log.join(" | "); });
      return;
    }
    if (page.startsWith("documentacion")) {
      const wait = () => new Promise((r) => setTimeout(r, 0));
      (async () => {
        const sel = document.getElementById("sel");
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
        log.push("documentación ok (" + abiertos + " documentos abiertos en " + sel.options.length + " proyectos)");
        document.title = "RESULTADO: " + log.join(" | ");
      })().catch((e) => { fail("excepción: " + e.message); document.title = "RESULTADO: " + log.join(" | "); });
      return;
    }
  } catch (e) { fail("excepción: " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
  document.title = "RESULTADO: " + log.join(" | ");
})();
