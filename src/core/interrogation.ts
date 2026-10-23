import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { UserError } from "./errors.js";
import { evolPath } from "./paths.js";
import { currentArtifacts } from "./pipeline.js";
import type { PipelineContext } from "./pipeline.js";

/**
 * «A plan nobody questioned is not approved.» After the plan is interrogated (the skill
 * `interrogar-plan`), what was asked and answered is written in a document and recorded here against
 * the exact content of the plan phase's artifacts. Change the plan afterwards and the mark no longer
 * counts: the questions were about another plan.
 */
export const INTERROGATION_FILE = "plan-interrogado.json";

export interface InterrogationMark {
  version: 1;
  /** Hash of the plan phase's artifacts when it was interrogated. */
  hash: string;
  fecha: string;
  /** The document with the questions and the answers, relative to the project. */
  documento: string;
  por: string;
}

export type InterrogationState =
  | { estado: "vigente"; marca: InterrogationMark }
  | { estado: "obsoleta"; marca: InterrogationMark }
  | { estado: "falta" };

const markFile = (root: string): string => evolPath(root, INTERROGATION_FILE);

/** The plan's identity: the hashes of every artifact of the phase (and the configuration), in order. */
export function planHash(ctx: PipelineContext): string {
  const artifacts = currentArtifacts(ctx, "plan");
  const lines = Object.keys(artifacts)
    .sort()
    .map((k) => `${k}\0${artifacts[k]}`);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export function readMark(root: string): InterrogationMark | null {
  if (!existsSync(markFile(root))) return null;
  try {
    const parsed = JSON.parse(readFileSync(markFile(root), "utf8")) as InterrogationMark;
    return parsed.version === 1 && typeof parsed.hash === "string" ? parsed : null;
  } catch {
    // an unreadable mark is no mark: the plan counts as not interrogated
    return null;
  }
}

export function interrogationState(ctx: PipelineContext): InterrogationState {
  const marca = readMark(ctx.root);
  if (!marca) return { estado: "falta" };
  return marca.hash === planHash(ctx)
    ? { estado: "vigente", marca }
    : { estado: "obsoleta", marca };
}

/** The «Interrogado» section of a document: the lines under that heading, up to the next heading. */
function interrogatedSection(text: string): string[] | null {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^#{1,4}\s+Interrogado\b/i.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,4}\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).map((l) => l.trim()).filter((l) => l !== "");
}

/**
 * Records that the plan was interrogated. It needs the document where the interrogation is written,
 * with an «Interrogado» section that says something (an empty heading does not count), and the plan
 * has to be the current phase. It does not approve anything and it does not decide that the answers
 * are good: the person who approves reads the document.
 */
export function recordInterrogation(
  ctx: PipelineContext,
  documento: string,
  por: string,
  now: Date = new Date(),
): InterrogationMark {
  if (ctx.state.currentPhase !== "plan")
    throw new UserError(
      `Solo se interroga el plan cuando es la fase actual (ahora es «${ctx.state.currentPhase}»).`,
    );
  const file = resolve(ctx.root, documento);
  const rel = relative(ctx.root, file);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel))
    throw new UserError("El documento de la interrogación debe estar dentro del proyecto.");
  if (!existsSync(file)) throw new UserError(`No existe ${rel}.`);
  const section = interrogatedSection(readFileSync(file, "utf8"));
  if (section === null)
    throw new UserError(
      `«${rel}» no tiene una sección «Interrogado»: escribe en ella lo que se preguntó y lo que se resolvió.`,
    );
  if (section.length < 3)
    throw new UserError(
      `La sección «Interrogado» de «${rel}» está casi vacía (${section.length} línea(s)): una interrogación deja al menos las preguntas y sus respuestas.`,
    );
  const mark: InterrogationMark = {
    version: 1,
    hash: planHash(ctx),
    fecha: now.toISOString(),
    documento: rel.split("\\").join("/"),
    por,
  };
  mkdirSync(dirname(markFile(ctx.root)), { recursive: true });
  const tmp = `${markFile(ctx.root)}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(mark, null, 2)}\n`);
  renameSync(tmp, markFile(ctx.root));
  return mark;
}

export const MIN_OVERRIDE_REASON = 10;
