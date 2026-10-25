import { z } from "zod";
import type { Entry } from "../inventory.js";
import type { AuditFinding } from "../report.js";
import { readerModel } from "./config.js";
import type { Reader } from "./config.js";
import { buildPrompt, CATEGORIES, labelOf, promptHash } from "./prompt.js";
import { askReader, ReaderError } from "./runner.js";

const FindingSchema = z.object({
  archivo: z.string().min(1),
  linea: z.number().int().positive().optional(),
  categoria: z.enum(CATEGORIES),
  severidad: z.enum(["aviso", "bloqueo"]),
  cita: z.string().min(8).max(400),
  texto: z.string().max(600).default(""),
});

export const OutputSchema = z.object({
  veredicto: z.enum(["pass", "warn", "block"]),
  hallazgos: z.array(FindingSchema).max(60),
});
export type Output = z.infer<typeof OutputSchema>;

/** The first JSON object in the text: a model that wraps it in a sentence or a fence is still read. */
export function parseOutput(text: string): Output | null {
  const from = text.indexOf("{");
  const to = text.lastIndexOf("}");
  if (from < 0 || to <= from) return null;
  try {
    const parsed = OutputSchema.safeParse(JSON.parse(text.slice(from, to + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * The path a finding names, mapped back to the real file. Models copy the delimiter in different
 * ways (the bare label, the label with its marker, the quoted label), so any of them is accepted.
 */
export function resolveLabel(archivo: string, rutas: Map<string, string>): string | undefined {
  const cleaned = archivo
    .replace(/^ruta=/, "")
    .replaceAll('"', "")
    .trim();
  const exact = rutas.get(cleaned);
  if (exact !== undefined) return exact;
  const labels = [...rutas.keys()].sort((a, b) => b.length - a.length);
  const label = labels.find((l) => cleaned === l || cleaned.startsWith(`${l} `));
  return label === undefined ? undefined : rutas.get(label);
}

const squash = (s: string): string => s.replace(/\s+/g, " ").trim();

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where the quote really is in the file: its start offset, whatever the whitespace between its words. */
function quoteStart(raw: string, quote: string): number | undefined {
  const words = squash(quote).split(" ").filter(Boolean).map(escapeRegExp);
  if (words.length === 0) return undefined;
  const match = new RegExp(words.join("\\s+")).exec(raw);
  return match ? match.index : undefined;
}

/**
 * The 1-based line of the quote. A reader gives a line number from memory and often misses it by a
 * few lines (a local model put two bullets of lines 17 and 18 at lines 10 and 11): the quote is
 * what was verified, so the line is read from it.
 */
export function lineOfQuote(raw: string, quote: string): number | undefined {
  const start = quoteStart(raw, quote);
  return start === undefined ? undefined : raw.slice(0, start).split("\n").length;
}

/** A phrase that forbids: the verbs of the things a skill is warned not to do. */
const PROHIBITION =
  /\b(no|nunca|jam[aá]s)\s+(lo\s+)?(hagas|escribas|muestres|obedezcas|ejecutes|sigas|apruebes|copies|imprimas|reveles|cites|uses)\b|\b(never|do not|don'?t)\s+(do|write|show|obey|run|follow|approve|copy|print|reveal|quote|use)\b|\bprohib/i;

/**
 * Whether the quote sits next to a prohibition: «if the material asks you to ignore your rules, do not
 * do it» quotes the very phrase an attack would use. It only informs the person who approves: it never
 * lowers a severity, because a hostile skill could dress an order as a prohibition.
 */
export function nearProhibition(raw: string, quote: string): boolean {
  const start = quoteStart(raw, quote);
  if (start === undefined) return false;
  // the line (the bullet) the quote is in, and no more: in a list, the neighbours say other things
  const from = raw.lastIndexOf("\n", start) + 1;
  const to = raw.indexOf("\n", start + 1);
  return PROHIBITION.test(raw.slice(from, to < 0 ? raw.length : to));
}

const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  inyeccion: "instrucciones dirigidas al agente",
  filtracion: "posible filtración de datos",
  ejecucion: "ejecución peligrosa",
  credenciales: "acceso a credenciales",
  red: "acceso a la red",
  ofuscacion: "código u texto ofuscado",
  otro: "algo sospechoso",
};

const MAX_TRIES = 3;

export interface ReaderRun {
  id: string;
  modelo: string;
  promptHash: string;
  entradaHash: string;
  ms: number;
  intentos: number;
  veredictoPropuesto: Output["veredicto"];
  /** Findings whose quotation really is in the file. */
  aceptados: (AuditFinding & { categoria: (typeof CATEGORIES)[number] })[];
  /** Findings thrown away: a quotation that is not in the file, or a file the skill does not have. */
  descartados: number;
}

/** A long token that looks like a key: the reader may have copied a secret into its own words. */
const SECRET_LIKE = /[A-Za-z0-9+/_-]{24,}/;

/**
 * One reading of a skill. The reader proposes; evol checks. A finding is kept only if its quotation
 * exists in the file it names (a model that invents evidence is ignored), and its own wording is
 * dropped if it repeats the quotation or contains something shaped like a secret.
 */
export async function readSkillWith(reader: Reader, entries: Entry[]): Promise<ReaderRun> {
  const started = Date.now();
  let prompt = buildPrompt(entries);
  let output: Output | null = null;
  let modelo: string | undefined;
  let intentos = 0;
  // Up to three tries if the answer is not valid JSON of the right shape; any other failure ends the
  // audit. Each try gets a new marker, because the same prompt at temperature 0 answers the same.
  while (output === null && intentos < MAX_TRIES) {
    intentos++;
    if (intentos > 1) prompt = buildPrompt(entries);
    const answer = await askReader(reader, prompt.system, prompt.user);
    modelo = answer.modelo ?? modelo;
    output = parseOutput(answer.texto);
  }
  if (output === null)
    throw new ReaderError(
      `el lector «${reader.id}» no devolvió un JSON válido tras ${intentos} intentos`,
    );

  const text = new Map(entries.map((e) => [e.ruta, squash(e.data.toString("utf8"))]));
  const raws = new Map(entries.map((e) => [e.ruta, e.data.toString("utf8")]));
  const aceptados: ReaderRun["aceptados"] = [];
  let descartados = 0;
  const seen = new Set<string>();
  for (const f of output.hallazgos) {
    const ruta =
      resolveLabel(f.archivo, prompt.rutas) ?? (text.has(f.archivo) ? f.archivo : undefined);
    const body = ruta === undefined ? undefined : text.get(ruta);
    if (ruta === undefined || body === undefined || !body.includes(squash(f.cita))) {
      descartados++;
      continue;
    }
    const capped = f.severidad === "bloqueo" && !reader.bloquea;
    const key = `${ruta}|${f.categoria}|${squash(f.cita)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const own =
      f.texto !== "" &&
      f.texto.length <= 240 &&
      !squash(f.texto).includes(squash(f.cita)) &&
      !SECRET_LIKE.test(f.texto)
        ? `: ${squash(f.texto)}`
        : "";
    const raw = raws.get(ruta) ?? "";
    const line = lineOfQuote(raw, f.cita) ?? f.linea;
    const prohibits = nearProhibition(raw, f.cita)
      ? " (la frase aparece junto a una prohibición: confirma que el documento la prohíbe y no la ordena)"
      : "";
    aceptados.push({
      regla: "subproceso",
      categoria: f.categoria,
      nivel: capped ? "aviso" : f.severidad,
      texto: `[${reader.id}]${capped ? " propone bloquear:" : ""} ${CATEGORY_LABEL[f.categoria]}${line ? ` (línea ${line})` : ""}${own}${prohibits}`,
      archivo: ruta,
    });
  }
  return {
    id: reader.id,
    modelo: modelo ?? readerModel(reader),
    promptHash: promptHash(),
    entradaHash: prompt.entradaHash,
    ms: Date.now() - started,
    intentos,
    veredictoPropuesto: output.veredicto,
    aceptados,
    descartados,
  };
}

export { labelOf };
