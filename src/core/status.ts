import { findValidApproval, readKey, readLog, verifyChain } from "./gate.js";
import { currentArtifacts, describe } from "./pipeline.js";
import type { PhaseOverview, PipelineContext } from "./pipeline.js";
import { interrogationState } from "./interrogation.js";
import type { Phase } from "./phases.js";

export type ApprovalState = "vigente" | "pendiente" | "obsoleta" | "no-verificable" | "no-integro";

export interface StatusReport extends PhaseOverview {
  project: string;
  adopted: Phase[];
  approval: { state: ApprovalState; detail?: string };
  /** Only while the plan is the current phase: whether it was interrogated (and the mark still holds). */
  interrogation?: "vigente" | "obsoleta" | "falta";
}

/** Read-only picture of the pipeline. Nothing is executed. */
export function statusReport(ctx: PipelineContext): StatusReport {
  const overview = describe(ctx);
  const report: StatusReport = {
    ...overview,
    project: ctx.config.name,
    adopted: ctx.state.completed.filter((c) => c.adopted).map((c) => c.phase),
    approval: { state: "pendiente" },
  };
  if (overview.phase === "done") return report;
  if (overview.phase === "plan") report.interrogation = interrogationState(ctx).estado;

  const key = readKey(ctx.state.projectId);
  if (!key) {
    report.approval = {
      state: "no-verificable",
      detail: "falta la clave del gate en este equipo",
    };
    return report;
  }
  const log = readLog(ctx.root);
  const chain = verifyChain(log, key);
  if (!chain.ok) {
    report.approval = {
      state: "no-integro",
      detail: `entrada ${chain.seq}: ${chain.reason}`,
    };
  } else if (
    findValidApproval(log, overview.phase, currentArtifacts(ctx, overview.phase), ctx.state.ciclo)
  ) {
    report.approval = { state: "vigente" };
  } else if (
    // only an approval of this cycle can have gone stale: the previous cycle's does not count at all
    log.some(
      (e) =>
        e.action === "approved" && e.phase === overview.phase && (e.ciclo ?? 1) === ctx.state.ciclo,
    )
  ) {
    report.approval = { state: "obsoleta", detail: "los artefactos cambiaron" };
  }
  return report;
}

const APPROVAL_TEXT: Record<ApprovalState, string> = {
  vigente: "vigente",
  pendiente: "pendiente",
  obsoleta: "obsoleta (los artefactos cambiaron)",
  "no-verificable": "no verificable (falta la clave del gate en este equipo)",
  "no-integro": "REGISTRO NO ÍNTEGRO",
};

/**
 * One short line for the IDE's status bar (criterio 140): `evol status --linea`. Counts what still
 * blocks the current phase (a missing artifact, or one with `[[COMPLETAR]]`); with nothing pending,
 * shows the approval state instead.
 */
export function renderStatusLine(report: StatusReport): string {
  if (report.phase === "done") return "Evol · listo (done)";
  const pendientes = report.disciplines.reduce(
    (sum, d) =>
      sum + d.artefactos.reduce((s, a) => s + Math.max(0, a.min - a.encontrados) + a.pendientes, 0),
    0,
  );
  const resumen =
    pendientes > 0
      ? `${pendientes} pendiente${pendientes === 1 ? "" : "s"}`
      : APPROVAL_TEXT[report.approval.state];
  return `Evol · ${report.phase} · ${resumen}`;
}

export function renderStatus(report: StatusReport): string[] {
  const lines = [`Proyecto: ${report.project}`];
  const phases = ["briefing", "spec", "plan", "build", "qa", "retro"] as const;
  lines.push(
    `Pipeline: ${phases
      .map((p) =>
        report.adopted.includes(p) ? `~${p}` : report.completed.includes(p) ? `✓${p}` : p,
      )
      .join(" → ")}`,
  );
  if (report.adopted.length > 0) lines.push("  (~ = fase adoptada: ya estaba hecha antes de evol)");
  if (report.phase === "done") {
    lines.push("El pipeline terminó: todas las fases están completas.");
    return lines;
  }
  lines.push(`Fase actual: ${report.phase}`);
  if (report.disciplines.length === 0) lines.push("  (ninguna disciplina activa en esta fase)");
  for (const d of report.disciplines) {
    lines.push(`  [${d.module}] ${d.id} — ${d.nombre}`);
    for (const a of d.artefactos) {
      const ok = a.encontrados >= a.min && a.pendientes === 0;
      const need = a.min === 0 ? "opcional" : `≥${a.min}`;
      const pending = a.pendientes > 0 ? `, ${a.pendientes} con [[COMPLETAR]]` : "";
      lines.push(
        `      ${ok ? "✓" : "✗"} ${a.patron}  (${a.encontrados} encontrado(s), ${need}${pending})`,
      );
    }
  }
  if (report.interrogation)
    lines.push(
      `Plan interrogado: ${report.interrogation === "vigente" ? "sí" : report.interrogation === "obsoleta" ? "no: cambió después de interrogarlo" : "no"}`,
    );
  const detail = report.approval.detail ? ` — ${report.approval.detail}` : "";
  lines.push(
    `Aprobación de «${report.phase}»: ${APPROVAL_TEXT[report.approval.state]}${
      report.approval.state === "obsoleta" || report.approval.state === "no-verificable"
        ? ""
        : detail
    }`,
  );
  return lines;
}

/** The agent-facing shape of the status: same Spanish keys as the other tools. */
export function statusForAgents(report: StatusReport): Record<string, unknown> {
  return {
    proyecto: report.project,
    fase: report.phase,
    completadas: report.completed,
    adoptadas: report.adopted,
    disciplinas: report.disciplines.map((d) => ({
      modulo: d.module,
      id: d.id,
      nombre: d.nombre,
      artefactos: d.artefactos,
    })),
    aprobacion: { estado: report.approval.state, detalle: report.approval.detail ?? null },
    ...(report.interrogation ? { planInterrogado: report.interrogation } : {}),
  };
}
