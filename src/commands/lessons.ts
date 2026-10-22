import { parseArgs } from "node:util";
import { loadConfig } from "../core/config.js";
import { loadDisciplines } from "../core/disciplines.js";
import { UserError } from "../core/errors.js";
import {
  checkLessons,
  DEFAULT_THRESHOLD,
  readLessons,
  renderLessonCheck,
} from "../core/lessons.js";
import { withMemPalace } from "../memory/mempalace.js";
import { out, requireProject } from "./shared.js";

const USAGE = "Uso: evol lessons check [--umbral 0-1] [--estricto] [--json]";

export default async function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      umbral: { type: "string" },
      estricto: { type: "boolean" },
      json: { type: "boolean" },
    },
  });
  if (positionals[0] !== "check") throw new UserError(USAGE);
  const threshold = values.umbral === undefined ? DEFAULT_THRESHOLD : Number(values.umbral);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new UserError("--umbral debe ser un número entre 0 y 1.");
  }

  const root = requireProject();
  const config = loadConfig(root, loadDisciplines());
  const lessons = readLessons(root);
  // Without lessons there is nothing to ask, so MemPalace is not needed.
  const matches =
    lessons.length === 0
      ? []
      : await withMemPalace((memory) =>
          checkLessons(lessons, (query) => memory.search({ query, room: "lecciones", limit: 20 }), {
            ownWing: config.memory.wing,
            threshold,
          }),
        );

  if (values.json) out(JSON.stringify(matches, null, 2));
  else for (const line of renderLessonCheck(matches)) out(line);
  const repeated = matches.some((m) => m.repetidas.length > 0);
  return values.estricto && repeated ? 1 : 0;
}
