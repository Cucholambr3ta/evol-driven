/* ---------- Constellation: files and documents as stars floating in a night sky ----------
 * Click a star and the camera flies to it while its document unfolds beside it; drag a star and the
 * ones linked to it follow, like the graph view of Obsidian. Shared by Grafos
 * (code) and Documentación. Canvas 2D, no libraries. Honours prefers-reduced-motion (no drift,
 * no twinkle, the camera jumps) and offers a keyboard list of every star.
 *
 *   Constellation({ nodes, edges, clusters, renderCard(node, api), onSelect(id|null), ariaLabel, tooltip(node) })
 *   node:    { id, x, y (0..1), r (px), color, label, hollow?, dim? }
 *   cluster: { label, x, y (0..1), color }          faint nebula behind a group of stars
 *   returns  { el, select(id), reset(), refreshCard(), setFilter(fn), state(), step(ms), destroy() }
 */
function toRGB(c) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) { const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  return m ? m[1].split(",").slice(0, 3).map((v) => Math.round(parseFloat(v))) : [200, 210, 255];
}
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

function Constellation(opts) {
  const { edges = [], clusters = [], renderCard, onSelect, ariaLabel, tooltip } = opts;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const W = 1000, H = 640;
  const rand = seeded(ariaLabel || "sky");
  const nodes = opts.nodes.map((n) => ({
    ...n, wx: 50 + n.x * (W - 100), wy: 50 + n.y * (H - 100), rgb: toRGB(n.color),
    hx: 50 + n.x * (W - 100), hy: 50 + n.y * (H - 100), vx: 0, vy: 0, dx: 0, dy: 0, pinned: false,
    ph: rand() * 6.28, ph2: rand() * 6.28, fr: 0.25 + rand() * 0.5, px: 0, py: 0, rr: 0, ok: true,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = edges.filter((e) => byId.has(e.a) && byId.has(e.b));
  // each link remembers how long it was drawn, so pulling a star stretches its links and they spring back
  for (const e of links) { const a = byId.get(e.a), b = byId.get(e.b); e.rest = Math.max(28, Math.hypot(a.wx - b.wx, a.wy - b.wy)); }
  const neighbours = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const e of links) { neighbours.get(e.a).add(e.b); neighbours.get(e.b).add(e.a); }

  const canvas = el("canvas", { class: "sky-canvas", tabindex: 0, role: "img", "aria-label": ariaLabel + ". Flechas para mover, más y menos para acercar, Escape para volver; debajo hay una lista con todas las estrellas." });
  const wrap = el("div", { class: "sky" }, canvas);
  const ctx = canvas.getContext("2d");
  let w = 800, h = 560, dpr = 1, z0 = 1;
  const cam = { x: W / 2, y: H / 2, z: 1 }, target = { x: W / 2, y: H / 2, z: 1 };
  let alpha = 0, acc = 0, t = 0, last = 0, raf = 0, visible = true, selected = null, hover = null, selT = 0, card = null, filter = null, drag = null, destroyed = false;
  const narrow = () => w < 720;

  const api = { select: (id) => select(id), reset: () => reset(), nodes, byId, neighbours };
  const screen = (wx, wy) => [(wx - cam.x) * cam.z + w / 2, (wy - cam.y) * cam.z + h / 2];
  const sizeFactor = () => Math.pow(cam.z / z0, 0.55);

  function resize() {
    const r = wrap.getBoundingClientRect();
    if (!r.width) return;
    w = Math.round(r.width); h = Math.round(r.height); dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + "px"; canvas.style.height = h + "px";
    z0 = Math.min(w / W, h / H) * 0.98;
    if (selected) focusOn(selected, true); else { cam.z = target.z = z0; }
    draw();
  }
  function focusOn(id, instant) {
    const n = byId.get(id); if (!n) return;
    target.z = z0 * 3;
    if (narrow()) { target.x = n.wx; target.y = n.wy + (h / 2 - h * 0.2) / target.z; }
    else { target.x = n.wx + (w / 2 - w * 0.27) / target.z; target.y = n.wy; }
    if (instant || reduce) Object.assign(cam, target);
  }
  function fitAll() { target.x = W / 2; target.y = H / 2; target.z = z0; if (reduce) Object.assign(cam, target); }

  /* ---------- selection and the unfolding card ---------- */
  function buildCard() {
    const n = byId.get(selected); if (!n) return;
    const body = renderCard(n, api);
    const next = el("aside", { class: "sky-card", role: "dialog", "aria-label": n.label, tabindex: -1 },
      el("button", { class: "chip sky-close", type: "button", onclick: () => reset() }, "← Volver"), body);
    if (card) card.replaceWith(next); else wrap.append(next);
    card = next;
  }
  function select(id, quiet) {
    if (!byId.has(id)) return;
    const again = selected === id;
    selected = id; selT = 0;
    focusOn(id);
    buildCard();
    if (!again) { try { card.focus({ preventScroll: true }); } catch { /* not focusable yet */ } }
    wrap.classList.add("has-card");
    if (!quiet && onSelect) onSelect(id);
    kick();
  }
  function reset(quiet) {
    if (selected === null && !card) return;
    selected = null;
    if (card) { card.remove(); card = null; }
    wrap.classList.remove("has-card");
    fitAll();
    if (!quiet && onSelect) onSelect(null);
    canvas.focus({ preventScroll: true });
    kick();
  }

  /* ---------- simulation and drawing ---------- */
  /* Obsidian-style physics: stars repel, links are springs, a weak pull keeps each one near where it was drawn.
     `alpha` is the heat: dragging reheats it and it cools on its own, so the graph settles after you let go. */
  function tick() {
    const k = Math.max(alpha, 0.02);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], ddx = b.wx - a.wx, ddy = b.wy - a.wy, d = Math.max(Math.hypot(ddx, ddy), 12);
        if (d > 260) continue;
        const f = (22 * k) / d; // repulsion falls off with distance and fades as the graph cools
        const fx = (ddx / d) * f, fy = (ddy / d) * f;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
    }
    for (const e of links) {
      const a = byId.get(e.a), b = byId.get(e.b), ddx = b.wx - a.wx, ddy = b.wy - a.wy, d = Math.max(Math.hypot(ddx, ddy), 1);
      const f = (d - e.rest) * (e.kind === "grupo" ? 0.01 : 0.03) * k * 4;
      const fx = (ddx / d) * f, fy = (ddy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for (const n of nodes) {
      if (n.pinned) { n.vx = n.vy = 0; continue; }
      n.vx += (n.hx - n.wx) * 0.01 * k; n.vy += (n.hy - n.wy) * 0.01 * k;
      n.vx *= 0.6; n.vy *= 0.6; n.wx += n.vx; n.wy += n.vy;
    }
    // a pulled graph keeps its new shape: what it has drifted to becomes the new "home"
    for (const n of nodes) { n.hx += (n.wx - n.hx) * 0.02; n.hy += (n.wy - n.hy) * 0.02; }
    alpha = drag && drag.node ? Math.max(alpha * 0.985, 0.35) : alpha * 0.975;
    if (alpha < 0.004) alpha = 0;
  }
  function advance(dt) {
    acc += dt; while (alpha > 0 && acc >= 1 / 60) { tick(); acc -= 1 / 60; } if (!alpha) acc = 0;
    t += dt; selT += dt;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 4.2);
    cam.x += (target.x - cam.x) * k; cam.y += (target.y - cam.y) * k;
    cam.z *= Math.pow(target.z / cam.z, k);
  }
  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    bg.addColorStop(0, "#0d1226"); bg.addColorStop(1, "#04050c");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // nebulae and their names
    for (const c of clusters) {
      const mine = c.id == null ? [] : nodes.filter((n) => n.grupo === c.id);
      const cwx = mine.length ? mine.reduce((s2, n) => s2 + n.wx, 0) / mine.length : 50 + c.x * (W - 100), cwy = mine.length ? mine.reduce((s2, n) => s2 + n.wy, 0) / mine.length : 50 + c.y * (H - 100);
      const top = mine.length ? Math.min(...mine.map((n) => n.wy)) - 34 : cwy + (c.dy ?? -0.1) * (H - 100);
      const [x, y] = screen(cwx, cwy), rad = 150 * cam.z, rgb = toRGB(c.color);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(rgb, selected ? 0.05 : 0.11)); g.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      if (!selected) { ctx.font = "600 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = rgba(rgb, 0.75); ctx.fillText(c.label.toUpperCase(), x, screen(cwx, top)[1]); }
    }
    // floating positions
    const sf = sizeFactor();
    for (const n of nodes) {
      n.dx = reduce || n.pinned ? 0 : Math.sin(t * n.fr + n.ph) * 3.2; n.dy = reduce || n.pinned ? 0 : Math.cos(t * n.fr * 0.8 + n.ph2) * 3.2;
      [n.px, n.py] = screen(n.wx + n.dx, n.wy + n.dy);
      n.rr = n.r * sf;
    }
    const nb = selected ? neighbours.get(selected) : null;
    // lines
    ctx.lineWidth = 1;
    for (const e of links) {
      const a = byId.get(e.a), b = byId.get(e.b);
      const on = a.ok && b.ok, hot = selected && (e.a === selected || e.b === selected);
      ctx.strokeStyle = hot ? "rgba(255,255,255,0.8)" : `rgba(170,190,255,${!on ? 0.02 : selected ? 0.05 : e.kind === "grupo" ? 0.07 : 0.16})`;
      ctx.lineWidth = hot ? 1.4 : 1;
      ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    }
    // stars, smallest first so the big ones sit on top
    for (const n of [...nodes].sort((p, q) => p.r - q.r)) {
      const isSel = n.id === selected, isNb = nb && nb.has(n.id), isHover = n === hover;
      let alpha = !n.ok ? 0.1 : selected ? (isSel ? 1 : isNb ? 0.85 : 0.22) : 1;
      if (n.dim) alpha *= 0.55;
      const tw = reduce ? 1 : 0.82 + 0.18 * Math.sin(t * (1.1 + n.fr * 2) + n.ph);
      const r = n.rr * (isHover ? 1.25 : 1);
      if (n.px < -80 || n.px > w + 80 || n.py < -80 || n.py > h + 80) continue;
      ctx.globalAlpha = alpha;
      if (n.hollow) {
        ctx.strokeStyle = rgba(n.rgb, 0.85); ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(n.px, n.py, Math.max(r, 3), 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const gr = r * (isSel ? 6.5 : 4.2) * tw;
        const g = ctx.createRadialGradient(n.px, n.py, 0, n.px, n.py, gr);
        g.addColorStop(0, rgba(n.rgb, 0.55)); g.addColorStop(0.35, rgba(n.rgb, 0.16)); g.addColorStop(1, rgba(n.rgb, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.px, n.py, gr, 0, 6.283); ctx.fill();
        if (r > 5) { // diffraction spikes on the biggest stars
          ctx.strokeStyle = rgba(n.rgb, 0.55 * tw); ctx.lineWidth = 1; ctx.beginPath();
          ctx.moveTo(n.px - r * 2.6, n.py); ctx.lineTo(n.px + r * 2.6, n.py); ctx.moveTo(n.px, n.py - r * 2.6); ctx.lineTo(n.px, n.py + r * 2.6); ctx.stroke();
        }
        ctx.fillStyle = rgba(n.rgb.map((v) => Math.min(255, v + 70)), 1);
        ctx.beginPath(); ctx.arc(n.px, n.py, Math.max(r * 0.62, 1.6), 0, 6.283); ctx.fill();
      }
      if (isSel) { ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(n.px, n.py, r * 1.9 + 4 + (reduce ? 0 : Math.sin(t * 2.2) * 1.5), 0, 6.283); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // names: the big stars, the one under the pointer, the selection and, when zoomed in, its neighbours
    ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "center";
    for (const n of nodes) {
      const show = n.ok && (n === hover || n.id === selected || (!selected && (n.labelAlways || n.r > 11)) || (nb && nb.has(n.id)));
      if (!show || n.px < 0 || n.px > w || n.py < 0 || n.py > h) continue;
      const txt = n.label.length > 34 ? "…" + n.label.slice(-33) : n.label;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(4,5,12,0.9)"; ctx.strokeText(txt, n.px, n.py - n.rr * 1.9 - 8);
      ctx.fillStyle = n.id === selected ? "#fff" : "rgba(225,232,255,0.92)"; ctx.fillText(txt, n.px, n.py - n.rr * 1.9 - 8);
    }
    // thread from the star to its unfolding card
    if (selected && card) {
      const n = byId.get(selected), p = Math.min(1, selT / 0.55);
      const cx = narrow() ? w / 2 : card.offsetLeft, cy = narrow() ? card.offsetTop : Math.min(card.offsetTop + 28, h - 20);
      const x1 = n.px + n.rr * 2.2, y1 = n.py;
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + (cx - x1) * 0.5, y1, x1 + (cx - x1) * 0.5, cy, x1 + (cx - x1) * p, y1 + (cy - y1) * p);
      ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function frame(now) {
    raf = 0; if (destroyed || !wrap.isConnected) return;
    const dt = Math.min(0.05, ((now || last) - last) / 1000 || 0.016); last = now || last;
    advance(dt); draw();
    const moving = alpha > 0 || !reduce || Math.abs(cam.x - target.x) + Math.abs(cam.y - target.y) + Math.abs(cam.z - target.z) > 0.01;
    if (visible && !document.hidden && moving) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !destroyed) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  /* ---------- pointer, wheel and keyboard ---------- */
  const hit = (mx, my) => { for (let i = nodes.length - 1; i >= 0; i--) { const n = nodes[i]; if (n.ok && Math.hypot(n.px - mx, n.py - my) < Math.max(n.rr * 1.9, 11)) return n; } return null; };
  const pos = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const toWorld = (mx, my) => [(mx - w / 2) / cam.z + cam.x, (my - h / 2) / cam.z + cam.y];
  canvas.addEventListener("pointerdown", (ev) => {
    const [x, y] = pos(ev); drag = { x, y, cx: cam.x, cy: cam.y, moved: false, node: hit(x, y) };
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* synthetic events have no active pointer */ }
  });
  canvas.addEventListener("pointermove", (ev) => {
    const [x, y] = pos(ev);
    if (drag) {
      if (Math.hypot(x - drag.x, y - drag.y) > 5) drag.moved = true;
      if (drag.moved && drag.node) { // carry the star; the ones linked to it follow
        const n = drag.node, [wx, wy] = toWorld(x, y);
        n.pinned = true; n.wx = wx - n.dx; n.wy = wy - n.dy; n.hx = n.wx; n.hy = n.wy;
        canvas.style.cursor = "grabbing"; tip(null); alpha = Math.max(alpha, 0.35); kick(); return;
      }
      if (drag.moved) { cam.x = target.x = drag.cx - (x - drag.x) / cam.z; cam.y = target.y = drag.cy - (y - drag.y) / cam.z; kick(); return; }
      return;
    }
    const n = hit(x, y);
    if (n !== hover) { hover = n; canvas.style.cursor = n ? "grab" : "default"; kick(); }
    if (n) tip(tooltip ? tooltip(n) : [el("b", { text: n.label })], ev.clientX, ev.clientY); else tip(null);
  });
  canvas.addEventListener("pointerleave", () => { tip(null); if (hover) { hover = null; kick(); } });
  canvas.addEventListener("pointerup", (ev) => {
    const d = drag; drag = null;
    if (!d) return;
    if (d.node) d.node.pinned = false;
    canvas.style.cursor = hover ? "grab" : "default";
    if (d.moved) { kick(); return; }
    const [x, y] = pos(ev), n = hit(x, y);
    if (n) select(n.id); else if (selected) reset();
  });
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const [mx, my] = pos(ev), f = Math.exp(-ev.deltaY * 0.0015), nz = Math.max(z0 * 0.8, Math.min(z0 * 9, cam.z * f));
    const wx = (mx - w / 2) / cam.z + cam.x, wy = (my - h / 2) / cam.z + cam.y;
    cam.z = target.z = nz; cam.x = target.x = wx - (mx - w / 2) / nz; cam.y = target.y = wy - (my - h / 2) / nz; kick();
  }, { passive: false });
  const zoomBy = (f) => { target.z = Math.max(z0 * 0.8, Math.min(z0 * 9, target.z * f)); if (reduce) cam.z = target.z; kick(); };
  canvas.addEventListener("keydown", (ev) => {
    const step = 60 / cam.z;
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
    if (k) { ev.preventDefault(); target.x += k[0]; target.y += k[1]; if (reduce) { cam.x = target.x; cam.y = target.y; } kick(); }
    else if (ev.key === "+" || ev.key === "=") zoomBy(1.4);
    else if (ev.key === "-") zoomBy(1 / 1.4);
    else if (ev.key === "Escape") reset();
  });
  wrap.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && selected) { ev.preventDefault(); reset(); } });

  /* ---------- overlay controls and the keyboard list ---------- */
  wrap.append(el("div", { class: "sky-ctl" },
    el("button", { class: "chip", type: "button", "aria-label": "Acercar", onclick: () => zoomBy(1.4) }, "+"),
    el("button", { class: "chip", type: "button", "aria-label": "Alejar", onclick: () => zoomBy(1 / 1.4) }, "−"),
    el("button", { class: "chip", type: "button", onclick: () => (selected ? reset() : fitAll() || kick()) }, "Ver todo")),
    el("p", { class: "sky-hint", text: "Arrastra una estrella para moverla · arrastra el vacío para desplazarte · rueda para acercar · clic para abrirla" }));
  const list = el("details", { class: "tw" }, el("summary", { text: `Lista de estrellas (${nodes.length}) para teclado y lectores de pantalla` }),
    el("ul", { class: "starlist" }, [...nodes].sort((a, b) => a.label.localeCompare(b.label)).map((n) =>
      el("li", {}, el("button", { class: "chip", type: "button", onclick: () => select(n.id) }, n.label)))));
  const root = el("div", {}, wrap, list);

  const ro = new ResizeObserver(() => resize());
  ro.observe(wrap);
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); });
  io.observe(wrap);
  document.addEventListener("visibilitychange", kick);
  queueMicrotask(() => { resize(); kick(); });

  return {
    el: root, select, reset, refreshCard: () => selected && buildCard(),
    setFilter(fn) { filter = fn; for (const n of nodes) n.ok = !fn || fn(n); kick(); },
    __ids: () => nodes.map((n) => n.id),
    state: () => ({ selected, zoom: cam.z / z0, targetZoom: target.z / z0, card: Boolean(card), stars: nodes.length, links: links.length }),
    step(ms) { for (let i = 0; i < ms; i += 40) advance(0.04); draw(); },
    // test hooks: move a star as a drag would, and read where one is
    __drag(id, wx, wy) { const n = byId.get(id); n.pinned = true; n.wx = wx; n.wy = wy; n.hx = wx; n.hy = wy; alpha = 0.35; for (let i = 0; i < 60; i++) tick(); n.pinned = false; },
    __screen: (id) => { const n = byId.get(id); return [n.px, n.py]; },
    __pos: (id) => { const n = byId.get(id); return [n.wx, n.wy]; },
    destroy() { destroyed = true; ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", kick); if (raf) cancelAnimationFrame(raf); },
  };
}

