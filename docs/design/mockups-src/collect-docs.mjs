// Reads the documentation of every project in data/portfolio.json and writes data/docs.json.
//
//   node collect-docs.mjs <carpeta-con-los-proyectos> <ruta-de-dist/cli.js> <EVOL_CONFIG_DIR>
//
// Everything comes from the projects' own files and from the real `evol` CLI (`export --json` for
// coverage and risk, `diagrams` for the UML). Nothing is invented: a document that does not exist is
// reported as missing, and a diagram without data keeps the reason evol gave.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, globSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const [projectsDir, cli, configDir] = process.argv.slice(2).map((p) => (p ? resolve(p) : p));
if (!projectsDir || !cli || !configDir) {
  console.error("Uso: node collect-docs.mjs <carpeta-proyectos> <cli.js> <EVOL_CONFIG_DIR>");
  process.exit(2);
}
const here = dirname(new URL(import.meta.url).pathname);
const portfolio = JSON.parse(readFileSync(join(here, "data/portfolio.json"), "utf8"));

const MAX_TEXT = 60_000;
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

function evol(cwd, args) {
  const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, EVOL_CONFIG_DIR: configDir },
    maxBuffer: 256 * 1024 * 1024,
    timeout: 300_000,
  });
  return { ok: run.status === 0, out: run.stdout, err: run.stderr };
}

/** A text file as an item. `estado` says whether it is finished (no [[COMPLETAR]] left). */
function fileItem(root, rel, meta) {
  const abs = join(root, rel);
  const buf = readFileSync(abs);
  const text = buf.toString("utf8");
  const truncated = text.length > MAX_TEXT;
  return {
    id: `${meta.grupo}:${rel}`,
    ruta: rel,
    bytes: buf.length,
    hash: sha(buf).slice(0, 16),
    estado: text.includes("[[COMPLETAR]]") ? "pendiente" : "ok",
    texto: truncated ? `${text.slice(0, MAX_TEXT)}\n\n…(recortado: el archivo tiene ${text.length} caracteres)` : text,
    recortado: truncated,
    ...meta,
  };
}

const title = (text, fallback) => /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? fallback;

/** Where a well-known file belongs, by its name. */
const KNOWN = [
  [/^(docs\/specs\/)?SPEC\.md$/, "especificaciones", "Especificación", "spec"],
  [/^(docs\/specs\/)?DOMAIN\.md$/, "especificaciones", "Modelo de dominio", "spec"],
  [/^(docs\/features\/)?FEATURES\.md$/, "especificaciones", "Features", "briefing"],
  [/^(docs\/specs\/)?THREATS\.md$/, "especificaciones", "Modelo de amenazas", "spec"],
  [/^DISCOVERY\.md$/, "especificaciones", "Descubrimiento", "briefing"],
  [/^PLAN\.md$/, "especificaciones", "Plan", "plan"],
  [/^docs\/SPEC-.+\.md$/, "especificaciones", "Especificación adicional", "spec"],
  [/^(api\/)?openapi\.ya?ml$/, "especificaciones", "Contrato OpenAPI", "spec"],
  [/^tests\/features\/.+\.feature$/, "especificaciones", "Escenarios (BDD)", "briefing"],
  [/^(\.evol\/qa\/|)QA_REPORT\.md$/, "evidencias", "Informe de QA", "qa"],
  [/^CHANGELOG\.md$/, "evidencias", "Registro de cambios", null],
  [/^MEJORAS[^/]*\.md$/i, "mejoras", "Propuesta de mejoras", null],
  [/^(docs\/mejoras|proposals)\/.+\.(md|txt)$/i, "mejoras", "Propuesta de mejora", null],
  [/^PENDIENTES[^/]*\.md$/i, "mejoras", "Pendientes", null],
  [/^lecciones\.md$/, "mejoras", "Lecciones aprendidas", "retro"],
  [/^docs\/adr\/.+\.md$/, "decisiones", "Decisión (ADR)", null],
  [/^docs\/constitucion\.md$/, "decisiones", "Constitución del proyecto", null],
  [/^memoria\.md$/, "decisiones", "Memoria del proyecto", null],
  [/^(README|CLAUDE|AGENTS|INSTALL|DEPENDENCIES)\.md$/, "general", "Documento general", null],
  [/^docs\/[^/]+\.md$/, "general", "Documento general", null],
];

