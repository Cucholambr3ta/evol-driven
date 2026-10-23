import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserError } from "../core/errors.js";
import { isTrusted } from "./auditor/trust.js";
import { loadReport, reportPath } from "./auditor/pass2.js";
import { findSkill } from "./library.js";
import { readManifest, writeManifest } from "./manifest.js";
import type { AuditFinding, AuditReport, Capacidades } from "./report.js";
import { snapshotBase } from "./snapshot.js";
import { gatherFolder, languageOf } from "./inventory.js";

/** What a person has to do at the terminal to approve; the real one types, a test hands in its own. */
export interface ApproveConfirm {
  approver: string;
  /** Throws unless the person typed the skill's name. */
  name(skill: string): Promise<void>;
  /** Throws unless the person accepted, in writing, the warnings that were shown. */
  warnings(findings: AuditFinding[]): Promise<void>;
}

const describeCap = (c: Capacidades): string =>
  (["red", "escribe", "comandos", "entorno"] as const)
    .filter((k) => c[k].length > 0)
    .map((k) => `${k}: ${c[k].join(", ")}`)
    .join(" · ") || "nada especial";

/** The scripts of two copies, compared. With `diff` for what changed; without it, only which files. */
export function scriptDiff(previousDir: string | null, currentDir: string): string[] {
  const scripts = (dir: string): Map<string, Buffer> =>
    new Map(
      gatherFolder(dir)
        .entries.filter(
          (e) => !e.data.includes(0) && languageOf(e.ruta, e.data.toString("utf8")) !== null,
        )
        .map((e) => [e.ruta, e.data]),
    );
  const now = scripts(currentDir);
  if (previousDir === null) return [...now.keys()].sort().map((r) => `+ ${r} (script nuevo)`);
  const before = scripts(previousDir);
  const lines: string[] = [];
  const work = mkdtempSync(join(tmpdir(), "evol-diff-"));
  try {
    for (const ruta of [...new Set([...before.keys(), ...now.keys()])].sort()) {
      const a = before.get(ruta);
      const b = now.get(ruta);
      if (a && b && a.equals(b)) continue;
      if (!a) lines.push(`+ ${ruta} (script nuevo)`);
      else if (!b) lines.push(`- ${ruta} (script quitado)`);
      else {
        lines.push(`~ ${ruta} (cambió)`);
        writeFileSync(join(work, "a"), a);
        writeFileSync(join(work, "b"), b);
        const d = spawnSync(
          "diff",
          ["-u", "--label", "antes", "--label", "ahora", join(work, "a"), join(work, "b")],
          {
            encoding: "utf8",
          },
        );
        if (d.stdout)
          lines.push(
            ...d.stdout
              .trimEnd()
              .split("\n")
              .slice(0, 60)
              .map((l) => `    ${l}`),
          );
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return lines.length > 0
    ? lines
    : ["Los scripts no cambiaron respecto a la última versión aprobada."];
}

export interface ApproveResult {
  estado: "aprobada" | "con-avisos";
  huella: string;
}

/**
 * A skill gets in only through a person at a terminal. This checks what an audit must have done,
 * shows what the person is accepting, and records the approval against the exact bytes audited.
 * A BLOCK cannot be overridden, a skill that is «no auditada» cannot be approved, and neither can
 * one whose reader never passed the self-test.
 */
export async function approveSkill(
  dir: string,
  name: string,
  confirm: ApproveConfirm,
  show: (line: string) => void,
  now: Date = new Date(),
): Promise<ApproveResult> {
  const skill = findSkill(dir, name);
  const report: AuditReport = loadReport(skill.huella);
  if (report.huella !== skill.huella)
    throw new UserError("El informe no corresponde a esta versión de la skill: audítala otra vez.");
  if (report.veredicto === "block")
    throw new UserError(
      "La auditoría dio BLOCK: una skill bloqueada no se puede aprobar. Corrige lo que se señala y vuelve a auditarla.",
    );
  if (report.veredicto === "no-auditada")
    throw new UserError(
      "La skill está «no auditada»: falta una herramienta o la segunda pasada no se completó. Una skill así no se aprueba.",
    );
  if (report.pasadas.subproceso !== "hecha" || (report.subproceso?.lectores.length ?? 0) === 0)
    throw new UserError(
      "Falta la segunda pasada (el lector). Audita con: evol skills audit <carpeta> --subproceso",
    );
  for (const l of report.subproceso?.lectores ?? [])
    if (!isTrusted(l.id, l.modelo, l.promptHash))
      throw new UserError(
        `El lector «${l.id}» no ha pasado la autoprueba con este modelo y este prompt, así que no se fía de lo que leyó. Ejecuta: evol skills audit --autoprueba`,
      );

  const manifest = readManifest(dir);
  const previous = manifest.skills[skill.id]?.auditoria;
  const previousDir =
    previous &&
    previous.huella !== skill.huella &&
    existsSync(join(snapshotBase(previous.huella), "skill"))
      ? join(snapshotBase(previous.huella), "skill")
      : null;

  show(
    `Skill «${skill.id}»  huella ${skill.huella.slice(0, 16)}…  veredicto ${report.veredicto.toUpperCase()}`,
  );
  show(`Origen: ${report.origen.tipo}${report.origen.propia ? ", propia" : ", de terceros"}`);
  for (const l of report.subproceso?.lectores ?? [])
    show(
      `Lector: ${l.id} (${l.modelo}), ${l.aceptados} hallazgo(s) verificados, ${l.descartados} descartados`,
    );
  const warnings = report.hallazgos.filter((h) => h.nivel === "aviso");
  if (warnings.length > 0) {
    show("Avisos:");
    for (const h of warnings) show(`  ! ${h.texto}${h.archivo ? ` (${h.archivo})` : ""}`);
  }
  const caps = Object.entries(report.capacidades.declaradas ?? report.capacidades.inferidas);
  if (caps.length > 0) {
    show("Capacidades de los scripts:");
    for (const [ruta, c] of caps) show(`  ${ruta}: ${describeCap(c)}`);
  }
  if (report.inventario.scripts.length > 0) {
    show("Scripts respecto a la última versión aprobada:");
    for (const l of scriptDiff(previousDir, join(snapshotBase(skill.huella), "skill")))
      show(`  ${l}`);
  }

  await confirm.name(skill.id);
  const accepted = warnings.length > 0;
  if (accepted) await confirm.warnings(warnings);

  const estado = accepted ? "con-avisos" : "aprobada";
  manifest.skills[skill.id] = {
    alcance: "personal",
    fases: [],
    ...manifest.skills[skill.id],
    auditoria: {
      estado,
      huella: skill.huella,
      fecha: now.toISOString(),
      informe: reportPath(skill.huella),
      aprobadaPor: confirm.approver,
      avisosAceptados: accepted,
    },
  };
  writeManifest(dir, manifest);
  return { estado, huella: skill.huella };
}
