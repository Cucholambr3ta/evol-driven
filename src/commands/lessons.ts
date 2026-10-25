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
import { lessonsOf } from "../core/orchestration.js";
import { withMemPalace } from "../memory/mempalace.js";
import { out, requireProject } from "./shared.js";

export const USAGE =
  "Uso: evol lessons check [--umbral 0-1] [--estricto] [--json]   |   evol lessons list [--buscar <palabras>] [--json]";

export default async function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      umbral: { type: "string" },
      estricto: { type: "boolean" },
      json: { type: "boolean" },
      buscar: { type: "string" },
    },
  });
  if (positionals[0] === "list") {
    const found = lessonsOf(requireProject(), values.buscar);
    if (values.json) out(JSON.stringify(found, null, 2));
    else if (found.lecciones.length === 0)
      out(
        found.total === 0
          ? "El proyecto no tiene lecciones escritas."
          : "Ninguna lección coincide.",
      );
    else for (const l of found.lecciones) out(`- ${l.titulo}${l.fecha ? ` (${l.fecha})` : ""}`);
    return 0;
  }
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
