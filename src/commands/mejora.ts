import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { findProjectRoot } from "../core/paths.js";
import { addImprovement, closeImprovement, inboxFile, readInbox } from "../improve/inbox.js";
import { versionInfo } from "../release/version.js";
import { basename } from "node:path";
import { out } from "./shared.js";

const USAGE = `Uso: evol mejora <add "texto" [--evidencia "…"] | list [--todas] [--json] | hecha <id> [--nota "…"] | descartar <id> [--nota "…"]>`;

export default function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      evidencia: { type: "string" },
      nota: { type: "string" },
      todas: { type: "boolean" },
      json: { type: "boolean" },
    },
  });
  const [action, ...rest] = positionals;
  switch (action) {
    case "add": {
      const root = findProjectRoot();
      const entry = addImprovement({
        texto: rest.join(" "),
        proyecto: root ? basename(root) : null,
        versionEvol: versionInfo().version,
        ...(values.evidencia ? { evidencia: values.evidencia } : {}),
      });
      out(
        `Anotada ${entry.id}. No se cambió nada: se atiende desde el origen del framework (evol mejora list).`,
      );
      return Promise.resolve(0);
    }
    case "list": {
      const all = readInbox();
      const shown = values.todas === true ? all : all.filter((e) => e.estado === "pendiente");
      if (values.json === true) out(JSON.stringify(shown, null, 2));
      else if (shown.length === 0)
        out(
          `No hay mejoras ${values.todas === true ? "anotadas" : "pendientes"} (${inboxFile()}).`,
        );
      else
        for (const e of shown)
          out(
            `${e.id} [${e.estado}] ${e.fecha.slice(0, 10)} ${e.proyecto ?? "-"} (evol ${e.versionEvol}): ${e.texto}${e.nota ? ` — ${e.nota}` : ""}`,
          );
      return Promise.resolve(0);
    }
    case "hecha":
    case "descartar": {
      const id = rest[0];
      if (!id) throw new UserError(USAGE);
      const closed = closeImprovement(id, action === "hecha" ? "hecha" : "descartada", values.nota);
      out(`${closed.id}: ${closed.estado}.`);
      return Promise.resolve(0);
    }
    default:
      throw new UserError(USAGE);
  }
}
