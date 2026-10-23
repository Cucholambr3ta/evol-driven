import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { prerequisites } from "../core/orchestration.js";
import { isPhase } from "../core/phases.js";
import { loadContext } from "../core/pipeline.js";
import { out, requireProject } from "./shared.js";

export default function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { fase: { type: "string" }, json: { type: "boolean" } },
  });
  if (values.fase !== undefined && !isPhase(values.fase))
    throw new UserError(
      `«${values.fase}» no es una fase. Las fases son: briefing, spec, plan, build, qa, retro.`,
    );
  const report = prerequisites(loadContext(requireProject()), values.fase);
  if (values.json) out(JSON.stringify(report, null, 2));
  else if (report.listo)
    out(
      report.anterior === null
        ? `«${report.fase}» no depende de ninguna fase anterior.`
        : `Nada falta de «${report.anterior}»: se puede trabajar en «${report.fase}».`,
    );
  else {
    out(`Faltan cosas de «${report.anterior}» antes de trabajar en «${report.fase}»:`);
    for (const m of report.faltan)
      out(`  - [${m.modulo}/${m.disciplina}] ${m.artefacto}: ${m.detalle}`);
  }
  return Promise.resolve(report.listo ? 0 : 1);
}
