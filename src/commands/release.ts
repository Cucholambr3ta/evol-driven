import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { packageRoot } from "../core/paths.js";
import { release } from "../release/release.js";
import { versionInfo } from "../release/version.js";
import { out } from "./shared.js";

const USAGE =
  "Uso: evol release <x.y.z>   (desde el origen, con el árbol guardado y la firma de git configurada)";

export default function run(argv: string[]): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} });
  const version = positionals[0];
  if (!version) throw new UserError(USAGE);
  const info = versionInfo();
  if (info.canal !== "origen")
    throw new UserError(
      "Solo se publican versiones desde el origen del framework, no desde una copia instalada.",
    );
  // EVOL_RELEASE_CI lets the tests skip the full CI; a person never sets it
  const ci = process.env["EVOL_RELEASE_CI"] === "" ? null : ["npm", "run", "ci"];
  const result = release({ root: packageRoot(), version, ci, log: out });
  out(`Versión ${version} lista: etiqueta ${result.etiqueta} firmada en ${result.commit}.`);
  const c = result.cambios;
  out(
    `Skills: ${c.nuevas.length} nuevas, ${c.cambiadas.length} cambiadas, ${c.quitadas.length} quitadas.`,
  );
  out("No se ha subido nada. Para publicarla en GitHub:");
  out(`  git push origin ${info.rama ?? "<rama>"} ${result.etiqueta}`);
  out("y abre la PR a main cuando quieras que sea la versión instalable.");
  return Promise.resolve(0);
}
