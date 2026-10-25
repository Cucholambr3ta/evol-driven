import { runCheckpoint } from "./checkpoint.js";

export const USAGE = `Uso: evol handoff [--nota "qué queda para el siguiente"] [--json]
  Lo mismo que evol checkpoint, pensado para cuando el trabajo cambia de manos (por ejemplo, de OpenCode que
  construye a Claude Code que audita): además incluye el resultado de evol verify. Puede tardar, porque
  ejecuta las pruebas de la fase.`;

export default function run(argv: string[]): Promise<number> {
  return runCheckpoint(argv, { traspaso: true, verificar: true });
}
