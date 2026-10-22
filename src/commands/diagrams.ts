import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { loadContext } from "../core/pipeline.js";
import { DIAGRAM_COUNT, diagramFileName, generateDiagrams } from "../diagrams/index.js";
import { rasterize } from "../diagrams/raster.js";
import { out, requireProject } from "./shared.js";

const USAGE =
  "Uso: evol diagrams [--salida <carpeta>] [--solo 1,3,7] [--entrada <símbolo>] [--componente <nombre>] [--png] [--json]";

function parseOnly(value: string | undefined): number[] | undefined {
  if (value === undefined) return undefined;
  const numbers = value.split(",").map((s) => Number(s.trim()));
  if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > DIAGRAM_COUNT)) {
    throw new UserError(`--solo admite números del 1 al ${DIAGRAM_COUNT}, separados por comas.`);
  }
  return [...new Set(numbers)].sort((a, b) => a - b);
}

export default function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      salida: { type: "string" },
      solo: { type: "string" },
      entrada: { type: "string" },
      componente: { type: "string" },
      png: { type: "boolean" },
      json: { type: "boolean" },
    },
  });
  if (values.salida === "") throw new UserError(USAGE);
  const only = parseOnly(values.solo);
  const root = requireProject();
  const ctx = loadContext(root);
  const diagrams = generateDiagrams(ctx, {
    ...(only ? { only } : {}),
    ...(values.entrada ? { entrada: values.entrada } : {}),
    ...(values.componente ? { componente: values.componente } : {}),
  });

  const dir = resolve(root, values.salida ?? ".evol/diagramas");
  mkdirSync(dir, { recursive: true });
  const written: Record<number, string> = {};
  for (const d of diagrams) {
    if (!d.svg) continue;
    const file = join(dir, diagramFileName(d));
    writeFileSync(file, d.svg);
    written[d.numero] = file;
    if (values.png) rasterize(file, file.replace(/\.svg$/, ".png"));
  }

  if (values.json) {
    out(
      JSON.stringify(
        diagrams.map(({ svg: _svg, ...rest }) => ({
          ...rest,
          archivo: written[rest.numero] ?? null,
        })),
        null,
        2,
      ),
    );
    return Promise.resolve(0);
  }
  for (const d of diagrams) {
    const label = `${String(d.numero).padStart(2)}  ${d.tipo.padEnd(22)}`;
    if (d.estado === "ok")
      out(`${label} ✓ ${written[d.numero]}${d.nota ? `\n      nota: ${d.nota}` : ""}`);
    else out(`${label} — no aplica: ${d.motivo}`);
  }
  return Promise.resolve(0);
}
