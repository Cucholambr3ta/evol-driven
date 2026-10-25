import { rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { captureGit, copyLocal, filesOf, hashTree, SUBPATH } from "../knowledge/capture.js";
import { publish, reviewCapture, sha256Of } from "../knowledge/gate.js";
import type { KnowledgeSource } from "../knowledge/model.js";
import {
  capturePath,
  getSource,
  ID,
  readRegistry,
  readyPath,
  writeRegistry,
} from "../knowledge/store.js";
import { embeddingsReachable, engineInstalled, ingestLibrary } from "../knowledge/engine.js";
import { searchKnowledge } from "../knowledge/search.js";
import { knowledgeStatus } from "../knowledge/status.js";
import { findProjectRoot } from "../core/paths.js";
import { loadConfig } from "../core/config.js";
import { out } from "./shared.js";

export const USAGE = [
  "Uso:",
  "  evol knowledge source add <id> --nombre <texto> --version <versión> --licencia <SPDX|desconocida> --licencia-url <https://…>",
  "                            (--git <https://repo> --commit <hash de 40> | --ruta <carpeta> --origen <https://…>)",
  "                            [--uso-privado <motivo> --por <responsable>]",
  "  evol knowledge source list [--json]",
  "  evol knowledge source retire <id> --motivo <texto>",
  "  evol knowledge review <id> [--json]",
  "  evol knowledge accept <id> <ruta> --motivo <texto> --por <responsable>",
  "  evol knowledge source package <id> <paquete-npm>   (para avisar si el proyecto usa otra versión)",
  "  evol knowledge ingest <id> | --todas   (indexa lo revisado; lento: los vectores se calculan en CPU)",
  '  evol knowledge search "<pregunta>" [--fuente <id>]... [--limite <n>] [--json]',
  "  evol knowledge status [--json]",
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
      subcarpeta: { type: "string" },
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
  if ((values.subcarpeta ?? "").trim() !== "" && git === "")
    problems.push("--subcarpeta solo vale con --git");
  if ((values.subcarpeta ?? "").trim() !== "" && !SUBPATH.test((values.subcarpeta ?? "").trim()))
    problems.push("--subcarpeta debe ser una ruta relativa, sin «..» ni caracteres raros");
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
    if (git !== "")
      captureGit(
        git,
        (values.commit ?? "").trim(),
        dest,
        ["https"],
        (values.subcarpeta ?? "").trim() || undefined,
      );
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
      ...(git !== "" && (values.subcarpeta ?? "").trim() !== ""
        ? { subcarpeta: (values.subcarpeta ?? "").trim() }
        : {}),
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
  const result = reviewCapture(dir, source.aceptaciones ?? []);
  publish(dir, readyPath(source.id), result.aceptados);
  source.estado = "revisada";
  source.revision = {
    el: new Date().toISOString(),
    aceptados: result.aceptados.length,
    rechazados: result.rechazados.length,
    avisos: result.avisos.length,
    aceptadosPorPersona: result.aceptadosPorPersona.length,
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
  for (const a of result.aceptadosPorPersona)
    out(`  ✓ ${a.ruta}: aceptado por ${a.responsable} (${a.motivo})`);
  for (const a of result.avisos.slice(0, 20)) out(`  ! ${a.ruta}: ${a.texto}`);
  if (result.avisos.length > 20) out(`  ! … y ${result.avisos.length - 20} aviso(s) más`);
  out(`Listos para indexar en: ${readyPath(source.id)}`);
  return 0;
}

function accept(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { motivo: { type: "string" }, por: { type: "string" } },
  });
  const [id = "", ruta = ""] = positionals;
  const motivo = (values.motivo ?? "").trim();
  const responsable = (values.por ?? "").trim();
  if (ruta === "" || motivo === "" || responsable === "")
    throw new UserError(
      `Falta la ruta, --motivo o --por: una persona acepta el documento por escrito.\n\n${USAGE}`,
    );
  const registry = readRegistry();
  const source = getSource(registry, id);
  if (source.estado === "retirada") throw new UserError(`La fuente «${id}» está retirada.`);
  const file = join(capturePath(id), ruta);
  if (!filesOf(capturePath(id)).includes(ruta))
    throw new UserError(`«${ruta}» no está en la captura de «${id}».`);
  // only what the gate actually rejects can be accepted: it is not a way around the review
  const review = reviewCapture(capturePath(id), []);
  const rejection = review.rechazados.find((r) => r.ruta === ruta);
  if (!rejection) throw new UserError(`«${ruta}» no está rechazado: no hace falta aceptarlo.`);
  source.aceptaciones = [
    ...(source.aceptaciones ?? []).filter((a) => a.ruta !== ruta),
    { ruta, sha256: sha256Of(file), motivo, responsable, el: new Date().toISOString() },
  ];
  writeRegistry(registry);
  out(
    `«${ruta}» aceptado por ${responsable}. Motivos del rechazo que se levantan: ${rejection.motivos.join("; ")}`,
  );
  out(`Vuelve a ejecutar: evol knowledge review ${id}`);
  return 0;
}

function setPackage(argv: string[]): number {
  const [id = "", pkg = ""] = argv;
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(pkg))
    throw new UserError(`«${pkg}» no parece un paquete de npm.\n\n${USAGE}`);
  const registry = readRegistry();
  const source = getSource(registry, id);
  source.paquete = pkg;
  writeRegistry(registry);
  out(`«${id}» documenta el paquete ${pkg}.`);
  return 0;
}

