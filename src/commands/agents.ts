import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { restoreBackup } from "../agents/backup.js";
import { planAgentFiles, writeAgentFiles } from "../agents/files.js";
import type { AgentReport } from "../agents/files.js";
import {
  adapterById,
  CLAUDE_CODE,
  IDE_IDS,
  OTHER_ADAPTERS,
  writeAdapterFiles,
  writeAgentsMd,
} from "../agents/adapters.js";
import type { Adapter, AdapterReport, IdeId } from "../agents/adapters.js";
import { out, requireProject } from "./shared.js";

export function printAgentReport(report: AgentReport | AdapterReport): void {
  for (const f of report.created) out(`  + ${f}`);
  for (const f of report.updated) out(`  ~ ${f} (actualizado)`);
  for (const f of report.unchanged) out(`  = ${f} (sin cambios)`);
  for (const s of report.skipped) out(`  ! ${s.file}: ${s.reason}`);
}

export const USAGE = `Uso: evol agents [--ide <${IDE_IDS.join("|")}|all>] [--dry-run] | evol agents --deshacer [id]`;

function printAdapter(root: string, adapter: Adapter): void {
  out(`${adapter.nombre} (nivel ${adapter.nivel}; entrada: ${adapter.entrada}):`);
  printAgentReport(writeAdapterFiles(root, adapter));
  for (const f of adapter.fragmentos()) {
    out(`  → ${f.archivo}`);
    for (const line of f.texto.split("\n")) out(`      ${line}`);
    out(`      ${f.nota}`);
  }
  out(`  Bloqueo de aprobar y avanzar: ${adapter.proteccion.detalle}.`);
  if (adapter.proteccion.soloLectura === "solo-instruccion")
    out(
      "  Los subagentes de solo lectura solo lo son por instrucción en este IDE: no hay forma de imponerlo.",
    );
}

export default function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      ide: { type: "string" },
      "dry-run": { type: "boolean" },
      deshacer: { type: "boolean" },
    },
  });

  if (values.deshacer === true) {
    const root = requireProject();
    const result = restoreBackup(root, positionals[0]);
    out(`Deshecho el respaldo ${result.id}:`);
    for (const f of result.restaurados) out(`  ~ ${f} (restaurado)`);
    for (const f of result.manual)
      out(`  ! ${f}: cambió desde que evol lo escribió; no se tocó, deshazlo a mano si hace falta`);
    return Promise.resolve(0);
  }

  const dry = values["dry-run"] === true;
  const choice = values.ide ?? "claude-code";
  if (choice !== "all" && !IDE_IDS.includes(choice as IdeId))
    throw new UserError(`IDE desconocido «${choice}». ${USAGE}`);
  const root = requireProject();
  const wanted = choice === "all" ? IDE_IDS : [choice as IdeId];

  if (wanted.includes("claude-code")) {
    out(`${CLAUDE_CODE.nombre} (nivel ${CLAUDE_CODE.nivel}; entrada: ${CLAUDE_CODE.entrada}):`);
    printAgentReport(dry ? planAgentFiles(root) : writeAgentFiles(root));
    out(`  Bloqueo de aprobar y avanzar: ${CLAUDE_CODE.proteccion.detalle}.`);
  }
  const others = wanted.filter((id) => id !== "claude-code");
  if (dry && others.length > 0) {
    out("(--dry-run solo cubre Claude Code por ahora; no se tocó nada de los demás IDE)");
  } else {
    if (others.length > 0) {
      out("Instrucciones para los demás IDE (AGENTS.md):");
      printAgentReport(writeAgentsMd(root));
    }
    for (const id of others) {
      const adapter = adapterById(id) ?? OTHER_ADAPTERS[0];
      if (adapter) printAdapter(root, adapter);
    }
  }
  if (dry) out("(ensayo: no se escribió ningún archivo)");
  out(
    "Lo que está marcado con → vive en archivos tuyos o en formatos por confirmar: evol no los edita, aplícalo a mano. Las skills (roles y disciplinas) no se instalan aquí: entran por la auditoría y tu aprobación.",
  );
  return Promise.resolve(0);
}
