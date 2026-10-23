import { rmSync } from "node:fs";
import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { captureGit, copyLocal, hashTree } from "../knowledge/capture.js";
import { publish, reviewCapture } from "../knowledge/gate.js";
import type { KnowledgeSource } from "../knowledge/model.js";
import {
  capturePath,
  getSource,
  ID,
  readRegistry,
  readyPath,
  writeRegistry,
} from "../knowledge/store.js";
import { out } from "./shared.js";

const USAGE = [
  "Uso:",
  "  evol knowledge source add <id> --nombre <texto> --version <versión> --licencia <SPDX|desconocida> --licencia-url <https://…>",
  "                            (--git <https://repo> --commit <hash de 40> | --ruta <carpeta> --origen <https://…>)",
  "                            [--uso-privado <motivo> --por <responsable>]",
  "  evol knowledge source list [--json]",
  "  evol knowledge source retire <id> --motivo <texto>",
  "  evol knowledge review <id> [--json]",
].join("\n");

const SPDX = /^[A-Za-z0-9][A-Za-z0-9.+-]*(\s+(OR|AND|WITH)\s+[A-Za-z0-9][A-Za-z0-9.+-]*)*$/;
const HTTPS = /^https:\/\/[^\s/]+\S*$/;

function add(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      nombre: { type: "string" },
      version: { type: "string" },
      licencia: { type: "string" },
      "licencia-url": { type: "string" },
      git: { type: "string" },
      commit: { type: "string" },
      ruta: { type: "string" },
      origen: { type: "string" },
      "uso-privado": { type: "string" },
      por: { type: "string" },
    },
  });
  const id = positionals[0] ?? "";
  const problems: string[] = [];
  const need = (value: string | undefined, label: string): string => {
    if ((value ?? "").trim() === "") problems.push(`falta ${label}`);
    return (value ?? "").trim();
  };

  if (!ID.test(id))
    problems.push(
      "el id debe ir en minúsculas, con letras, números, «.», «-» o «_» (por ejemplo node-24)",
    );
  const nombre = need(values.nombre, "--nombre");
  const version = need(values.version, "--version (la del software que documenta)");
  const spdx = need(values.licencia, "--licencia (un identificador SPDX, o «desconocida»)");
  const unknown = spdx.toLowerCase() === "desconocida";
  if (spdx !== "" && !unknown && !SPDX.test(spdx))
    problems.push(`«${spdx}» no parece un identificador SPDX`);
  const licenseUrl = (values["licencia-url"] ?? "").trim();
  if (!unknown) {
    if (!HTTPS.test(licenseUrl))
      problems.push("falta --licencia-url: la página https donde se comprobó la licencia");
  }
  const private_ = (values["uso-privado"] ?? "").trim();
  const owner = (values.por ?? "").trim();
  if (unknown && (private_ === "" || owner === ""))
    problems.push(
      "una licencia desconocida solo entra con --uso-privado «motivo» y --por «responsable»: una persona la acepta por escrito",
    );
  if (!unknown && private_ !== "")
    problems.push("--uso-privado solo vale con --licencia desconocida");

  const git = (values.git ?? "").trim();
  const ruta = (values.ruta ?? "").trim();
  if ((git === "") === (ruta === ""))
    problems.push(
      "indica la captura con --git y --commit, o con --ruta y --origen (una de las dos)",
    );
  let origenUrl = git;
  if (git !== "" && !HTTPS.test(git)) problems.push("--git debe ser una URL https");
  if (git !== "" && !/^[0-9a-f]{40}$/.test((values.commit ?? "").trim()))
    problems.push("--commit debe ser el hash completo de 40 caracteres");
  if (ruta !== "") {
    origenUrl = (values.origen ?? "").trim();
    if (!HTTPS.test(origenUrl))
      problems.push("falta --origen: la URL https de donde salió la carpeta");
  }
  if (problems.length > 0)
    throw new UserError(`No se registra la fuente:\n  - ${problems.join("\n  - ")}\n\n${USAGE}`);

  const registry = readRegistry();
  if (registry.fuentes[id])
    throw new UserError(
      `Ya existe la fuente «${id}». Una captura no se reescribe: usa otro id para otra versión, o retírala primero.`,
    );

  const dest = capturePath(id);
  rmSync(dest, { recursive: true, force: true });
  try {
    if (git !== "") captureGit(git, (values.commit ?? "").trim(), dest);
    else copyLocal(ruta, dest);
  } catch (error) {
    rmSync(dest, { recursive: true, force: true });
    throw error;
  }
  const { hash, archivos } = hashTree(dest);
  if (archivos === 0) {
    rmSync(dest, { recursive: true, force: true });
    throw new UserError("La captura no tiene ningún archivo.");
  }
  const now = new Date().toISOString();
  const source: KnowledgeSource = {
    id,
    nombre,
    version,
    origen: {
      tipo: git !== "" ? "git" : "local",
      url: origenUrl,
      ...(git !== "" ? { commit: (values.commit ?? "").trim() } : {}),
    },
    capturadoEl: now,
    licencia: {
      spdx: unknown ? "desconocida" : spdx,
      ...(unknown ? {} : { comprobada: { url: licenseUrl, el: now } }),
    },
    hash,
    archivos,
    ...(unknown ? { usoPrivado: { motivo: private_, responsable: owner, el: now } } : {}),
    citable: !unknown,
    estado: "capturada",
  };
  registry.fuentes[id] = source;
  writeRegistry(registry);
  out(`Fuente «${id}» registrada: ${archivos} archivo(s), hash ${hash.slice(0, 16)}…`);
  out(
    `Licencia: ${source.licencia.spdx}${unknown ? " (uso privado: no se cita textualmente)" : ""}.`,
  );
  out(`Siguiente paso: evol knowledge review ${id}`);
  return 0;
}

