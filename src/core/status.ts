import { findValidApproval, readKey, readLog, verifyChain } from "./gate.js";
import { currentArtifacts, describe } from "./pipeline.js";
import type { PhaseOverview, PipelineContext } from "./pipeline.js";
import type { Phase } from "./phases.js";

export type ApprovalState = "vigente" | "pendiente" | "obsoleta" | "no-verificable" | "no-integro";

export interface StatusReport extends PhaseOverview {
  project: string;
  adopted: Phase[];
  approval: { state: ApprovalState; detail?: string };
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
  } else if (findValidApproval(log, overview.phase, currentArtifacts(ctx, overview.phase))) {
    report.approval = { state: "vigente" };
  } else if (log.some((e) => e.phase === overview.phase)) {
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
