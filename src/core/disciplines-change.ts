import type { EvolConfig, ModuleConfig } from "./config.js";
import { parseConfig, saveConfig } from "./config.js";
import { appliesIn, artifactPaths } from "./disciplines.js";
import { UserError } from "./errors.js";
import { journalAppend } from "./journal.js";
import { PHASES, phaseIndex } from "./phases.js";
import type { Phase } from "./phases.js";
import type { PipelineContext } from "./pipeline.js";
import { saveState } from "./state.js";

export interface DisciplineChange {
  module: string;
  enable: string[];
  disable: string[];
}

export interface ChangeSummary {
  module: string;
  enabled: string[];
  disabled: string[];
  /** Phases already reached in which a changed discipline applies. */
  affected: Phase[];
  /** Phase the pipeline goes back to so the change is verified and approved again, if any. */
  rewoundTo: Phase | null;
}

/** Asks a person to confirm. Must throw NotInteractiveError when there is no person to ask. */
export type ConfirmChange = (summary: ChangeSummary) => Promise<{ approver: string }>;

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function resolveModule(config: EvolConfig, name: string): ModuleConfig {
  const module = config.modules.find((m) => m.name === name);
  if (!module) {
    throw new UserError(
      `No existe el módulo «${name}». Módulos: ${config.modules.map((m) => m.name).join(", ")}.`,
    );
  }
  return module;
}

/** What a change would do, without touching anything. Throws on invalid input. */
export function planChange(ctx: PipelineContext, change: DisciplineChange): ChangeSummary {
  const module = resolveModule(ctx.config, change.module);
  const enable = unique(change.enable);
  const disable = unique(change.disable);
  if (enable.length + disable.length === 0)
    throw new UserError("No hay ninguna disciplina que cambiar.");

  const known = ctx.registry.ids();
  for (const id of [...enable, ...disable]) {
    if (!known.has(id))
      throw new UserError(`Disciplina desconocida «${id}». Mira: evol disciplines list`);
  }
  const both = enable.filter((id) => disable.includes(id));
  if (both.length > 0)
    throw new UserError(`«${both.join(", ")}» está a la vez en enable y disable.`);
  const already = enable.filter((id) => module.disciplinas.includes(id));
  if (already.length > 0) {
    throw new UserError(`«${already.join(", ")}» ya está activa en el módulo «${module.name}».`);
  }
  const missing = disable.filter((id) => !module.disciplinas.includes(id));
  if (missing.length > 0) {
    throw new UserError(`«${missing.join(", ")}» no está activa en el módulo «${module.name}».`);
  }

  const state = ctx.state;
  const reached =
    state.currentPhase === "done" ? PHASES.length : phaseIndex(state.currentPhase) + 1;
  const adopted = new Set(state.completed.filter((c) => c.adopted).map((c) => c.phase));
  const affected = PHASES.slice(0, reached).filter((phase) =>
    [...enable, ...disable].some((id) => {
      const d = ctx.registry.get(id);
      return d !== undefined && appliesIn(d, phase);
    }),
  );
  // Adopted phases were never approved, so there is nothing to invalidate in them.
  const rewind = affected.find((phase) => !adopted.has(phase) && phase !== state.currentPhase);
  return {
    module: module.name,
    enabled: enable,
    disabled: disable,
    affected,
    rewoundTo: rewind ?? null,
  };
}

/**
 * Enables or disables disciplines in a module. The change needs a person (a project could otherwise
 * loosen its own gate), is written to the journal, and sends the pipeline back to the earliest
 * approved phase where a changed discipline applies: its approval stops being valid because the
 * configuration is part of what the approval signs.
 */
export async function changeDisciplines(
  ctx: PipelineContext,
  change: DisciplineChange,
  confirm: ConfirmChange,
): Promise<ChangeSummary> {
  const summary = planChange(ctx, change);

  const modules = ctx.config.modules.map((m) => {
    if (m.name !== summary.module) return m;
    const disciplinas = [
      ...m.disciplinas.filter((id) => !summary.disabled.includes(id)),
      ...summary.enabled,
    ];
    // Overrides of artifacts or commands that no longer exist would make the config invalid.
    const paths = artifactPaths(ctx.registry, disciplinas);
    const rutas = Object.fromEntries(
      Object.entries(m.rutas ?? {}).filter(([from]) => paths.has(from)),
    );
    const comandos = Object.fromEntries(
      Object.entries(m.comandos ?? {}).filter(([id]) => disciplinas.includes(id)),
    );
    return {
      name: m.name,
      root: m.root,
      disciplinas,
      ...(Object.keys(rutas).length > 0 ? { rutas } : {}),
      ...(Object.keys(comandos).length > 0 ? { comandos } : {}),
    };
  });
  const config = parseConfig({ ...ctx.config, modules }, ctx.registry);

  const { approver } = await confirm(summary);

  saveConfig(ctx.root, config);
  ctx.config = config;
  if (summary.rewoundTo) {
    const target = phaseIndex(summary.rewoundTo);
    ctx.state = {
      ...ctx.state,
      currentPhase: summary.rewoundTo,
      completed: ctx.state.completed.filter((c) => phaseIndex(c.phase) < target),
    };
    saveState(ctx.root, ctx.state);
  }
  const event = {
    module: summary.module,
    enabled: summary.enabled,
    disabled: summary.disabled,
    affected: summary.affected,
    rewoundTo: summary.rewoundTo,
    approver,
  };
  if (ctx.record) await ctx.record("disciplines-changed", event);
  else journalAppend(ctx.root, "disciplines-changed", event);
  return summary;
}
