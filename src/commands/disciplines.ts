import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { changeDisciplines, planChange } from "../core/disciplines-change.js";
import type { ChangeSummary, ConfirmChange } from "../core/disciplines-change.js";
import { NotInteractiveError, UserError } from "../core/errors.js";
import { phaseDisciplines } from "../core/orchestration.js";
import { isPhase } from "../core/phases.js";
import { loadContext } from "../core/pipeline.js";
import type { PipelineContext } from "../core/pipeline.js";
import { PROFILES } from "../core/profiles.js";
import { closestProfile, suggestDisciplines } from "../core/suggest.js";
import { makeRecorder } from "../memory/events.js";
import { out, requireProject, warn } from "./shared.js";
import { confirmByTyping, hasTerminal } from "./tty.js";

export const USAGE =
  "Uso: evol disciplines <list|active|profiles|suggest|enable|disable> [ID...] [--modulo <nombre>] [--fase <fase>] [--json]";

function describeChange(s: ChangeSummary): string[] {
  const lines = [`Módulo «${s.module}»:`];
  if (s.enabled.length > 0) lines.push(`  se activan: ${s.enabled.join(", ")}`);
  if (s.disabled.length > 0) lines.push(`  se desactivan: ${s.disabled.join(", ")}`);
  if (s.rewoundTo) {
    lines.push(
      `  el pipeline vuelve a la fase «${s.rewoundTo}»: sus aprobaciones dejan de valer (la configuración cambió).`,
    );
  } else if (s.affected.length > 0) {
    lines.push("  la aprobación de la fase actual quedará obsoleta y habrá que repetirla.");
  }
  return lines;
}

/** Asks the person at the terminal to type «confirmar». There is no way to skip it. */
const ttyConfirmChange: ConfirmChange = async (summary) => {
  for (const line of describeChange(summary)) out(line);
  await confirmByTyping(
    "Escribe «confirmar» para aplicar el cambio: ",
    "confirmar",
    "Cambio cancelado.",
  );
  return { approver: userInfo().username };
};

function pickModule(ctx: PipelineContext, requested: string | undefined): string {
  if (requested) return requested;
  const [only, ...rest] = ctx.config.modules;
  if (only && rest.length === 0) return only.name;
  throw new UserError(
    `El proyecto tiene varios módulos (${ctx.config.modules.map((m) => m.name).join(", ")}): indica uno con --modulo.`,
  );
}

function list(ctx: PipelineContext, json: boolean): void {
  const enabledIn = (id: string): string[] =>
    ctx.config.modules.filter((m) => m.disciplinas.includes(id)).map((m) => m.name);
  const rows = ctx.registry.all().map((d) => ({
    id: d.id,
    nombre: d.nombre,
    tipo: d.tipo,
    rol: d.rol,
    skill: d.skill ?? null,
    fases: d.fases,
    transversal: d.transversal === true,
    modulos: enabledIn(d.id),
  }));
  if (json) {
    out(JSON.stringify(rows, null, 2));
    return;
  }
  const width = Math.max(...rows.map((r) => r.id.length));
  for (const r of rows) {
    const phases = `${r.transversal ? "desde " : ""}${r.fases.join(",")}`;
    const where = r.modulos.length > 0 ? `✓ ${r.modulos.join(", ")}` : "·";
    out(`${r.id.padEnd(width)}  ${r.tipo.padEnd(9)}  ${where}  — ${r.nombre} (${phases})`);
  }
}

function suggest(ctx: PipelineContext, json: boolean): void {
  const enabled = new Set(ctx.config.modules.flatMap((m) => m.disciplinas));
  const suggestions = suggestDisciplines(ctx.root, enabled);
  const profile = closestProfile(enabled);
  if (json) {
    out(JSON.stringify({ perfilMasCercano: profile, sugerencias: suggestions }, null, 2));
    return;
  }
  out(`Perfil más cercano a lo que tienes activo: ${profile}`);
  if (suggestions.length === 0)
    out("No hay disciplinas que sugerir a partir de los archivos del proyecto.");
  for (const s of suggestions) out(`  ${s.id} — ${s.motivo}`);
  if (suggestions.length > 0)
    out("Actívalas con: evol disciplines enable <ID...> [--modulo <nombre>]");
}

export default async function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { modulo: { type: "string" }, fase: { type: "string" }, json: { type: "boolean" } },
  });
  const [action, ...ids] = positionals;

  if (action === "profiles") {
    const width = Math.max(...Object.keys(PROFILES).map((n) => n.length));
    for (const [name, p] of Object.entries(PROFILES)) {
      out(`${name.padEnd(width)}  ${p.resumen}`);
      out(`${"".padEnd(width)}  ${p.disciplinas.join(", ")}`);
    }
    return 0;
  }

  if (action === "enable" || action === "disable") {
    // Fail before touching anything when nobody is there to confirm.
    if (!hasTerminal()) throw new NotInteractiveError();
    if (ids.length === 0) throw new UserError(USAGE);
    const root = requireProject();
    const ctx = loadContext(root);
    ctx.record = makeRecorder(root, ctx.config, warn);
    const change = {
      module: pickModule(ctx, values.modulo),
      enable: action === "enable" ? ids : [],
      disable: action === "disable" ? ids : [],
    };
    planChange(ctx, change);
    const summary = await changeDisciplines(ctx, change, ttyConfirmChange);
    out(
      `Listo. ${summary.rewoundTo ? `El pipeline está en «${summary.rewoundTo}».` : "El pipeline sigue en su fase."}`,
    );
    return 0;
  }

  if (action === "active") {
    if (values.fase !== undefined && !isPhase(values.fase))
      throw new UserError(`«${values.fase}» no es una fase.`);
    const report = phaseDisciplines(loadContext(requireProject()), values.fase);
    if (values.json) out(JSON.stringify(report, null, 2));
    else {
      out(`Disciplinas activas en «${report.fase}»:`);
      if (report.disciplinas.length === 0) out("  (ninguna)");
      for (const d of report.disciplinas) {
        out(`  [${d.modulo}] ${d.id} — ${d.nombre}${d.skill ? `  (skill: ${d.skill})` : ""}`);
        for (const a of d.artefactos) out(`      artefacto: ${a.patron} (≥${a.min})`);
        for (const v of d.verificaciones) out(`      verifica: ${v}`);
      }
    }
    return 0;
  }

  if (action === "list" || action === "suggest") {
    const ctx = loadContext(requireProject());
    if (action === "list") list(ctx, values.json === true);
    else suggest(ctx, values.json === true);
    return 0;
  }
  throw new UserError(USAGE);
}
