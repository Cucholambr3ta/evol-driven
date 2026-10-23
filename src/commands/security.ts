import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { AREAS, location } from "../security/model.js";
import type { Area } from "../security/model.js";
import { blockers, count, scan, writeQaReport, writeResult } from "../security/scan.js";
import { out, requireProject } from "./shared.js";

const USAGE = "Uso: evol security scan [--solo <secretos|codigo|dependencias>] [--ci] [--json]";

const STATE: Record<string, string> = {
  ok: "✓",
  falta: "× falta",
  fallo: "× falló",
  "no-aplica": "—",
};

export default async function run(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  if (sub !== "scan") throw new UserError(USAGE);
  const { values } = parseArgs({
    args: rest,
    options: {
      solo: { type: "string" },
      ci: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
  });
  let areas: readonly Area[] = AREAS;
  if (values.solo !== undefined) {
    if (!AREAS.includes(values.solo as Area))
      throw new UserError(`Área desconocida «${values.solo}». ${USAGE}`);
    areas = [values.solo as Area];
  }

  const root = requireProject();
  const result = scan(root, areas);
  writeResult(root, result);
  // a partial scan (--solo) must not wipe the other areas out of the report
  if (areas.length === AREAS.length) writeQaReport(root, result);
  const reasons = blockers(result);

  if (values.json) {
    out(JSON.stringify({ ...result, bloqueos: reasons }, null, 2));
  } else {
    out(`Escaneo de seguridad (${result.areas.join(", ")})`);
    for (const t of result.herramientas)
      out(
        `  ${(STATE[t.estado] ?? t.estado).padEnd(8)} ${t.herramienta}${t.version ? ` ${t.version}` : ""}${t.red ? " (usa red)" : ""}${t.detalle ? ` — ${t.detalle}` : ""}`,
      );
    const n = count(result.abiertos);
    out("");
    out(
      `Abiertos: ${n.CRITICAL} CRITICAL, ${n.HIGH} HIGH, ${n.MEDIUM} MEDIUM, ${n.LOW} LOW. Ignorados vigentes: ${result.ignorados.length}.`,
    );
    for (const f of result.abiertos.slice(0, 30))
      out(`  ${f.severidad.padEnd(8)} ${f.herramienta} ${f.regla}  ${location(f)}`);
    if (result.abiertos.length > 30)
      out(`  … y ${result.abiertos.length - 30} más en .evol/qa/security/ultimo.json`);
    for (const aviso of result.avisos) out(`aviso: ${aviso}`);
    if (areas.length === AREAS.length) out("Resumen en .evol/qa/QA_REPORT.md");
  }

  if (values.ci && reasons.length > 0) {
    if (!values.json) for (const r of reasons) process.stderr.write(`bloqueo: ${r}\n`);
    return 1;
  }
  if (!values.ci && reasons.length > 0 && !values.json)
    for (const r of reasons) process.stderr.write(`aviso: ${r} (con --ci esto fallaría)\n`);
  return 0;
}
