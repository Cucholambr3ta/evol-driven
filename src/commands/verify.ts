import { parseArgs } from "node:util";
import { verification } from "../core/orchestration.js";
import { loadContext } from "../core/pipeline.js";
import { out, requireProject } from "./shared.js";

export default async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { inicio: { type: "boolean" }, json: { type: "boolean" } },
  });
  const result = await verification(
    loadContext(requireProject()),
    values.inicio ? "inicio" : "fin",
  );
  if (values.json) out(JSON.stringify(result, null, 2));
  else {
    out(
      `${result.veredicto} — ${result.momento === "inicio" ? "inicio" : "fin"} de «${result.fase}»`,
    );
    for (const p of result.problemas)
      out(`  ${p.nivel === "aviso" ? "!" : "×"} [${p.modulo}/${p.disciplina}] ${p.mensaje}`);
  }
  // a warning does not stop anything: only a block makes the command fail
  return result.listo ? 0 : 1;
}
