import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { UserError } from "../../core/errors.js";
import { gatherFolder } from "../inventory.js";
import { verdictOf } from "../report.js";
import type { AuditFinding, AuditReport } from "../report.js";
import { snapshotBase, verifySnapshot } from "../snapshot.js";
import type { Reader } from "./config.js";
import { readSkillWith } from "./read.js";
import type { ReaderRun } from "./read.js";

/** The tools whose absence leaves a skill «no auditada»; the recommended ones only warn. */
const REQUIRED = new Set(["gitleaks", "semgrep", "npm", "pip-audit"]);

export const reportPath = (huella: string): string => join(snapshotBase(huella), "informe.json");

export function loadReport(huella: string): AuditReport {
  try {
    return JSON.parse(readFileSync(reportPath(huella), "utf8")) as AuditReport;
  } catch {
    throw new UserError(
      "No hay un informe de auditoría de esta versión de la skill. Audítala primero: evol skills audit <carpeta> --subproceso",
    );
  }
}

/**
 * Pass 2 over a skill that pass 1 already audited. It works on the quarantined copy, and what the
 * readers say can only be added to the report: the verdict is recomputed from every finding, so a
 * BLOCK from pass 1 stays a BLOCK and a reader that says «pass» changes nothing. If a reader cannot
 * do its job the skill is «no auditada» (unless pass 1 already blocked it): never a pass.
 */
export async function secondPass(huella: string, readers: Reader[]): Promise<AuditReport> {
  const report = loadReport(huella);
  const skillDir = join(snapshotBase(huella), "skill");
  if (report.huella !== huella || !verifySnapshot(skillDir, huella))
    throw new UserError(
      "La copia en cuarentena cambió desde la auditoría: vuelve a auditar la skill.",
    );

  const entries = gatherFolder(skillDir).entries;
  const runs: ReaderRun[] = [];
  let failure: string | undefined;
  for (const reader of readers) {
    try {
      runs.push(await readSkillWith(reader, entries));
    } catch (e) {
      failure = (e as Error).message;
      break;
    }
  }

  // a second pass that is run again replaces the first one's findings instead of piling up
  const base = report.hallazgos.filter(
    (h) => h.regla !== "subproceso" && h.regla !== "lecturas" && h.regla !== "subproceso-fallo",
  );
  const added: AuditFinding[] = runs.flatMap((r) =>
    r.aceptados.map(({ categoria: _categoria, ...finding }) => finding),
  );
  const hasScripts = report.inventario.scripts.length > 0;
  if (failure === undefined && hasScripts && !report.origen.propia && runs.length < 2)
    added.push({
      regla: "lecturas",
      nivel: "aviso",
      texto:
        "Los scripts de una skill de terceros se leen con dos asistentes distintos y solo hay uno: la persona debe aceptar por escrito que esta skill tuvo una sola lectura.",
    });
  if (failure !== undefined)
    added.push({
      regla: "subproceso-fallo",
      nivel: "aviso",
      texto: `La segunda pasada no se completó: ${failure}. Sin ella la skill queda «no auditada».`,
    });

  const hallazgos = [...base, ...added];
  // «no auditada» when a required tool of pass 1 did not run, or when pass 2 itself failed
  const incomplete =
    failure !== undefined ||
    Object.entries(report.herramientas).some(
      ([name, t]) => REQUIRED.has(name) && (t.estado === "falta" || t.estado === "fallo"),
    );
  const updated: AuditReport = {
    ...report,
    veredicto: verdictOf(hallazgos, incomplete),
    hallazgos,
    pasadas: { reglas: "hecha", subproceso: failure === undefined ? "hecha" : "fallo" },
    subproceso: {
      lectores: runs.map((r) => ({
        id: r.id,
        modelo: r.modelo,
        promptHash: r.promptHash,
        entradaHash: r.entradaHash,
        ms: r.ms,
        intentos: r.intentos,
        veredictoPropuesto: r.veredictoPropuesto,
        aceptados: r.aceptados.length,
        descartados: r.descartados,
      })),
      ...(failure === undefined ? {} : { detalle: failure }),
    },
  };
  writeFileSync(reportPath(huella), `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600 });
  return updated;
}
