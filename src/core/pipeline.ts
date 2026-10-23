import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { loadConfig } from "./config.js";
import type { EvolConfig, ModuleConfig } from "./config.js";
import { appliesIn, loadDisciplines, resolveDiscipline } from "./disciplines.js";
import type { Discipline, DisciplineRegistry } from "./disciplines.js";
import { CONFIG_FILE } from "./paths.js";
import { NotInteractiveError, UserError } from "./errors.js";
import {
  appendApproval,
  ensureKey,
  findValidApproval,
  readLog,
  requireKey,
  verifyChain,
} from "./gate.js";
import { sha256File } from "./hash.js";
import { nextPhase } from "./phases.js";
import type { Phase } from "./phases.js";
import { loadState, markCompleted, saveState } from "./state.js";
import type { PipelineState } from "./state.js";
import { artifactFiles, matchFiles, verifyDiscipline } from "./verify.js";
import { interrogationState, MIN_OVERRIDE_REASON } from "./interrogation.js";
import { isBlocking } from "./verify.js";
import type { CommandRunner, Finding, SecurityScanner } from "./verify.js";

export type Recorder = (type: string, data: Record<string, unknown>) => void | Promise<void>;

export interface PipelineContext {
  root: string;
  config: EvolConfig;
  registry: DisciplineRegistry;
  state: PipelineState;
  run?: CommandRunner;
  securityScan?: SecurityScanner;
  record?: Recorder;
}

export function loadContext(root: string, extra: Partial<PipelineContext> = {}): PipelineContext {
  const registry = loadDisciplines();
  return {
    root,
    registry,
    config: loadConfig(root, registry),
    state: loadState(root),
    ...extra,
  };
}

export interface ActiveDiscipline {
  module: ModuleConfig;
  discipline: Discipline;
}

export function activeDisciplines(ctx: PipelineContext, phase: Phase): ActiveDiscipline[] {
  const active: ActiveDiscipline[] = [];
  for (const module of ctx.config.modules) {
    for (const id of module.disciplinas) {
      const discipline = ctx.registry.get(id);
      if (discipline && appliesIn(discipline, phase)) {
        active.push({ module, discipline: resolveDiscipline(discipline, module) });
      }
    }
  }
  return active;
}

function moduleRoot(ctx: PipelineContext, module: ModuleConfig): string {
  return join(ctx.root, module.root);
}

/** Retro always needs at least one recorded lesson. */
function lessonFindings(ctx: PipelineContext): Finding[] {
  const file = join(ctx.root, "lecciones.md");
  const has = existsSync(file) && /^###\s+\S/m.test(readFileSync(file, "utf8"));
  return has
    ? []
    : [
        {
          modulo: "-",
          disciplina: "RETRO",
          mensaje:
            "la fase retro exige al menos una lección registrada en lecciones.md (evol memory add --tipo leccion)",
        },
      ];
}

export async function verifyPhase(ctx: PipelineContext, phase: Phase): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const { module, discipline } of activeDisciplines(ctx, phase)) {
    findings.push(
      ...verifyDiscipline(discipline, {
        moduleName: module.name,
        moduleRoot: moduleRoot(ctx, module),
        phase,
        ...(ctx.run ? { run: ctx.run } : {}),
        ...(ctx.securityScan ? { securityScan: ctx.securityScan } : {}),
      }),
    );
  }
  if (phase === "retro") findings.push(...lessonFindings(ctx));
  if (phase === "plan") {
    const state = interrogationState(ctx);
    if (state.estado !== "vigente")
      findings.push({
        modulo: "-",
        disciplina: "PLAN",
        nivel: "aviso",
        mensaje:
          state.estado === "falta"
            ? "el plan todavía no se interrogó: sin esa marca no se puede aprobar (skill interrogar-plan y evol interrogate)"
            : "el plan cambió después de interrogarlo: hay que volver a interrogarlo",
      });
  }
  if (phase === "qa" && ctx.config.qa.requireTestsForChangedSymbols) {
    const { changedSymbolsWithoutTests } = await import("../codeintel/native/changes.js");
    findings.push(...(await changedSymbolsWithoutTests(ctx.root, ctx.config)));
  }
  if (phase === "qa" && ctx.config.qa.requireCriteriaCoverage) {
    const { coverageFindings } = await import("./coverage.js");
    findings.push(...coverageFindings(ctx));
  }
  return findings;
}

/** path (relative to the project, posix) -> sha256, for every artifact of the phase plus the config. */
export function currentArtifacts(ctx: PipelineContext, phase: Phase): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const { module, discipline } of activeDisciplines(ctx, phase)) {
    for (const rel of artifactFiles(discipline, moduleRoot(ctx, module))) {
      const projectRel = posix.normalize(posix.join(module.root.split("\\").join("/"), rel));
      hashes[projectRel] = sha256File(join(ctx.root, projectRel));
    }
  }
  hashes[CONFIG_FILE] = sha256File(join(ctx.root, CONFIG_FILE));
  return hashes;
}

export interface Confirmation {
  approver: string;
}
/** Asks a person to confirm. Must throw NotInteractiveError when there is no person to ask. */
export type Confirm = (phase: Phase) => Promise<Confirmation>;

export interface ApproveOptions {
  /** Approve the plan without having interrogated it, for this reason; it stays in the signed log. */
  sinInterrogar?: string;
}

