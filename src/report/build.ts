import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { isTestPath } from "../codeintel/native/indexer.js";
import { appliesIn } from "../core/disciplines.js";
import { sha256 } from "../core/hash.js";
import { PHASES } from "../core/phases.js";
import { currentArtifacts } from "../core/pipeline.js";
import { packageVersion } from "../core/paths.js";
import { readLessons } from "../core/lessons.js";
import { matchFiles } from "../core/verify.js";
import { componentOf, groupedLinks, sourceFiles } from "../diagrams/data.js";
import type { Diagram, DiagramInput } from "../diagrams/model.js";
import type { Block, Brand, DiagramFigure, ReportDoc } from "./model.js";
import { oneLine } from "./model.js";

export interface ReportInput {
  input: DiagramInput;
  diagrams: Diagram[];
  figures: Map<number, DiagramFigure>;
  /** YYYY-MM-DD, the day the report is generated. */
  date: string;
  brand: Brand;
}

const APPROVAL_TEXT: Record<string, string> = {
  vigente: "aprobación vigente",
  pendiente: "aprobación pendiente",
  obsoleta: "aprobación obsoleta (los artefactos cambiaron)",
  "no-verificable": "aprobación no verificable en este equipo (falta la clave del gate)",
  "no-integro": "registro de aprobaciones NO ÍNTEGRO",
};

const day = (iso: string): string => iso.slice(0, 10);

function phaseRows(input: DiagramInput): string[][] {
  const done = new Map(input.data.pipeline.completadas.map((c) => [c.fase, c]));
  return PHASES.map((phase) => {
    const entry = done.get(phase);
    const state = entry
      ? entry.adoptada
        ? "adoptada (previa a evol, sin aprobación)"
        : "completada"
      : input.data.pipeline.fase === phase
        ? "actual"
        : "pendiente";
    return [phase, state, entry ? day(entry.en) : "—"];
  });
}

function summary(r: ReportInput): Block[] {
  const { data } = r.input;
  const { pipeline, cobertura, aprobaciones, riesgo } = data;
  const approvalState = APPROVAL_TEXT[pipeline.aprobacion.estado] ?? pipeline.aprobacion.estado;
  const done = pipeline.completadas.length;
  const integrity =
    aprobaciones.integra === null
      ? "no verificable en este equipo"
      : aprobaciones.integra
        ? "íntegro"
        : "NO ÍNTEGRO";
  const okDiagrams = r.diagrams.filter((d) => d.estado === "ok").length;

  const blocks: Block[] = [
    { t: "h1", text: "1. Resumen ejecutivo" },
    {
      t: "p",
      text:
        pipeline.fase === "done"
          ? `${data.proyecto.nombre} terminó el pipeline: las ${PHASES.length} fases están completas.`
          : `${data.proyecto.nombre} está en la fase «${pipeline.fase}»: ${done} de ${PHASES.length} fases completadas; ${approvalState}.`,
    },
    {
      t: "bullets",
      items: [
        `Aprobaciones registradas: ${aprobaciones.entradas.length} (registro ${integrity}).`,
        `Criterios de aceptación CA-n: ${cobertura.criterios.length}; sin escenario: ${cobertura.sinEscenario.length}; sin prueba: ${cobertura.sinPrueba.length}.`,
        `Diagramas UML generados: ${okDiagrams} de ${r.diagrams.length}.`,
        riesgo.disponible
          ? `Archivos de código analizados: ${riesgo.archivos.length}.`
          : "Mapa de riesgo no disponible (ver sección 6).",
      ],
    },
    { t: "h2", text: "Bloqueos de la fase actual" },
  ];

  const blockers: string[] = [];
  for (const d of pipeline.disciplinas) {
    for (const a of d.artefactos) {
      if (a.encontrados < a.min) {
        blockers.push(
          `[${d.modulo}/${d.id}] falta «${a.patron}» (hay ${a.encontrados}, se esperan ${a.min}).`,
        );
      }
      if (a.pendientes > 0) {
        blockers.push(
          `[${d.modulo}/${d.id}] «${a.patron}»: ${a.pendientes} archivo(s) con [[COMPLETAR]].`,
        );
      }
    }
  }
  blocks.push(
    blockers.length > 0
      ? { t: "bullets", items: blockers }
      : {
          t: "p",
          text: "No se detectaron artefactos pendientes. Este informe no ejecuta pruebas ni comandos de verificación: eso lo hace evol next.",
        },
  );

  blocks.push({ t: "h2", text: "Riesgos principales" });
  const risky = riesgo.archivos.filter((f) => f.riesgo > 0).slice(0, 5);
  if (!riesgo.disponible) {
    blocks.push({ t: "p", text: `No disponible: ${riesgo.motivo ?? "sin motivo"}` });
  } else if (risky.length === 0) {
    blocks.push({
      t: "p",
      text: "Ningún archivo tiene riesgo: todo lo que otros usan está cubierto por pruebas.",
    });
  } else {
    blocks.push({
      t: "bullets",
      items: risky.map(
        (f) =>
          `${f.archivo}: riesgo ${f.riesgo} (lo usan ${f.alcance} archivo(s); ${f.cubiertas} de ${f.unidades} unidades con prueba).`,
      ),
    });
  }
  return blocks;
}

