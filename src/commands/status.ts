import { parseArgs } from "node:util";
import { loadContext } from "../core/pipeline.js";
import { renderStatus, renderStatusLine, statusForAgents, statusReport } from "../core/status.js";
import { out, requireProject } from "./shared.js";

export default function run(argv: string[] = []): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { json: { type: "boolean" }, linea: { type: "boolean" } },
  });
  if (values.linea) {
    // a status line runs on every prompt: never let it throw a wall of text into the IDE's bar
    try {
      out(renderStatusLine(statusReport(loadContext(requireProject()))));
    } catch {
      out("Evol");
    }
    return Promise.resolve(0);
  }
  const report = statusReport(loadContext(requireProject()));
  if (values.json) out(JSON.stringify(statusForAgents(report), null, 2));
  else for (const line of renderStatus(report)) out(line);
  return Promise.resolve(0);
}
