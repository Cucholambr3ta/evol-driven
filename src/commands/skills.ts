import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadDisciplines } from "../core/disciplines.js";
import { UserError } from "../core/errors.js";
import { exportSkill } from "../skills/archive.js";
import { auditSkill, parseDeclaration } from "../skills/audit.js";
import { VEREDICTO_LABEL } from "../skills/report.js";
import { checkSkill } from "../skills/check.js";
import type { CheckResult, Level } from "../skills/check.js";
import { disciplineSkills, findSkill, listSkills, resolveSkillsDir } from "../skills/library.js";
import { AUDIT_LABEL, auditState, readManifest } from "../skills/manifest.js";
import { userInfo } from "node:os";
import { NotInteractiveError } from "../core/errors.js";
import { requireReaders } from "../skills/auditor/config.js";
import { secondPass } from "../skills/auditor/pass2.js";
import { selfTest } from "../skills/auditor/selftest.js";
import type { SelfTestResult } from "../skills/auditor/selftest.js";
import { approveSkill } from "../skills/approve.js";
import type { ApproveConfirm } from "../skills/approve.js";
import { hasTerminal, typingSession } from "./tty.js";
import type { TypingSession } from "./tty.js";
import { out } from "./shared.js";

const USAGE =
  "Uso: evol skills <list|check|export|audit|approve> [nombre|origen] [--dir <carpeta>] [--json] [--disciplinas] [--salida <archivo.zip>] [--propia] [--capacidades <archivo.json>] [--subproceso] [--autoprueba]";

const MARK: Record<Level, string> = { ok: "✓", aviso: "!", error: "×" };

