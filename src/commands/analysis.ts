import { parseArgs } from "node:util";
import { coverageReport, renderCoverage } from "../core/coverage.js";
import { buildExport } from "../core/export.js";
import { UserError } from "../core/errors.js";
import { loadContext } from "../core/pipeline.js";
import { renderRisk, riskReport } from "../core/risk.js";
import { out, requireProject } from "./shared.js";

export function runCoverage(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { json: { type: "boolean" }, estricto: { type: "boolean" } },
  });
  const report = coverageReport(loadContext(requireProject()));
  if (values.json) out(JSON.stringify(report, null, 2));
  else for (const line of renderCoverage(report)) out(line);
  const gaps = report.sinEscenario.length + report.sinPrueba.length > 0;
  return Promise.resolve(values.estricto && gaps ? 1 : 0);
}

export function runRisk(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { json: { type: "boolean" }, top: { type: "string" } },
  });
  const top = values.top === undefined ? undefined : Number(values.top);
  if (top !== undefined && (!Number.isInteger(top) || top < 1)) {
    throw new UserError("--top debe ser un entero positivo.");
  }
  const ctx = loadContext(requireProject());
  const entries = riskReport(ctx.root, ctx.config).slice(0, top);
  if (values.json) out(JSON.stringify(entries, null, 2));
  else for (const line of renderRisk(entries)) out(line);
  return Promise.resolve(0);
}

export function runExport(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { json: { type: "boolean" } } });
  const data = buildExport(loadContext(requireProject()));
  if (values.json) {
    out(JSON.stringify(data, null, 2));
    return Promise.resolve(0);
  }
  out(`Proyecto ${data.proyecto.nombre}, fase ${data.pipeline.fase} (esquema ${data.schema}).`);
  out(
    `${data.cobertura.criterios.length} criterio(s), ${data.aprobaciones.entradas.length} aprobación(es), ${data.riesgo.archivos.length} archivo(s) analizados.`,
  );
  out("Usa --json para obtener el conjunto de datos completo.");
  return Promise.resolve(0);
}