function pipelineSection(r: ReportInput): Block[] {
  const { aprobaciones } = r.input.data;
  const blocks: Block[] = [
    { t: "h1", text: "2. Pipeline y aprobaciones" },
    { t: "table", columns: ["Fase", "Estado", "Fecha"], rows: phaseRows(r.input) },
  ];
  if (aprobaciones.entradas.length === 0) {
    blocks.push({ t: "p", text: "Todavía no hay aprobaciones registradas." });
  } else {
    blocks.push({ t: "h2", text: "Aprobaciones" });
    blocks.push({
      t: "table",
      columns: ["N.º", "Fase", "Aprobador", "Fecha", "Huella (SHA-256)"],
      rows: aprobaciones.entradas.map((a) => [
        String(a.seq),
        a.fase,
        a.aprobador,
        day(a.en),
        `${a.huella.slice(0, 16)}…`,
      ]),
    });
    blocks.push({
      t: "p",
      muted: true,
      text: "Cada aprobación firma el hash de los artefactos de la fase y de evol.config.json. Si alguno cambia después, la aprobación deja de valer.",
    });
  }
  return blocks;
}

function disciplinesSection(r: ReportInput): Block[] {
  const { ctx } = r.input;
  const blocks: Block[] = [{ t: "h1", text: "3. Disciplinas por módulo y fase" }];
  for (const module of ctx.config.modules) {
    blocks.push({ t: "h2", text: `Módulo «${module.name}» (${module.root})` });
    const rows = module.disciplinas.flatMap((id) => {
      const d = ctx.registry.get(id);
      if (!d) return [];
      const phases = PHASES.filter((p) => appliesIn(d, p)).join(", ");
      return [[d.id, d.nombre, d.tipo, phases, String(d.artefactos.length)]];
    });
    blocks.push({
      t: "table",
      columns: ["Disciplina", "Nombre", "Tipo", "Fases", "Artefactos"],
      rows,
    });
  }
  return blocks;
}

function traceabilitySection(r: ReportInput): Block[] {
  const { cobertura } = r.input.data;
  const blocks: Block[] = [{ t: "h1", text: "4. Trazabilidad de criterios de aceptación" }];
  if (cobertura.criterios.length === 0) {
    blocks.push({
      t: "p",
      text: "El SPEC no declara criterios con la convención CA-n. Escríbelos como «CA-1: …», etiqueta los escenarios con @CA-1 y nombra las pruebas con CA-1 para que aparezcan aquí.",
    });
    return blocks;
  }
  blocks.push({
    t: "table",
    columns: ["Criterio", "Módulo", "Texto", "Escenarios", "Pruebas"],
    rows: cobertura.criterios.map((c) => [
      c.id,
      c.modulo,
      oneLine(c.texto, 70),
      String(c.escenarios.length),
      String(c.pruebas.length),
    ]),
  });
  const gaps = [
    ...cobertura.sinEscenario.map((c) => `${c}: sin escenario.`),
    ...cobertura.sinPrueba.map((c) => `${c}: sin prueba.`),
    ...cobertura.huerfanos.map(
      (c) => `${c}: se nombra en un escenario o prueba, pero el SPEC no lo define.`,
    ),
  ];
  blocks.push(
    gaps.length > 0
      ? { t: "bullets", items: gaps }
      : { t: "p", text: "Todos los criterios tienen escenario y prueba." },
  );
  return blocks;
}

