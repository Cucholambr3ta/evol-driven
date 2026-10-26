import { join } from "node:path";
import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { loadContext } from "../core/pipeline.js";
import { analizarSprints, CARPETA_SPRINTS } from "../docs/sprints.js";
import { out, requireProject } from "./shared.js";
import { existsSync } from "node:fs";

export const USAGE = "Uso: evol sprint <check | estado> [--json]";

function ejecutar(accion: "check" | "estado", json: boolean): number {
  const ctx = loadContext(requireProject());
  const varios = ctx.config.modules.length > 1;
  const modulos = ctx.config.modules
    .map((m) => ({ nombre: m.name, raiz: join(ctx.root, m.root) }))
    .filter((m) => existsSync(join(m.raiz, CARPETA_SPRINTS)));
  const analisis = modulos.map((m) => ({ ...m, ...analizarSprints(m.raiz) }));
  const bloqueos = analisis.reduce((n, a) => n + a.hallazgos.length, 0);
  if (json) {
    out(
      JSON.stringify(
        {
          sprints: analisis.flatMap((a) => a.estados.map((e) => ({ modulo: a.nombre, ...e }))),
          hallazgos: analisis.flatMap((a) => a.hallazgos.map((h) => ({ modulo: a.nombre, ...h }))),
        },
        null,
        2,
      ),
    );
    return accion === "check" && bloqueos > 0 ? 1 : 0;
  }
  if (modulos.length === 0) {
    out("Nada que comprobar: no hay docs/sprints/ en el proyecto.");
    return 0;
  }
  for (const a of analisis) {
    const prefijo = varios ? `[${a.nombre}] ` : "";
    if (accion === "estado")
      for (const e of a.estados)
        out(
          `${prefijo}${e.id}  ${e.titulo}  ${e.hechas} de ${e.total} tareas${e.cerrado ? "  (cerrado)" : ""}`,
        );
    else for (const h of a.hallazgos) out(`  × ${prefijo}${h.archivo}: ${h.mensaje}`);
  }
  if (accion === "check")
    out(bloqueos === 0 ? "Sprints en orden." : `${bloqueos} bloqueo(s) en los sprints.`);
  return accion === "check" && bloqueos > 0 ? 1 : 0;
}

export default function run(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { json: { type: "boolean" } },
  });
  const accion = positionals[0];
  if (accion !== "check" && accion !== "estado") throw new UserError(USAGE);
  return Promise.resolve(ejecutar(accion, values.json === true));
}
