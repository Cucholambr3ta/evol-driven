import { join, resolve } from "node:path";
import { GRAPH_FILE, indexProject, isTestPath } from "../codeintel/native/indexer.js";
import { GraphStore } from "../codeintel/native/store.js";
import type { EvolConfig } from "./config.js";
import { UserError } from "./errors.js";

export interface RiskEntry {
  archivo: string;
  /** Distinct project files that depend on this one, transitively (tests excluded). */
  alcance: number;
  /** Functions and classes that can have a test. */
  unidades: number;
  cubiertas: number;
  /** alcance × (1 − cubiertas/unidades). */
  riesgo: number;
}

const DEPENDENCY_KINDS = ["IMPORTS", "CALLS", "EXTENDS"] as const;
const MAX_DEPTH = 50;

/** Files ranked by how much depends on them and how little of them a test reaches. */
export function riskReport(root: string, config: EvolConfig): RiskEntry[] {
  if (config.codeIntel !== "native") {
    throw new UserError(
      "evol risk solo está disponible con el indexador nativo (codeIntel: native).",
    );
  }
  indexProject(root);
  const store = new GraphStore(join(resolve(root), GRAPH_FILE));
  try {
    const entries: RiskEntry[] = [];
    for (const { path } of store.files()) {
      if (isTestPath(path)) continue;
      const symbols = store.nodesInRanges(path);
      const seeds = [path, ...symbols.map((s) => s.id)];
      const reach = new Set<string>();
      for (const dep of store.dependents(seeds, [...DEPENDENCY_KINDS], MAX_DEPTH)) {
        const file = dep.id.split("#")[0] ?? dep.id;
        if (file !== path && !isTestPath(file)) reach.add(file);
      }

      const units = symbols.filter((s) => s.kind === "function" || s.kind === "class");
      const covered = units.filter(
        (u) =>
          store.hasIncoming(u.id, "TESTS") ||
          store.children(u.id).some((child) => store.hasIncoming(child, "TESTS")),
      ).length;
      const gap = units.length === 0 ? 0 : 1 - covered / units.length;
      entries.push({
        archivo: path,
        alcance: reach.size,
        unidades: units.length,
        cubiertas: covered,
        riesgo: Math.round(reach.size * gap * 100) / 100,
      });
    }
    return entries.sort(
      (a, b) => b.riesgo - a.riesgo || b.alcance - a.alcance || a.archivo.localeCompare(b.archivo),
    );
  } finally {
    store.close();
  }
}

export function renderRisk(entries: RiskEntry[]): string[] {
  if (entries.length === 0) return ["No hay archivos de código indexados."];
  const width = Math.max(...entries.map((e) => e.archivo.length));
  return [
    `${"archivo".padEnd(width)}  riesgo  alcance  cubiertas`,
    ...entries.map(
      (e) =>
        `${e.archivo.padEnd(width)}  ${String(e.riesgo).padStart(6)}  ${String(e.alcance).padStart(7)}  ${e.cubiertas}/${e.unidades}`,
    ),
  ];
}
