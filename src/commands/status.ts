import { loadContext, describe } from "../core/pipeline.js";
import { currentArtifacts } from "../core/pipeline.js";
import { findValidApproval, readKey, readLog, verifyChain } from "../core/gate.js";
import { PHASES } from "../core/phases.js";
import { out, requireProject } from "./shared.js";

export default function run(): Promise<number> {
  const root = requireProject();
  const ctx = loadContext(root);
  const overview = describe(ctx);

  out(`Proyecto: ${ctx.config.name}`);
  out(`Pipeline: ${PHASES.map((p) => (overview.completed.includes(p) ? `✓${p}` : p)).join(" → ")}`);
  if (overview.phase === "done") {
    out("El pipeline terminó: todas las fases están completas.");
    return Promise.resolve(0);
  }
  out(`Fase actual: ${overview.phase}`);

  if (overview.disciplines.length === 0) out("  (ninguna disciplina activa en esta fase)");
  for (const d of overview.disciplines) {
    out(`  [${d.module}] ${d.id} — ${d.nombre}`);
    for (const a of d.artefactos) {
      const ok = a.encontrados >= a.min;
      const need = a.min === 0 ? "opcional" : `≥${a.min}`;
      out(`      ${ok ? "✓" : "✗"} ${a.patron}  (${a.encontrados} encontrado(s), ${need})`);
    }
  }

  const key = readKey(ctx.state.projectId);
  let approval = "pendiente";
  if (!key) approval = "no verificable (falta la clave del gate en este equipo)";
  else {
    const log = readLog(root);
    const chain = verifyChain(log, key);
    if (!chain.ok) approval = `REGISTRO NO ÍNTEGRO (entrada ${chain.seq}: ${chain.reason})`;
    else if (findValidApproval(log, overview.phase, currentArtifacts(ctx, overview.phase)))
      approval = "vigente";
    else if (log.some((e) => e.phase === overview.phase))
      approval = "obsoleta (los artefactos cambiaron)";
  }
  out(`Aprobación de «${overview.phase}»: ${approval}`);
  return Promise.resolve(0);
}
