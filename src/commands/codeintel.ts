import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, parseConfig } from "../core/config.js";
import type { EvolConfig } from "../core/config.js";
import { loadDisciplines } from "../core/disciplines.js";
import { UserError } from "../core/errors.js";
import { CONFIG_FILE, findProjectRoot } from "../core/paths.js";
import { createProvider, ProviderUnavailableError } from "../codeintel/index.js";
import { indexProject } from "../codeintel/native/indexer.js";
import { out } from "./shared.js";

function context(): { root: string; config: EvolConfig } {
  const root = findProjectRoot() ?? process.cwd();
  const config = existsSync(join(root, CONFIG_FILE))
    ? loadConfig(root, loadDisciplines().ids())
    : parseConfig({
        name: "sin-proyecto",
        version: 1,
        memory: { wing: "sin_proyecto", enabled: false },
        modules: [{ name: "app", disciplinas: [] }],
      });
  return { root, config };
}

export async function runIndex(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { full: { type: "boolean" } } });
  const { root } = context();
  const report = indexProject(root, { full: values.full === true });
  out(`Archivos: ${report.total} (${report.unchanged} sin cambios)`);
  out(
    `Reindexados: ${report.reindexed.length}${report.reindexed.length ? ` → ${report.reindexed.join(", ")}` : ""}`,
  );
  if (report.cascaded.length) out(`Reprocesados por dependencia: ${report.cascaded.join(", ")}`);
  if (report.removed.length) out(`Eliminados del grafo: ${report.removed.join(", ")}`);
  out(`Grafo: ${report.stats.nodes} nodos, ${report.stats.edges} relaciones`);
  out(`Símbolos modificados sin commitear: ${report.modified}`);
  return 0;
}

async function query(kind: "impact" | "trace", argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { depth: { type: "string" }, json: { type: "boolean" } },
  });
  const target = positionals[0];
  if (!target) throw new UserError(`Uso: evol ${kind} <símbolo> [--depth N] [--json]`);
  const maxDepth = values.depth ? Number(values.depth) : undefined;
  if (maxDepth !== undefined && (!Number.isInteger(maxDepth) || maxDepth < 1)) {
    throw new UserError("--depth debe ser un entero positivo.");
  }
  const { root, config } = context();
  const provider = createProvider(config, root);
  const availability = await provider.available();
  if (!availability.ok) throw new ProviderUnavailableError(provider.name, availability.detail);
  const options = maxDepth === undefined ? {} : { maxDepth };

  if (kind === "impact") {
    const result = await provider.impact(target, options);
    if (values.json) out(JSON.stringify(result, null, 2));
    else {
      out(`Impacto de ${result.target.id} (${result.target.kind}) — proveedor ${provider.name}`);
      if (result.raw) out(result.raw);
      else if (result.dependents.length === 0) out("  Nada depende de él.");
      for (const d of result.dependents)
        out(`  ${"  ".repeat(d.depth - 1)}${d.depth}. ${d.id} (${d.kind}, ${d.via})`);
    }
  } else {
    const result = await provider.trace(target, options);
    if (values.json) out(JSON.stringify(result, null, 2));
    else {
      out(`Traza desde ${result.entry.id} — proveedor ${provider.name}`);
      if (result.raw) out(result.raw);
      else if (result.steps.length === 0) out("  No llama a nada del proyecto.");
      for (const s of result.steps)
        out(`  ${"  ".repeat(s.depth - 1)}${s.depth}. ${s.id} (${s.kind})`);
    }
  }
  return 0;
}

export const runImpact = (argv: string[]): Promise<number> => query("impact", argv);
export const runTrace = (argv: string[]): Promise<number> => query("trace", argv);
