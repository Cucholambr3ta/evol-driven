import { statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { UserError } from "../core/errors.js";
import { sha256 } from "../core/hash.js";
import { packageVersion } from "../core/paths.js";
import {
  DECLARATION_FILE,
  DeclaracionSchema,
  dependencyFindings,
  exceeds,
  inferCapabilities,
  isEmptyCap,
  scanDangerous,
  scanInjection,
} from "./analyze.js";
import type { Declaracion } from "./analyze.js";
import { checkSkill } from "./check.js";
import { gatherFolder, gatherZip, inventoryFindings, languageOf } from "./inventory.js";
import type { Entry } from "./inventory.js";
import { fetchRemote, parseRemote } from "./remote.js";
import { verdictOf } from "./report.js";
import type { AuditFinding, AuditReport, Capacidades, ToolReport } from "./report.js";
import { huellaDe, readSkill } from "./skill.js";
import { snapshotBase, verifySnapshot, writeSnapshot } from "./snapshot.js";
import { runOptionalTools } from "./optional-tools.js";
import { runDependencyAudit, runGitleaks, runSemgrep } from "./tools.js";

export interface AuditOptions {
  /** The person says the skill is their own: its scripts are not required to declare capabilities. */
  propia?: boolean;
  /** A declaration the person confirmed, in the same format as capacidades.json. */
  capacidades?: Declaracion;
  /** Tests only: lets `file://` stand in for a remote. */
  allowFileRemote?: boolean;
}

export interface AuditOutcome {
  report: AuditReport;
  informe: string | null;
  cuarentena: string | null;
}

/** Rules of `check` that are about the files themselves; the audit has stricter versions of the rest. */
const FROM_CHECK = new Set([
  "carpeta",
  "frontmatter",
  "nombre",
  "descripcion",
  "secretos",
  "herencia",
  "scripts",
  "red",
  "tamano",
]);

const block = (regla: string, texto: string, archivo?: string): AuditFinding => ({
  regla,
  nivel: "bloqueo",
  texto,
  ...(archivo ? { archivo } : {}),
});
const warn = (regla: string, texto: string, archivo?: string): AuditFinding => ({
  regla,
  nivel: "aviso",
  texto,
  ...(archivo ? { archivo } : {}),
});

function describe(extra: Capacidades): string {
  return (["red", "escribe", "comandos", "entorno"] as const)
    .filter((k) => extra[k].length > 0)
    .map((k) => `${k}: ${extra[k].join(", ")}`)
    .join(" · ");
}

export function parseDeclaration(raw: string, source: string): Declaracion {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new UserError(`${source} no es JSON válido: ${(e as Error).message}`);
  }
  const parsed = DeclaracionSchema.safeParse(json);
  if (!parsed.success) {
    throw new UserError(
      `${source} es inválido: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return parsed.data;
}

function dedupe(findings: AuditFinding[]): AuditFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.regla}|${f.nivel}|${f.archivo ?? ""}|${f.texto}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Pass 1 of the audit: rules, no model. It reads a skill into memory, writes an immutable copy to the
 * quarantine, looks at it without running anything, and leaves a report next to the copy. It never
 * approves: only a person does, and only after pass 2.
 */
export function auditSkill(origen: string, options: AuditOptions = {}): AuditOutcome {
  const findings: AuditFinding[] = [];
  let tipo: AuditReport["origen"]["tipo"];
  let ref = origen;
  let sha: string | undefined;
  let nombre: string;
  let entries: Entry[];
  let cleanup = (): void => {};

  const remote = parseRemote(origen, { allowFile: options.allowFileRemote === true });
  if (remote) {
    const fetched = fetchRemote(remote, { allowFile: options.allowFileRemote === true });
    cleanup = fetched.cleanup;
    tipo = "remoto";
    ref = remote.url;
    sha = remote.sha;
    nombre = basename(remote.url).replace(/\.git$/, "");
    const gathered = gatherFolder(fetched.dir);
    entries = gathered.entries;
    findings.push(...gathered.findings);
  } else {
    const path = resolve(origen);
    let info;
    try {
      info = statSync(path);
    } catch {
      throw new UserError(`No existe ${path}.`);
    }
    if (info.isDirectory()) {
      tipo = "carpeta";
      nombre = basename(path);
      const gathered = gatherFolder(path);
      entries = gathered.entries;
      findings.push(...gathered.findings);
    } else if (info.isFile() && /\.zip$/i.test(path)) {
      tipo = "zip";
      const gathered = gatherZip(readFileSync(path));
      nombre = gathered.nombre ?? basename(path).replace(/\.zip$/i, "");
      entries = gathered.entries;
      findings.push(...gathered.findings);
    } else {
      throw new UserError("Indica una carpeta de skill, un .zip o un enlace https://…/repo@<sha>.");
    }
  }

  const baseReport = {
    version: 1 as const,
    fecha: new Date().toISOString(),
    evol: packageVersion(),
    skill: nombre,
    origen: { tipo, ref, ...(sha ? { sha } : {}), propia: options.propia === true },
  };

  try {
    // An input that cannot even be read (an unsafe .zip) is a BLOCK with no copy to keep.
    if (entries.length === 0) {
      if (findings.length === 0)
        findings.push(block("vacia", "No hay nada que auditar: la carpeta está vacía."));
      const report: AuditReport = {
        ...baseReport,
        huella: "",
        veredicto: "block",
        hallazgos: dedupe(findings),
        herramientas: {},
        inventario: { archivos: 0, bytes: 0, scripts: [] },
        capacidades: { fuente: null, declaradas: null, inferidas: {}, propuesta: null },
        pasadas: { reglas: "hecha", subproceso: "pendiente" },
      };
      return { report, informe: null, cuarentena: null };
    }

    const huella = huellaDe(entries.map((e) => ({ ruta: e.ruta, sha256: sha256(e.data) })));
    const skillDir = writeSnapshot(entries, huella);
    const base = snapshotBase(huella);
    // The copy always lives in a folder called «skill»; what has to match `name` is the folder it came from.
    const skill = { ...readSkill(skillDir), id: nombre };

    // Pass 1, rules
    for (const r of checkSkill(skill).hallazgos) {
      if (r.nivel !== "ok" && FROM_CHECK.has(r.regla))
        findings.push({
          regla: r.regla,
          nivel: r.nivel === "error" ? "bloqueo" : "aviso",
          texto: r.texto,
          ...(r.archivo ? { archivo: r.archivo } : {}),
        });
    }
    findings.push(
      ...inventoryFindings(entries),
      ...scanDangerous(entries),
      ...scanInjection(entries),
    );
    const deps = dependencyFindings(entries);
    findings.push(...deps.findings);

    const fm = skill.frontmatter;
    const hasOrigin =
      (typeof fm["origin"] === "string" ||
        typeof fm["source"] === "string" ||
        typeof fm["repository"] === "string") &&
      typeof fm["license"] === "string";
    if (options.propia !== true && !hasOrigin)
      findings.push(
        warn(
          "procedencia",
          "No declara su origen ni su licencia (origin, license): no se puede saber de dónde viene.",
        ),
      );

    // Capabilities of the scripts
    const scripts = entries.filter(
      (e) => !e.data.includes(0) && languageOf(e.ruta, e.data.toString("utf8")) !== null,
    );
    const inferidas: Record<string, Capacidades> = {};
    for (const s of scripts) {
      const cap = inferCapabilities(s.ruta, s.data.toString("utf8"));
      if (cap) inferidas[s.ruta] = cap;
    }
    let declaradas: Record<string, Capacidades> | null = null;
    let fuente: "autor" | "persona" | null = null;
    const authorFile = entries.find((e) => e.ruta === DECLARATION_FILE);
    if (authorFile) {
      try {
        declaradas = parseDeclaration(authorFile.data.toString("utf8"), DECLARATION_FILE).scripts;
        fuente = "autor";
      } catch (e) {
        findings.push(block("capacidades", (e as Error).message, DECLARATION_FILE));
      }
    }
    if (options.capacidades) {
      declaradas = { ...(declaradas ?? {}), ...options.capacidades.scripts };
      fuente = "persona";
    }
    let propuesta: Record<string, Capacidades> | null = null;
    if (options.propia !== true) {
      for (const [ruta, cap] of Object.entries(inferidas)) {
        const decl = declaradas?.[ruta];
        if (!decl) {
          findings.push(
            block(
              "capacidades",
              "El script no declara sus capacidades: sin una declaración confirmada no entra.",
              ruta,
            ),
          );
          (propuesta ??= {})[ruta] = cap;
          continue;
        }
        const extra = exceeds(cap, decl);
        if (!isEmptyCap(extra)) {
          findings.push(
            block(
              "capacidades",
              `El script hace más de lo que declara (${describe(extra)}).`,
              ruta,
            ),
          );
          (propuesta ??= {})[ruta] = cap;
        }
        if (decl.red.includes("*"))
          findings.push(
            warn("capacidades", "Declara acceso a la red sin restricción de dominios.", ruta),
          );
      }
      for (const ruta of Object.keys(declaradas ?? {})) {
        if (!(ruta in inferidas))
          findings.push(
            warn(
              "capacidades",
              "Declara capacidades de un script que no existe en la skill.",
              ruta,
            ),
          );
      }
    }

    // External tools; a required one that cannot run leaves the skill «no auditada»
    const herramientas: Record<string, ToolReport> = {};
    const g = runGitleaks(skillDir);
    const s = runSemgrep(skillDir);
    herramientas["gitleaks"] = g.report;
    herramientas["semgrep"] = s.report;
    findings.push(...g.findings, ...s.findings);
    if (deps.ecosystems.size > 0) {
      const d = runDependencyAudit(skillDir, entries, deps.ecosystems);
      Object.assign(herramientas, d.reports);
      findings.push(...d.findings);
    }
    // The recommended tools only add warnings: the loop below is about the required ones.
    const optional = runOptionalTools(skillDir);
    findings.push(...optional.findings);
    let incomplete = false;
    for (const [name, r] of Object.entries(herramientas)) {
      if (r.estado === "falta" || r.estado === "fallo") {
        incomplete = true;
        findings.push(
          warn(
            "herramientas",
            `No se pudo ejecutar ${name}: ${r.detalle ?? r.estado}. Sin ella la skill queda «no auditada».`,
          ),
        );
      }
    }

    if (!verifySnapshot(skillDir, huella))
      findings.push(block("integridad", "La copia en cuarentena cambió durante la auditoría."));

    const hallazgos = dedupe(findings);
    const report: AuditReport = {
      ...baseReport,
      huella,
      veredicto: verdictOf(hallazgos, incomplete),
      hallazgos,
      herramientas: { ...herramientas, ...optional.reports },
      inventario: {
        archivos: entries.length,
        bytes: entries.reduce((n, e) => n + e.data.length, 0),
        scripts: scripts.map((e) => e.ruta).sort(),
      },
      capacidades: { fuente, declaradas, inferidas, propuesta },
      pasadas: { reglas: "hecha", subproceso: "pendiente" },
    };
    const informe = join(base, "informe.json");
    writeFileSync(informe, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    return { report, informe, cuarentena: skillDir };
  } finally {
    cleanup();
  }
}