function umlSection(r: ReportInput): Block[] {
  const blocks: Block[] = [
    { t: "h1", text: "5. Modelo UML" },
    {
      t: "p",
      text: "Los 14 diagramas salen de los datos reales del proyecto. Si faltan los datos, el diagrama figura como «no aplica» con el motivo: no se inventa contenido.",
    },
    {
      t: "table",
      columns: ["N.º", "Diagrama", "Estado", "Fuente de datos"],
      rows: r.diagrams.map((d) => [
        String(d.numero),
        d.tipo,
        d.estado === "ok" ? "generado" : "no aplica",
        d.fuente,
      ]),
    },
  ];
  for (const d of r.diagrams.filter((x) => x.estado === "ok")) {
    const figure = r.figures.get(d.numero);
    if (figure) blocks.push({ t: "diagram", figure });
  }
  const missing = r.diagrams.filter((d) => d.estado === "no-aplica");
  if (missing.length > 0) {
    blocks.push({ t: "h2", text: "Diagramas que no aplican" });
    blocks.push({
      t: "bullets",
      items: missing.map((d) => `${d.numero}. ${d.tipo}: ${d.motivo ?? ""}`),
    });
  }
  return blocks;
}

function architectureSection(r: ReportInput): Block[] {
  const { input } = r;
  const { graph, ctx, data } = input;
  const blocks: Block[] = [{ t: "h1", text: "6. Arquitectura del código y mapa de riesgo" }];
  if (!graph) {
    blocks.push({
      t: "p",
      text: "El proveedor de código configurado (gitnexus) no expone el grafo: esta sección necesita codeIntel: native.",
    });
    return blocks;
  }
  const files = sourceFiles(graph);
  const kinds = new Map<string, number>();
  for (const n of graph.nodes) {
    if (isTestPath(n.file) || n.kind === "file") continue;
    kinds.set(n.kind, (kinds.get(n.kind) ?? 0) + 1);
  }
  blocks.push({
    t: "p",
    text: `El índice cubre ${files.length} archivo(s) de código (sin contar pruebas): ${
      [...kinds]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${v} ${k}`)
        .join(", ") || "sin símbolos"
    }. Solo se indexa TypeScript y JavaScript.`,
  });

  const group = (f: string): string => componentOf(f, ctx.config);
  const sizes = new Map<string, number>();
  for (const f of files) sizes.set(group(f), (sizes.get(group(f)) ?? 0) + 1);
  const links = [...groupedLinks(graph, "IMPORTS", group).values()];
  if (sizes.size > 0) {
    blocks.push({ t: "h2", text: "Componentes" });
    blocks.push({
      t: "table",
      columns: ["Componente", "Archivos", "Depende de", "Lo usan"],
      rows: [...sizes]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => [
          name,
          String(count),
          links
            .filter((l) => l.from === name)
            .map((l) => l.to)
            .sort()
            .join(", ") || "—",
          links
            .filter((l) => l.to === name)
            .map((l) => l.from)
            .sort()
            .join(", ") || "—",
        ]),
    });
  }

  blocks.push({ t: "h2", text: "Mapa de riesgo" });
  if (!data.riesgo.disponible) {
    blocks.push({ t: "p", text: `No disponible: ${data.riesgo.motivo ?? "sin motivo"}` });
  } else {
    blocks.push({
      t: "p",
      muted: true,
      text: "Riesgo = archivos que dependen de él (transitivamente) × la parte de sus funciones y clases sin prueba. Se muestran los 15 primeros.",
    });
    blocks.push({
      t: "table",
      columns: ["Archivo", "Riesgo", "Alcance", "Con prueba"],
      rows: data.riesgo.archivos
        .slice(0, 15)
        .map((f) => [
          f.archivo,
          String(f.riesgo),
          String(f.alcance),
          `${f.cubiertas}/${f.unidades}`,
        ]),
    });
  }
  return blocks;
}

function decisionsSection(r: ReportInput): Block[] {
  const { ctx, journal } = r.input;
  const blocks: Block[] = [{ t: "h1", text: "7. Decisiones y lecciones" }];

  const adrs = matchFiles("docs/adr/*.md", ctx.root).map((rel) => {
    const text = readFileSync(join(ctx.root, rel), "utf8");
    const title = /^#\s+(.+)$/m.exec(text)?.[1] ?? basename(rel);
    return `${rel}: ${oneLine(title, 100)}`;
  });
  blocks.push({ t: "h2", text: "Decisiones de arquitectura (ADR)" });
  blocks.push(
    adrs.length > 0 ? { t: "bullets", items: adrs } : { t: "p", text: "No hay ADR en docs/adr." },
  );

  const lessons = readLessons(ctx.root);
  blocks.push({ t: "h2", text: "Lecciones aprendidas" });
  blocks.push(
    lessons.length > 0
      ? {
          t: "bullets",
          items: lessons.map(
            (l) => `${oneLine(l.titulo, 90)}${l.texto ? ` — ${oneLine(l.texto, 160)}` : ""}`,
          ),
        }
      : { t: "p", text: "Todavía no hay lecciones en lecciones.md." },
  );

  const memory = new Map<string, number>();
  for (const e of journal) {
    if (e.type === "memory-add") {
      const kind = typeof e["tipo"] === "string" ? e["tipo"] : "otro";
      memory.set(kind, (memory.get(kind) ?? 0) + 1);
    }
  }
  blocks.push({
    t: "p",
    muted: true,
    text: `Entradas guardadas en la memoria del proyecto: ${
      memory.size === 0
        ? "ninguna registrada en el diario"
        : [...memory].map(([k, v]) => `${v} de tipo ${k}`).join(", ")
    }. El contenido de la memoria de MemPalace no se incluye en este informe.`,
  });
  return blocks;
}

function annexSection(r: ReportInput): Block[] {
  const { ctx } = r.input;
  const blocks: Block[] = [{ t: "h1", text: "8. Anexos" }];
  blocks.push({ t: "h2", text: "Inventario de artefactos de la fase actual" });
  if (ctx.state.currentPhase === "done") {
    blocks.push({ t: "p", text: "El pipeline terminó: no hay una fase actual." });
  } else {
    const artifacts = Object.entries(currentArtifacts(ctx, ctx.state.currentPhase)).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    blocks.push({
      t: "table",
      columns: ["Artefacto", "SHA-256"],
      rows: artifacts.map(([path, hash]) => [path, `${hash.slice(0, 32)}…`]),
    });
  }
  const diagrams = r.diagrams.filter((d) => d.svg !== null);
  if (diagrams.length > 0) {
    blocks.push({ t: "h2", text: "Archivos de los diagramas" });
    blocks.push({
      t: "table",
      columns: ["Diagrama", "SHA-256 del SVG"],
      rows: diagrams.map((d) => [`${d.numero}. ${d.tipo}`, `${sha256(d.svg ?? "").slice(0, 32)}…`]),
    });
  }
  blocks.push({
    t: "p",
    muted: true,
    text: `Generado con evol-driven ${packageVersion()} el ${r.date}.`,
  });
  return blocks;
}

export function buildReport(r: ReportInput): ReportDoc {
  const { data } = r.input;
  const state =
    data.pipeline.fase === "done"
      ? "pipeline terminado"
      : (APPROVAL_TEXT[data.pipeline.aprobacion.estado] ?? data.pipeline.aprobacion.estado);
  const blocks: Block[] = [
    {
      t: "cover",
      brand: r.brand.name,
      title: "Informe de proyecto",
      subtitle: data.proyecto.nombre,
      lines: [
        `Fase: ${data.pipeline.fase === "done" ? "pipeline terminado" : data.pipeline.fase}`,
        `Estado: ${state}`,
        `Fecha: ${r.date}`,
        `evol-driven ${data.evol.version}`,
      ],
    },
    { t: "pagebreak" },
    { t: "toc" },
    { t: "pagebreak" },
    ...summary(r),
    ...pipelineSection(r),
    ...disciplinesSection(r),
    ...traceabilitySection(r),
    { t: "pagebreak" },
    ...umlSection(r),
    { t: "pagebreak" },
    ...architectureSection(r),
    ...decisionsSection(r),
    ...annexSection(r),
  ];
  return {
    title: `Informe de proyecto — ${data.proyecto.nombre}`,
    project: data.proyecto.nombre,
    brand: r.brand,
    date: r.date,
    blocks,
  };
}
