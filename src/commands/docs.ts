import { join } from "node:path";
import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { loadContext } from "../core/pipeline.js";
import { comprobarDocs, PARTES } from "../docs/check.js";
import type { DocFinding, Parte } from "../docs/check.js";
import { out, requireProject } from "./shared.js";

export const USAGE = "Uso: evol docs <check | evidencia> [--estricto] [--json]";

interface Hallazgo extends DocFinding {
  modulo: string;
}

function comprobar(elegidas: readonly Parte[], estricto: boolean, json: boolean): number {
  const ctx = loadContext(requireProject());
  const hallazgos: Hallazgo[] = [];
  const partes = new Set<Parte>();
  for (const m of ctx.config.modules) {
    const r = comprobarDocs(join(ctx.root, m.root), elegidas);
    for (const p of r.partes) partes.add(p);
    hallazgos.push(...r.hallazgos.map((h) => ({ ...h, modulo: m.name })));
  }
  const bloqueos = hallazgos.filter((h) => h.nivel === "bloqueo").length;
  const avisos = hallazgos.length - bloqueos;
  const falla = bloqueos > 0 || (estricto && avisos > 0);
  if (json) {
    out(JSON.stringify({ partes: PARTES.filter((p) => partes.has(p)), hallazgos }, null, 2));
    return falla ? 1 : 0;
  }
  if (partes.size === 0) {
    out(
      `Nada que comprobar: no hay ${elegidas.length === 1 ? "investigacion/" : "documentación de dominio, de requisitos ni dossiers"} en el proyecto.`,
    );
    return 0;
  }
  const varios = ctx.config.modules.length > 1;
  for (const h of hallazgos) {
    const prefijo = varios ? `[${h.modulo}] ` : "";
    out(
      h.nivel === "bloqueo"
        ? `  × ${prefijo}${h.archivo}: ${h.mensaje}`
        : `  ! ${prefijo}${h.archivo}: ${h.mensaje} (aviso)`,
    );
  }
  out(
    hallazgos.length === 0
      ? "Documentación en orden."
      : `${bloqueos} bloqueo(s) y ${avisos} aviso(s) en la documentación.`,
  );
  return falla ? 1 : 0;
}

export default function run(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { estricto: { type: "boolean" }, json: { type: "boolean" } },
  });
  const accion = positionals[0];
  if (accion !== "check" && accion !== "evidencia") throw new UserError(USAGE);
  const elegidas: readonly Parte[] = accion === "evidencia" ? ["evidencia"] : PARTES;
  return Promise.resolve(comprobar(elegidas, values.estricto === true, values.json === true));
}