async function ingest(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { todas: { type: "boolean", default: false } },
  });
  const registry = readRegistry();
  const ids = values.todas
    ? Object.values(registry.fuentes)
        .filter((s) => s.estado === "revisada")
        // the small ones first: they are usable sooner and the long ones do not hold them up
        .sort((a, b) => a.archivos - b.archivos)
        .map((s) => s.id)
    : [positionals[0] ?? ""];
  if (ids.length === 0 || ids[0] === "")
    throw new UserError(`Indica una fuente o --todas.\n\n${USAGE}`);
  for (const id of ids) {
    const source = getSource(registry, id);
    if (source.estado !== "revisada")
      throw new UserError(
        `La fuente «${id}» está ${source.estado}: solo se indexa lo que pasó la revisión (evol knowledge review ${id}).`,
      );
  }
  if (!engineInstalled())
    throw new UserError("No está instalado el motor de conocimiento. Mira DEPENDENCIES.md.");
  if (!(await embeddingsReachable()))
    throw new UserError(
      "El servidor local de embeddings (Ollama) no responde en 127.0.0.1:11434. Arráncalo e inténtalo de nuevo.",
    );
  let failed = 0;
  for (const id of ids) {
    out(`Indexando «${id}»… (puede tardar horas: los vectores se calculan en CPU)`);
    const started = Date.now();
    const r = await ingestLibrary(id);
    const minutes = Math.round((Date.now() - started) / 60_000);
    if (r.code === 0 && r.fallidos === 0) out(`  ✓ ${id}: indexada en ${minutes} min`);
    else if (r.code === 0) {
      failed++;
      out(
        `  ✗ ${id}: ${r.fallidos} documento(s) no se pudieron guardar (${r.primerFallo ?? "sin detalle"}). La fuente queda incompleta.`,
      );
    } else {
      failed++;
      out(`  ✗ ${id}: falló (${(r.stderr || r.stdout).trim().split("\n")[0] ?? "sin detalle"})`);
    }
  }
  return failed === 0 ? 0 : 1;
}

/** In a project that narrows its sources, a search without --fuente stays within them. */
function projectSources(): string[] | undefined {
  const root = findProjectRoot();
  if (!root) return undefined;
  try {
    return loadConfig(root).knowledge?.fuentes;
  } catch {
    return undefined;
  }
}

async function search(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      fuente: { type: "string", multiple: true },
      limite: { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  const consulta = positionals.join(" ").trim();
  if (consulta === "") throw new UserError(`Falta la pregunta.\n\n${USAGE}`);
  const limite = values.limite === undefined ? undefined : Number(values.limite);
  if (limite !== undefined && (!Number.isInteger(limite) || limite < 1 || limite > 20))
    throw new UserError("--limite debe ser un entero entre 1 y 20.");
  const fuentes = values.fuente ?? projectSources();
  const result = await searchKnowledge({
    consulta,
    ...(fuentes ? { fuentes } : {}),
    ...(limite ? { limite } : {}),
  });
  if (values.json) {
    out(JSON.stringify(result, null, 2));
    return 0;
  }
  if (result.sinIndexar.length > 0)
    out(`(sin indexar, no consultadas: ${result.sinIndexar.join(", ")})`);
  if (result.resultados.length === 0) {
    out("Sin resultados.");
    return 0;
  }
  for (const [i, h] of result.resultados.entries()) {
    out(`\n${i + 1}. ${h.nombre} ${h.version} — ${h.archivo}${h.seccion ? ` › ${h.seccion}` : ""}`);
    out(
      `   ${h.enlace}\n   capturada el ${h.capturadoEl.slice(0, 10)}, licencia ${h.licencia}${h.citable ? "" : " (no citable)"}`,
    );
    out(`   ${h.texto.replace(/\s+/g, " ").slice(0, 300)}…`);
  }
  out(`\n${result.aviso}`);
  return 0;
}

async function status(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { json: { type: "boolean", default: false } },
  });
  const rows = await knowledgeStatus({ root: findProjectRoot() });
  if (values.json) {
    out(JSON.stringify(rows, null, 2));
    return 0;
  }
  if (rows.length === 0) {
    out("No hay fuentes registradas.");
    return 0;
  }
  for (const r of rows) {
    const mark = r.avisos.length === 0 ? "✓" : "!";
    out(
      `${mark} ${r.id.padEnd(28)} ${r.estado.padEnd(9)} ${r.indexada ? `${r.documentos} fragmentos` : "sin indexar"}  (${r.edadDias} días)`,
    );
    for (const a of r.avisos) out(`    ${a}`);
  }
  return 0;
}

export default async function run(argv: string[]): Promise<number> {
  const [area, ...rest] = argv;
  if (area === "review") return review(rest);
  if (area === "accept") return accept(rest);
  if (area === "ingest") return ingest(rest);
  if (area === "search") return search(rest);
  if (area === "status") return status(rest);
  if (area !== "source") throw new UserError(USAGE);
  const [action, ...args] = rest;
  switch (action) {
    case "add":
      return add(args);
    case "list":
      return list(args);
    case "retire":
      return retire(args);
    case "package":
      return setPackage(args);
    default:
      throw new UserError(USAGE);
  }
}