function list(dir: string, json: boolean, byDiscipline: boolean): number {
  const manifest = readManifest(dir);
  const skills = listSkills(dir);
  const disciplines = disciplineSkills(loadDisciplines(), dir);
  const covered = disciplines.filter((d) => d.disponible).length;

  if (json) {
    out(
      JSON.stringify(
        {
          carpeta: dir,
          skills: skills.map((s) => {
            const entry = manifest.skills[s.id];
            return {
              id: s.id,
              nombre: s.nombre,
              descripcion: s.descripcion,
              estado: auditState(s, entry),
              alcance: entry?.alcance ?? null,
              fases: entry?.fases ?? [],
              disciplina: entry?.disciplina ?? null,
              archivos: s.archivos.length,
              bytes: s.bytes,
              huella: s.huella,
              error: s.error ?? null,
            };
          }),
          disciplinas: disciplines,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (byDiscipline) {
    const width = Math.max(...disciplines.map((d) => d.id.length));
    for (const d of disciplines) {
      const state = d.skill === null ? "sin skill declarada" : d.disponible ? "✓" : "sin skill";
      out(`${d.id.padEnd(width)}  ${d.tipo.padEnd(9)}  ${(d.skill ?? "—").padEnd(14)}  ${state}`);
    }
    out(`Disciplinas con su skill: ${covered} de ${disciplines.length}.`);
    return 0;
  }

  out(`Biblioteca: ${dir} (${skills.length} ${skills.length === 1 ? "skill" : "skills"})`);
  if (skills.length === 0) out("Todavía no hay skills.");
  const width = Math.max(0, ...skills.map((s) => s.id.length));
  for (const s of skills) {
    const entry = manifest.skills[s.id];
    const phases = entry && entry.fases.length > 0 ? entry.fases.join(",") : "sin fase";
    const description =
      s.descripcion.length > 70 ? `${s.descripcion.slice(0, 69)}…` : s.descripcion;
    out(
      `${s.id.padEnd(width)}  ${AUDIT_LABEL[auditState(s, entry)]}  [${phases}]  — ${description}`,
    );
    if (s.error) out(`${"".padEnd(width)}  ⚠ ${s.error} (se muestra lo que se pudo recuperar)`);
  }
  out(
    `Disciplinas con su skill: ${covered} de ${disciplines.length} (evol skills list --disciplinas).`,
  );
  return 0;
}

function check(dir: string, name: string | undefined, json: boolean): number {
  const manifest = readManifest(dir);
  const skills = name ? [findSkill(dir, name)] : listSkills(dir);
  const results: CheckResult[] = skills.map((s) => checkSkill(s, manifest.skills[s.id]));

  if (json) {
    out(JSON.stringify(results, null, 2));
  } else {
    if (results.length === 0) out(`No hay skills que revisar en ${dir}.`);
    for (const r of results) {
      out(`${MARK[r.nivel]} ${r.skill}`);
      const problems = r.hallazgos.filter((h) => h.nivel !== "ok");
      for (const h of problems) {
        out(`    ${MARK[h.nivel]} ${h.texto}${h.archivo ? ` (${h.archivo})` : ""}`);
      }
      if (problems.length === 0) out("    sin problemas");
    }
    const errors = results.filter((r) => r.nivel === "error").length;
    const warnings = results.filter((r) => r.nivel === "aviso").length;
    if (results.length > 0) {
      out(`${results.length} skill(s): ${errors} con errores, ${warnings} con avisos.`);
    }
  }
  return results.some((r) => r.nivel === "error") ? 1 : 0;
}

function exportOne(dir: string, name: string | undefined, target: string | undefined): number {
  if (!name) throw new UserError("Indica qué skill exportar: evol skills export <nombre>.");
  const skill = findSkill(dir, name);
  const file = resolve(target ?? `${skill.id}.zip`);
  if (existsSync(file)) {
    throw new UserError(`${file} ya existe: elige otro nombre con --salida o bórralo antes.`);
  }
  const { zip, huella, archivos } = exportSkill(skill);
  writeFileSync(file, zip);
  out(`Exportada «${skill.id}»: ${archivos} archivo(s), huella ${huella}`);
  out(`→ ${file}`);
  return 0;
}

async function audit(
  origin: string | undefined,
  propia: boolean,
  capabilitiesFile: string | undefined,
  json: boolean,
  subprocess: boolean,
): Promise<number> {
  if (!origin)
    throw new UserError(
      "Indica qué auditar: una carpeta, un .zip o https://…/repo@<sha de 40 caracteres>.",
    );
  const capacidades = capabilitiesFile
    ? parseDeclaration(readFileSync(resolve(capabilitiesFile), "utf8"), capabilitiesFile)
    : undefined;
  const first = auditSkill(origin, {
    propia,
    ...(capacidades ? { capacidades } : {}),
  });
  const { informe, cuarentena } = first;
  let report = first.report;
  // the readers are asked before the verdict is shown, so what is shown is the whole audit
  if (subprocess && report.huella) report = await secondPass(report.huella, requireReaders());
  if (json) {
    out(JSON.stringify({ ...report, informe, cuarentena }, null, 2));
  } else {
    out(
      `Auditoría de «${report.skill}» (${report.origen.tipo}${report.origen.propia ? ", propia" : ", de terceros"})`,
    );
    if (report.huella) out(`Huella: ${report.huella}`);
    out(`Veredicto: ${VEREDICTO_LABEL[report.veredicto]}`);
    for (const h of report.hallazgos)
      out(`  ${h.nivel === "bloqueo" ? "×" : "!"} ${h.texto}${h.archivo ? ` (${h.archivo})` : ""}`);
    const tools = Object.entries(report.herramientas).map(
      ([n, r]) => `${n} ${r.estado === "ok" ? "✓" : r.estado === "no-aplica" ? "–" : "✗"}`,
    );
    if (tools.length > 0) out(`Herramientas: ${tools.join(" · ")}`);
    if (report.capacidades.propuesta) {
      out(
        "Capacidades propuestas (confírmalas y vuelve a auditar con --capacidades <archivo.json>):",
      );
      out(JSON.stringify({ version: 1, scripts: report.capacidades.propuesta }, null, 2));
    }
    if (informe) out(`Informe: ${informe}`);
    if (cuarentena) out(`Cuarentena: ${cuarentena}`);
    out(
      report.pasadas.subproceso === "hecha"
        ? `Pasada 2 (subproceso): hecha por ${(report.subproceso?.lectores ?? []).map((l) => l.id).join(", ")}.`
        : report.pasadas.subproceso === "fallo"
          ? `Pasada 2 (subproceso): falló: ${report.subproceso?.detalle ?? "sin detalle"}`
          : "Pasada 2 (subproceso): pendiente; se ejecuta con --subproceso y es necesaria para aprobar.",
    );
    if (report.veredicto === "no-auditada")
      out(
        "Una skill «no auditada» no puede aprobarse. Instala las herramientas que faltan y vuelve a ejecutar la auditoría.",
      );
  }
  return report.veredicto === "pass" || report.veredicto === "warn" ? 0 : 1;
}

async function selfTestCommand(json: boolean): Promise<number> {
  const results: Record<string, SelfTestResult> = {};
  for (const reader of requireReaders()) results[reader.id] = await selfTest(reader);
  if (json) out(JSON.stringify(results, null, 2));
  else
    for (const [id, r] of Object.entries(results))
      out(`${r.fiable ? "✓" : "×"} ${id}: ${r.fiable ? "fiable" : "NO fiable"}: ${r.detalle}`);
  return Object.values(results).every((r) => r.fiable) ? 0 : 1;
}

/** Approving is for a person at a terminal: it types the skill's name, and accepts any warnings in writing. */
function ttyApprove(session: TypingSession): ApproveConfirm {
  return {
    approver: userInfo().username,
    name: (skill) =>
      session.confirm(
        `Para aprobar la skill escribe su nombre («${skill}»): `,
        skill,
        "Aprobación cancelada: el nombre no coincide.",
      ),
    warnings: () =>
      session.confirm(
        "Hay avisos. Para aceptarlos escribe «acepto los avisos»: ",
        "acepto los avisos",
        "Aprobación cancelada: no se aceptaron los avisos.",
      ),
  };
}

async function approve(dir: string, name: string | undefined): Promise<number> {
  // fail before reading anything when nobody is there to approve
  if (!hasTerminal()) throw new NotInteractiveError();
  if (!name)
    throw new UserError("Indica qué skill aprobar: evol skills approve <nombre> [--dir <carpeta>]");
  const session = typingSession();
  try {
    const result = await approveSkill(dir, name, ttyApprove(session), out);
    out(
      `Skill «${name}» ${result.estado === "aprobada" ? "aprobada" : "aprobada con avisos aceptados"} (huella ${result.huella.slice(0, 16)}…).`,
    );
  } finally {
    session.close();
  }
  return 0;
}

export default async function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: "string" },
      json: { type: "boolean" },
      disciplinas: { type: "boolean" },
      salida: { type: "string" },
      propia: { type: "boolean" },
      capacidades: { type: "string" },
      subproceso: { type: "boolean" },
      autoprueba: { type: "boolean" },
    },
  });
  const [action, name] = positionals;
  const dir = resolveSkillsDir(values.dir);
  switch (action) {
    case "list":
      return list(dir, values.json === true, values.disciplinas === true);
    case "check":
      return check(dir, name, values.json === true);
    case "export":
      return exportOne(dir, name, values.salida);
    case "audit":
      if (values.autoprueba === true) return selfTestCommand(values.json === true);
      return audit(
        name,
        values.propia === true,
        values.capacidades,
        values.json === true,
        values.subproceso === true,
      );
    case "approve":
      return approve(dir, name);
    default:
      throw new UserError(USAGE);
  }
}