function classify(rel) {
  for (const [re, grupo, tipo, fase] of KNOWN) if (re.test(rel)) return { grupo, tipo, fase };
  return null;
}

const IGNORED = ["node_modules/**", ".git/**", ".next/**", "dist/**", "templates/**", ".codex/**", ".antigravity/**", "prompts/**", "skills/**", "RELEASES/**", "public/**"];
function walkDocs(root) {
  const found = new Set();
  for (const pattern of ["*.md", "docs/**/*.md", "proposals/**/*", "tests/features/**/*.feature", "api/*.y*ml", "openapi.y*ml", ".evol/qa/*.md"]) {
    for (const rel of globSync(pattern, { cwd: root, exclude: (p) => IGNORED.some((g) => p.startsWith(g.split("/")[0])) })) {
      if (statSync(join(root, rel)).isFile()) found.add(rel);
    }
  }
  return [...found].sort();
}

function collectProject(p) {
  const root = join(projectsDir, p.carpeta);
  const items = { especificaciones: [], evidencias: [], mejoras: [], decisiones: [], diagramas: [], informe: [], general: [] };
  const claimed = new Set();

  // 1. Files, by what they are.
  for (const rel of walkDocs(root)) {
    const kind = classify(rel);
    if (!kind) continue;
    const text = readFileSync(join(root, rel), "utf8");
    const item = fileItem(root, rel, { grupo: kind.grupo, tipo: kind.tipo, fase: kind.fase, titulo: title(text, basename(rel)) });
    items[kind.grupo].push(item);
    claimed.add(rel);
  }

  // 2. What the pipeline expects and does not find: gaps are documentation too.
  const faltan = [];
  const seenGaps = new Set();
  for (const f of p.fases) {
    for (const d of f.disciplines) {
      for (const a of d.artefactos) {
        if (/\.(ts|tsx|js)$/.test(a.patron)) continue;
        if (a.archivos.length >= a.min) continue;
        // A discipline can apply in several phases; its missing file is one gap.
        const key = `${d.module}/${d.id}/${a.patron}`;
        if (seenGaps.has(key)) continue;
        seenGaps.add(key);
        const grupo = /adr/.test(a.patron) ? "decisiones" : /QA_REPORT/.test(a.patron) ? "evidencias" : "especificaciones";
        const gap = {
          id: `falta:${d.module}/${d.id}/${a.patron}`,
          grupo, tipo: "Pendiente de crear", ruta: a.patron, titulo: a.patron, fase: f.phase,
          disciplina: d.id, nombre: d.nombre, estado: "falta", esperados: a.min, encontrados: a.archivos.length,
        };
        items[grupo].push(gap);
        faltan.push(gap);
      }
    }
  }

  // 3. Evidence that lives in evol's own state.
  items.evidencias.unshift({
    id: "evidencia:aprobaciones", grupo: "evidencias", tipo: "Registro de aprobaciones", titulo: "Aprobaciones firmadas",
    ruta: ".evol/gate-log.jsonl", estado: p.aprobaciones.length ? "ok" : "falta",
    integridad: p.estado.aprobacion.state, aprobaciones: p.aprobaciones,
  });
  items.evidencias.push({
    id: "evidencia:verificacion", grupo: "evidencias", tipo: "Verificación por fase", titulo: "Verificación de las disciplinas",
    ruta: "evol.config.json", estado: p.problemas.length ? "pendiente" : "ok",
    fases: p.fases, problemas: p.problemas, faseActual: p.estado.fase,
  });
  items.evidencias.push({
    id: "evidencia:diario", grupo: "evidencias", tipo: "Diario", titulo: "Diario de actividad",
    ruta: ".evol/journal.jsonl", estado: "ok", eventos: p.diario,
  });
  const tests = globSync("tests/**/*.{ts,feature}", { cwd: root, exclude: (x) => x.startsWith("node_modules") }).sort();
  if (tests.length > 0) {
    items.evidencias.push({
      id: "evidencia:pruebas", grupo: "evidencias", tipo: "Pruebas", titulo: "Archivos de prueba",
      ruta: "tests/", estado: "ok", pruebas: tests.map((t) => ({ ruta: t, bytes: statSync(join(root, t)).size })),
    });
  }

  // 4. Computed by evol: coverage, risk, diagrams.
  const exported = evol(root, ["export", "--json"]);
  let data = null;
  try { data = exported.ok ? JSON.parse(exported.out) : null; } catch { data = null; }
  if (data) {
    items.evidencias.push({
      id: "evidencia:cobertura", grupo: "evidencias", tipo: "Trazabilidad", titulo: "Criterios de aceptación → escenarios → pruebas",
      ruta: "evol coverage", estado: data.cobertura.sinPrueba.length || data.cobertura.sinEscenario.length ? "pendiente" : data.cobertura.criterios.length ? "ok" : "falta",
      cobertura: data.cobertura,
    });
    items.mejoras.push({
      id: "mejora:riesgo", grupo: "mejoras", tipo: "Mapa de riesgo", titulo: "Archivos por riesgo",
      ruta: "evol risk", estado: data.riesgo.disponible && data.riesgo.archivos.some((f) => f.riesgo > 0) ? "pendiente" : "ok",
      riesgo: { disponible: data.riesgo.disponible, motivo: data.riesgo.motivo, archivos: data.riesgo.archivos.slice(0, 25), total: data.riesgo.archivos.length },
    });
  }
  items.mejoras.push({
    id: "mejora:huecos", grupo: "mejoras", tipo: "Huecos", titulo: "Lo que bloquea la fase actual",
    ruta: "evol status", estado: p.problemas.length ? "pendiente" : "ok", problemas: p.problemas, faseActual: p.estado.fase,
  });

  const out = mkdtempSync(join(tmpdir(), "evol-docs-"));
  const dg = evol(root, ["diagrams", "--salida", out, "--json"]);
  const noAplica = [];
  if (dg.ok) {
    for (const d of JSON.parse(dg.out)) {
      if (d.estado === "ok" && d.archivo && existsSync(d.archivo)) {
        items.diagramas.push({
          id: `diagrama:${d.numero}`, grupo: "diagramas", tipo: d.tipo, titulo: `${d.numero}. ${d.titulo}`, ruta: `diagramas/${basename(d.archivo)}`,
          fuente: d.fuente, nota: d.nota, estado: "ok", svg: readFileSync(d.archivo, "utf8"),
        });
      } else if (d.estado !== "ok") {
        noAplica.push({ numero: d.numero, tipo: d.tipo, motivo: d.motivo });
      }
    }
  }
  rmSync(out, { recursive: true, force: true });

  // 5. The report.
  const report = ["informe/informe.pdf", "informe/informe.docx", "informe/informe.md"].filter((r) => existsSync(join(root, r)));
  items.informe.push({
    id: "informe:estado", grupo: "informe", tipo: "Informe", titulo: "Informe del proyecto", ruta: "informe/",
    estado: report.length ? "ok" : "falta", archivos: report.map((r) => ({ ruta: r, bytes: statSync(join(root, r)).size })),
    comando: "evol report",
  });

  for (const g of Object.keys(items)) items[g].sort((a, b) => (a.estado === "falta") - (b.estado === "falta") || a.ruta.localeCompare(b.ruta));
  const count = (g) => items[g].filter((i) => i.estado !== "falta").length;
  return {
    items,
    noAplica,
    resumen: {
      especificaciones: { hay: count("especificaciones"), faltan: items.especificaciones.filter((i) => i.estado === "falta").length },
      evidencias: { hay: count("evidencias"), faltan: items.evidencias.filter((i) => i.estado === "falta").length },
      mejoras: { hay: count("mejoras"), faltan: 0 },
      decisiones: { hay: count("decisiones"), faltan: items.decisiones.filter((i) => i.estado === "falta").length },
      diagramas: { hay: items.diagramas.length, faltan: noAplica.length },
      general: { hay: count("general"), faltan: 0 },
      informe: { hay: count("informe"), faltan: items.informe.filter((i) => i.estado === "falta").length },
    },
    faltan: faltan.length,
  };
}

const result = {};
for (const p of portfolio) {
  process.stderr.write(`· ${p.id}\n`);
  result[p.id] = collectProject(p);
}
writeFileSync(join(here, "data/docs.json"), `${JSON.stringify(result)}\n`);
const total = Object.values(result).reduce((n, r) => n + Object.values(r.items).flat().length, 0);
console.log(`docs.json: ${Object.keys(result).length} proyectos, ${total} elementos, ${(statSync(join(here, "data/docs.json")).size / 1024).toFixed(0)} KB`);