/* ---------- the code graph as stars (shared by Grafos and Documentación) ---------- */
const CODE_GRP = { core: ["Núcleo (src/core)", "var(--s1)", "#5aa0ff"], comandos: ["Comandos (src/commands)", "var(--s2)", "#ff8a57"], codeintel: ["Código (src/codeintel)", "var(--s3)", "#3fd49d"], otros: ["Otros de src", "var(--muted)", "#a7adbd"], pruebas: ["Pruebas", null, "#e6ecff"] };
function codeSky(CODE, { mode = "calor", onSelect, groupsOn } = {}) {
  const nodes = CODE.nodos, maxImp = Math.max(1, ...nodes.map((n) => n.impacto));
  const importers = new Map(nodes.map((n) => [n.id, []])), imports = new Map(nodes.map((n) => [n.id, []]));
  for (const e of CODE.aristas) { importers.get(e.b)?.push(e.a); imports.get(e.a)?.push(e.b); }
  const stars = nodes.map((n) => ({
    id: n.id, x: n.x, y: n.y, label: n.id, hollow: n.prueba,
    r: 2.6 + 12 * Math.sqrt(n.impacto / maxImp),
    color: n.prueba ? CODE_GRP.pruebas[2] : mode === "calor" ? heat(Math.pow(n.impacto / maxImp, 0.8)) : CODE_GRP[n.grupo][2],
    labelAlways: n.impacto / maxImp > 0.55, grupo: n.grupo, data: n,
  }));
  const sky = Constellation({
    nodes: stars, edges: CODE.aristas.map((e) => ({ a: e.a, b: e.b })), onSelect, ariaLabel: `Constelación de ${CODE.resumen.archivos} archivos de ${CODE.proyecto}`,
    tooltip: (s) => [el("b", { text: s.label }), el("div", { text: `alcance ${s.data.impacto} archivos · ${s.data.totalSimbolos} símbolos` })],
    renderCard: (s, api) => {
      const n = s.data, pills = (ids) => ids.length ? ids.map((id) => el("button", { class: "pill mono linkpill", type: "button", onclick: () => api.select(id) }, id)) : el("span", { class: "note", text: "ninguno" });
      return el("div", { class: "starcard" },
        el("h2", { class: "mono dtitle", text: n.id }), el("p", { class: "note", text: CODE_GRP[n.grupo][0] + (n.prueba ? " · archivo de prueba" : "") }),
        el("dl", { class: "meta" }, el("dt", { text: "Símbolos" }), el("dd", { text: n.totalSimbolos }), el("dt", { text: "Lo importan" }), el("dd", { text: n.importadores + " archivos" }),
          el("dt", { text: "Alcance transitivo" }), el("dd", { text: `${n.impacto} archivos (lo que se rompería si lo tocas)` })),
        n.simbolos.length ? el("div", {}, el("h3", { class: "h3", text: "Símbolos" }), n.simbolos.map((q) => el("span", { class: "pill", title: q.tipo, text: q.nombre })),
          n.totalSimbolos > n.simbolos.length ? el("span", { class: "note", text: ` y ${n.totalSimbolos - n.simbolos.length} más` }) : null) : null,
        el("h3", { class: "h3", text: "Importa a" }), el("div", {}, pills(imports.get(n.id))),
        el("h3", { class: "h3", text: "Lo importan" }), el("div", {}, pills(importers.get(n.id))),
        el("h3", { class: "h3", text: "Pruebas" }), n.pruebas.length ? n.pruebas.map((p) => el("div", { class: "mono", text: p })) : el("div", { class: "note", text: "Ninguna prueba lo importa directamente." }));
    },
  });
  if (groupsOn) sky.setFilter((s) => groupsOn.has(s.grupo));
  return sky;
}
