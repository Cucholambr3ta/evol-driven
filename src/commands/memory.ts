import { parseArgs } from "node:util";
import { loadConfig } from "../core/config.js";
import { loadDisciplines } from "../core/disciplines.js";
import { UserError } from "../core/errors.js";
import { appendLesson, isMemoryKind, remember } from "../memory/events.js";
import { withMemPalace } from "../memory/mempalace.js";
import { journalAppend } from "../core/journal.js";
import { out, requireProject } from "./shared.js";

export const USAGE = [
  "Uso:",
  '  evol memory add --tipo <decision|leccion|contexto> --texto "..." [--titulo "..."]',
  '  evol memory search "consulta" [--limit N] [--sala <sala>]',
].join("\n");

export default async function run(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  const root = requireProject();
  const config = loadConfig(root, loadDisciplines());

  if (sub === "add") {
    const { values } = parseArgs({
      args: rest,
      options: { tipo: { type: "string" }, texto: { type: "string" }, titulo: { type: "string" } },
    });
    const tipo = values.tipo ?? "contexto";
    if (!isMemoryKind(tipo) || tipo === "aprobacion" || tipo === "pipeline") {
      throw new UserError(`Tipo no válido: «${tipo}».\n${USAGE}`);
    }
    if (!values.texto?.trim()) throw new UserError(`Falta --texto.\n${USAGE}`);
    const text = values.texto.trim();
    if (tipo === "leccion") appendLesson(root, values.titulo?.trim() || text.slice(0, 60), text);
    let id: string;
    try {
      id = await remember(config, tipo, values.titulo ? `${values.titulo}\n\n${text}` : text);
    } catch (error) {
      if (tipo === "leccion") {
        throw new UserError(
          `${(error as Error).message}\nLa lección sí quedó escrita en lecciones.md.`,
        );
      }
      throw error;
    }
    journalAppend(root, "memory-add", { tipo, drawer: id });
    out(
      `Guardado en MemPalace (wing «${config.memory.wing}», sala «${tipo}»)${id ? `: ${id}` : ""}.`,
    );
    return 0;
  }

  if (sub === "search") {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: { limit: { type: "string" }, sala: { type: "string" } },
    });
    const query = positionals.join(" ").trim();
    if (!query) throw new UserError(`Falta la consulta.\n${USAGE}`);
    const limit = values.limit ? Number(values.limit) : 5;
    if (!Number.isInteger(limit) || limit < 1)
      throw new UserError("--limit debe ser un entero positivo.");
    const hits = await withMemPalace((m) =>
      m.search({
        query,
        wing: config.memory.wing,
        limit,
        ...(values.sala ? { room: values.sala } : {}),
      }),
    );
    if (hits.length === 0) {
      out("Sin resultados.");
      return 0;
    }
    for (const hit of hits) {
      out(
        `[${hit.room}]${hit.score !== undefined ? ` (${hit.score.toFixed(3)})` : ""} ${hit.text.replace(/\s+/g, " ").slice(0, 300)}`,
      );
    }
    return 0;
  }

  throw new UserError(USAGE);
}
