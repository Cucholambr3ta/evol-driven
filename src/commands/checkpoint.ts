import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { buildCheckpoint, checkpointMd, writeCheckpoint } from "../core/checkpoint.js";
import type { Checkpoint } from "../core/checkpoint.js";
import { out, requireProject } from "./shared.js";

export const USAGE = `Uso: evol checkpoint [--nota "qué hacías y qué sigue"] [--verificar] [--json]
  Guarda el estado del trabajo en .evol/checkpoint.md y .evol/checkpoint.json (fase, git, sin commit, notas),
  sin usar ningún modelo, para que otro agente o otra sesión retome donde se quedó este. Úsalo después de cada
  encargo y antes de parar. No guardes secretos en la nota. --verificar añade el resultado de evol verify
  (ejecuta las pruebas de la fase, puede tardar).`;

export function summary(c: Checkpoint, file: string): string[] {
  const lines = [`Checkpoint guardado en ${file}`, `  fase ${c.fase}, aprobación ${c.aprobacion}`];
  if (c.git)
    lines.push(
      `  git: ${c.git.rama ?? "?"} ${c.git.commit ?? ""}, ${c.git.totalSinCommit} archivo(s) sin commit`,
    );
  if (c.verificacion) lines.push(`  verificación: ${c.verificacion.veredicto}`);
  if (c.git && c.git.totalSinCommit > 0)
    lines.push("  ! Hay cambios sin commit: haz commit para no depender de este archivo.");
  return lines;
}

export default async function run(argv: string[]): Promise<number> {
  return runCheckpoint(argv, { traspaso: false, verificar: false });
}

export async function runCheckpoint(
  argv: string[],
  defaults: { traspaso: boolean; verificar: boolean },
): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      nota: { type: "string" },
      verificar: { type: "boolean" },
      json: { type: "boolean" },
    },
  });
  const root = requireProject();
  const checkpoint = await buildCheckpoint(root, {
    nota: values.nota,
    verificar: values.verificar ?? defaults.verificar,
    traspaso: defaults.traspaso,
  }).catch((error: unknown) => {
    throw new UserError(
      `No se pudo guardar el checkpoint: ${(error as Error).message.split("\n")[0]}`,
    );
  });
  writeCheckpoint(root, checkpoint);
  if (values.json) out(JSON.stringify(checkpoint, null, 2));
  else for (const line of summary(checkpoint, checkpointMd(root))) out(line);
  if (defaults.traspaso && !values.json)
    out(
      "  Traspaso: el siguiente agente empieza leyendo ese archivo (el hook de inicio se lo muestra).",
    );
  return 0;
}
