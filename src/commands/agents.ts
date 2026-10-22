import { writeAgentFiles } from "../agents/files.js";
import type { AgentReport } from "../agents/files.js";
import { out, requireProject } from "./shared.js";

export function printAgentReport(report: AgentReport): void {
  for (const f of report.created) out(`  + ${f}`);
  for (const f of report.updated) out(`  ~ ${f} (actualizado)`);
  for (const f of report.unchanged) out(`  = ${f} (sin cambios)`);
  for (const s of report.skipped) out(`  ! ${s.file}: ${s.reason}`);
}

export default function run(): Promise<number> {
  const root = requireProject();
  out("Integración con agentes (Claude Code y clientes MCP):");
  printAgentReport(writeAgentFiles(root));
  out("Para Hermes: hermes mcp add evol --command evol --args mcp");
  return Promise.resolve(0);
}