export async function approvePhase(
  ctx: PipelineContext,
  phase: Phase,
  confirm: Confirm,
  options: ApproveOptions = {},
): Promise<{ seq: number; artifacts: number; anulacion?: string }> {
  if (ctx.state.currentPhase === "done") throw new UserError("El pipeline ya terminó.");
  if (phase !== ctx.state.currentPhase) {
    throw new UserError(
      `Solo se puede aprobar la fase actual («${ctx.state.currentPhase}»), no «${phase}».`,
    );
  }
  const blocking = (await verifyPhase(ctx, phase)).filter(isBlocking);
  if (blocking.length > 0) {
    throw new UserError(
      `No se puede aprobar «${phase}»: hay ${blocking.length} problema(s).\n${formatFindings(blocking)}`,
    );
  }
  let anulacion: string | undefined;
  if (phase === "plan" && interrogationState(ctx).estado !== "vigente") {
    const reason = (options.sinInterrogar ?? "").trim();
    if (reason === "") {
      throw new UserError(
        "No se puede aprobar «plan»: el plan no se interrogó, o cambió después de interrogarlo. Interrógalo (skill interrogar-plan), registra el resultado con «evol interrogate <documento>» y vuelve a aprobar. Si hay un motivo para saltarlo, apruébalo con --sin-interrogar «motivo»: queda registrado y firmado.",
      );
    }
    if (reason.length < MIN_OVERRIDE_REASON) {
      throw new UserError(
        `El motivo de --sin-interrogar es demasiado corto (mínimo ${MIN_OVERRIDE_REASON} caracteres): dice por qué este plan no se interroga.`,
      );
    }
    anulacion = `plan aprobado sin interrogar: ${reason}`;
  }
  const key = ensureKey(ctx.state.projectId);
  const chain = verifyChain(readLog(ctx.root), key);
  if (!chain.ok) {
    throw new UserError(
      `El registro de aprobaciones no es íntegro (entrada ${chain.seq}): ${chain.reason}.`,
    );
  }
  const { approver } = await confirm(phase);
  const artifacts = currentArtifacts(ctx, phase);
  const entry = appendApproval(ctx.root, key, {
    phase,
    approver,
    artifacts,
    ...(anulacion ? { anulacion } : {}),
  });
  await ctx.record?.("approved", {
    phase,
    approver,
    seq: entry.seq,
    artifacts: Object.keys(artifacts).length,
    ...(anulacion ? { anulacion } : {}),
  });
  return {
    seq: entry.seq,
    artifacts: Object.keys(artifacts).length,
    ...(anulacion ? { anulacion } : {}),
  };
}

export interface NextResult {
  advanced: boolean;
  phase: Phase | "done";
  problems: string[];
}

export async function advance(ctx: PipelineContext): Promise<NextResult> {
  const phase = ctx.state.currentPhase;
  if (phase === "done") return { advanced: false, phase, problems: ["El pipeline ya terminó."] };

  const problems: string[] = [];
  const findings = (await verifyPhase(ctx, phase)).filter(isBlocking);
  if (findings.length > 0) problems.push(formatFindings(findings));

  const key = requireKey(ctx.state.projectId);
  const log = readLog(ctx.root);
  const chain = verifyChain(log, key);
  if (!chain.ok) {
    problems.push(
      `El registro de aprobaciones no es íntegro (entrada ${chain.seq}): ${chain.reason}.`,
    );
  } else if (!findValidApproval(log, phase, currentArtifacts(ctx, phase))) {
    problems.push(
      `No hay una aprobación vigente de «${phase}». Si los artefactos cambiaron después de aprobar, hay que volver a aprobar: evol approve ${phase}`,
    );
  }
  if (problems.length > 0) return { advanced: false, phase, problems };

  const following = nextPhase(phase);
  ctx.state = markCompleted(ctx.state, phase, following);
  saveState(ctx.root, ctx.state);
  await ctx.record?.("phase-completed", { phase, next: following ?? "done" });
  return { advanced: true, phase: following ?? "done", problems: [] };
}

export function formatFindings(findings: Finding[]): string {
  return findings.map((f) => `  - [${f.modulo}/${f.disciplina}] ${f.mensaje}`).join("\n");
}

export interface PhaseOverview {
  phase: Phase | "done";
  completed: string[];
  disciplines: {
    module: string;
    id: string;
    nombre: string;
    artefactos: { patron: string; encontrados: number; min: number; pendientes: number }[];
  }[];
}

/** Read-only summary of one phase: nothing is executed. */
export function describePhase(ctx: PipelineContext, phase: Phase): PhaseOverview["disciplines"] {
  return activeDisciplines(ctx, phase).map(({ module, discipline }) => ({
    module: module.name,
    id: discipline.id,
    nombre: discipline.nombre,
    artefactos: discipline.artefactos.map((a) => {
      const files = matchFiles(a.patron, moduleRoot(ctx, module));
      return {
        patron: a.patron,
        encontrados: files.length,
        min: a.min,
        pendientes: files.filter((f) =>
          readFileSync(join(moduleRoot(ctx, module), f), "utf8").includes("[[COMPLETAR]]"),
        ).length,
      };
    }),
  }));
}

/** Read-only summary of the current phase: nothing is executed. */
export function describe(ctx: PipelineContext): PhaseOverview {
  const phase = ctx.state.currentPhase;
  return {
    phase,
    completed: ctx.state.completed.map((c) => c.phase),
    disciplines: phase === "done" ? [] : describePhase(ctx, phase),
  };
}

export { NotInteractiveError };