function list(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: { json: { type: "boolean", default: false } },
  });
  const sources = Object.values(readRegistry().fuentes);
  if (values.json) {
    out(JSON.stringify(sources, null, 2));
    return 0;
  }
  if (sources.length === 0) {
    out("No hay fuentes registradas.");
    return 0;
  }
  for (const s of sources)
    out(
      `${s.id.padEnd(24)} ${s.estado.padEnd(9)} ${s.version.padEnd(10)} ${s.licencia.spdx.padEnd(12)} ${s.capturadoEl.slice(0, 10)}  ${s.nombre}${s.citable ? "" : "  [no citable]"}`,
    );
  return 0;
}

function retire(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { motivo: { type: "string" } },
  });
  const registry = readRegistry();
  const source = getSource(registry, positionals[0] ?? "");
  if ((values.motivo ?? "").trim() === "") throw new UserError(`Falta --motivo.\n\n${USAGE}`);
  source.estado = "retirada";
  source.retirada = { el: new Date().toISOString(), motivo: (values.motivo ?? "").trim() };
  delete source.revision;
  writeRegistry(registry);
  // what an indexer may read goes away; the capture and the record stay as evidence
  rmSync(readyPath(source.id), { recursive: true, force: true });
  out(`Fuente «${source.id}» retirada. Sus documentos ya no están disponibles para indexar.`);
  return 0;
}

function review(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { json: { type: "boolean", default: false } },
  });
  const registry = readRegistry();
  const source = getSource(registry, positionals[0] ?? "");
  if (source.estado === "retirada") throw new UserError(`La fuente «${source.id}» está retirada.`);
  const dir = capturePath(source.id);
  const tree = hashTree(dir);
  if (tree.hash !== source.hash)
    throw new UserError(
      `La captura de «${source.id}» ya no coincide con la registrada (cambió después de capturarla). No se revisa ni se indexa.`,
    );
  const result = reviewCapture(dir);
  publish(dir, readyPath(source.id), result.aceptados);
  source.estado = "revisada";
  source.revision = {
    el: new Date().toISOString(),
    aceptados: result.aceptados.length,
    rechazados: result.rechazados.length,
    avisos: result.avisos.length,
  };
  writeRegistry(registry);

  if (values.json) {
    out(JSON.stringify({ fuente: source.id, ...result, listoEn: readyPath(source.id) }, null, 2));
    return 0;
  }
  out(
    `Revisión de «${source.id}»: ${result.aceptados.length} documento(s) aceptado(s), ${result.rechazados.length} rechazado(s).`,
  );
  for (const r of result.rechazados) out(`  × ${r.ruta}: ${r.motivos.join("; ")}`);
  for (const a of result.avisos.slice(0, 20)) out(`  ! ${a.ruta}: ${a.texto}`);
  if (result.avisos.length > 20) out(`  ! … y ${result.avisos.length - 20} aviso(s) más`);
  out(`Listos para indexar en: ${readyPath(source.id)}`);
  return 0;
}

export default async function run(argv: string[]): Promise<number> {
  const [area, ...rest] = argv;
  if (area === "review") return review(rest);
  if (area !== "source") throw new UserError(USAGE);
  const [action, ...args] = rest;
  switch (action) {
    case "add":
      return add(args);
    case "list":
      return list(args);
    case "retire":
      return retire(args);
    default:
      throw new UserError(USAGE);
  }
}
