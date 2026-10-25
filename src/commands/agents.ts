import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { BackupCollector, restoreBackup } from "../agents/backup.js";
import { emptyReport, runAgentFiles } from "../agents/files.js";
import type { AgentReport, WriteCtx } from "../agents/files.js";
import {
  adapterById,
  CLAUDE_CODE,
  IDE_IDS,
  OTHER_ADAPTERS,
  writeAdapterFiles,
  writeAgentsMd,
  writeOpencodeAgent,
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

  // One backup for the whole run, Claude Code and the auto-detected opencode.json together:
  // `evol agents --deshacer` undoes everything a single `evol agents` touched, not just the last file.
  const backup = dry ? undefined : new BackupCollector();
  const ctx = (): WriteCtx => ({ report: emptyReport(), dry, backup });

  if (wanted.includes("claude-code")) {
    out(`${CLAUDE_CODE.nombre} (nivel ${CLAUDE_CODE.nivel}; entrada: ${CLAUDE_CODE.entrada}):`);
    printAgentReport(runAgentFiles(root, ctx()));
    out(`  Bloqueo de aprobar y avanzar: ${CLAUDE_CODE.proteccion.detalle}.`);
  }

  // Igual que Claude Code arriba, pero por detección (ya tiene opencode.json), no por --ide: así
  // un proyecto que ya usa OpenCode lo recibe con «evol agents» a secas, sin pedir --ide opencode.
  if (existsSync(join(root, "opencode.json"))) {
    const opencodeCtx = ctx();
    writeOpencodeAgent(root, opencodeCtx);
    if (opencodeCtx.report.created.length + opencodeCtx.report.updated.length > 0) {
      out("Agente «evol» en OpenCode (opencode.json del proyecto):");
      printAgentReport(opencodeCtx.report);
    }
  }

  const others = wanted.filter((id) => id !== "claude-code");
  if (dry && others.length > 0) {
    out(
      "(--dry-run cubre Claude Code y el opencode.json del proyecto; los demás archivos de --ide no se tocaron)",
    );
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
  if (!dry && backup && !backup.empty) backup.save(root);
  if (dry) out("(ensayo: no se escribió ningún archivo)");
  out(
    "Lo que está marcado con → vive en archivos tuyos o en formatos por confirmar: evol no los edita, aplícalo a mano. Las skills (roles y disciplinas) no se instalan aquí: entran por la auditoría y tu aprobación.",
  );
  return Promise.resolve(0);
}
