import { parseArgs } from "node:util";
import { loadContext } from "../core/pipeline.js";
import { renderStatus, statusForAgents, statusReport } from "../core/status.js";
import { out, requireProject } from "./shared.js";

export default function run(argv: string[] = []): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { json: { type: "boolean" } } });
  const report = statusReport(loadContext(requireProject()));
  if (values.json) out(JSON.stringify(statusForAgents(report), null, 2));
  else for (const line of renderStatus(report)) out(line);
  return Promise.resolve(0);
}
