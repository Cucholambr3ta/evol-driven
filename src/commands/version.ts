import { parseArgs } from "node:util";
import { describeVersion, readInstallRecord, versionInfo } from "../release/version.js";
import { verifyIntegrity } from "../release/integrity.js";
import { out } from "./shared.js";

export default function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { json: { type: "boolean" } } });
  const info = versionInfo();
  if (values.json === true) {
    const record = readInstallRecord(info.raiz);
    out(JSON.stringify({ ...info, instalacion: record }, null, 2));
    return Promise.resolve(0);
  }
  out(`evol ${describeVersion(info)}`);
  out(`  carpeta: ${info.raiz}`);
  if (info.canal === "estable") {
    const record = readInstallRecord(info.raiz);
    out(`  instalada: ${record?.instaladaEn ?? "?"} desde ${record?.repositorio ?? "?"}`);
    out(`  firma de la etiqueta: ${record?.firmaVerificada ? "verificada" : "NO verificada"}`);
    const integrity = verifyIntegrity(info.raiz);
    out(
      `  integridad: ${integrity.sinRegistro ? "sin registro" : integrity.ok ? "íntegra" : "MODIFICADA"}`,
    );
  } else if (info.canal === "origen") {
    out(
      "  es el origen: aquí se edita el framework. Los proyectos deberían usar la copia estable.",
    );
  }
  return Promise.resolve(0);
}
