import { loadContext } from "../core/pipeline.js";
import { renderStatus, statusReport } from "../core/status.js";
import { out, requireProject } from "./shared.js";

export default function run(): Promise<number> {
  const ctx = loadContext(requireProject());
  for (const line of renderStatus(statusReport(ctx))) out(line);
  return Promise.resolve(0);
}
