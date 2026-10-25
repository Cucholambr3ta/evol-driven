import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { loadContext } from "../core/pipeline.js";
import { generateReport, REPORT_FORMATS } from "../report/index.js";
import type { ReportFormat } from "../report/index.js";
import { out, requireProject } from "./shared.js";

export const USAGE =
  "Uso: evol report [--formato docx|pdf|ambos|md] [--salida <carpeta>] [--entrada <símbolo>] [--componente <nombre>]";

export default function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      formato: { type: "string" },
      salida: { type: "string" },
      entrada: { type: "string" },
      componente: { type: "string" },
    },
  });
  const formato = (values.formato ?? "ambos") as ReportFormat;
  if (!REPORT_FORMATS.includes(formato)) {
    throw new UserError(`--formato debe ser uno de: ${REPORT_FORMATS.join(", ")}.\n${USAGE}`);
  }
  const root = requireProject();
  const ctx = loadContext(root);
  const result = generateReport(ctx, {
    formato,
    salida: resolve(root, values.salida ?? "informe"),
    ...(values.entrada ? { entrada: values.entrada } : {}),
    ...(values.componente ? { componente: values.componente } : {}),
  });
  for (const file of result.archivos) out(`Informe: ${file}`);
  out(
    `Diagramas: ${result.diagramas.generados} generados, ${result.diagramas.noAplican} no aplican (ver la sección 5).`,
  );
  if (result.paginas !== null) out(`Páginas: ${result.paginas}`);
  return Promise.resolve(0);
}
