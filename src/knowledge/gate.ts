import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { UserError } from "../core/errors.js";
import { runGitleaks } from "../security/runners.js";
import { scanInjection } from "../skills/analyze.js";
import { isBinary } from "../skills/inventory.js";
import { filesOf } from "./capture.js";

/** What counts as documentation: text a person reads (OpenAPI files included). Code and assets stay out. */
export const DOC_FILE = /\.(md|mdx|markdown|txt|rst|adoc|asciidoc|html?|json|ya?ml)$/i;
const MAX_BYTES = 2 * 1024 * 1024;

export interface Rejection {
  ruta: string;
  motivos: string[];
}

export interface Review {
  aceptados: string[];
  rechazados: Rejection[];
  /** Kept, but worth a look: a hidden HTML comment, a phrase that is often benign in documentation. */
  avisos: { ruta: string; texto: string }[];
}

/**
 * The gate before anything is indexed. A document that carries a secret or an instruction aimed at
 * the agent does not get in, and the review says which one and why; it never repeats a secret's
 * value. Without gitleaks nothing is reviewed: a review that did not run is not a pass.
 */
export function reviewCapture(dir: string): Review {
  const docs = filesOf(dir).filter((f) => DOC_FILE.test(f));
  const reasons = new Map<string, Set<string>>();
  const warnings: Review["avisos"] = [];
  const reject = (ruta: string, motivo: string): void =>
    void (reasons.get(ruta) ?? reasons.set(ruta, new Set()).get(ruta))?.add(motivo);

  const secrets = runGitleaks(dir);
  if (secrets.outcome.estado !== "ok")
    throw new UserError(
      `No se pudo revisar la captura: gitleaks ${secrets.outcome.estado === "falta" ? "no está instalado" : "falló"}${secrets.outcome.detalle ? ` (${secrets.outcome.detalle})` : ""}. Sin esa revisión no entra nada.`,
    );
  const docSet = new Set(docs);
  for (const f of secrets.findings)
    if (docSet.has(f.archivo)) reject(f.archivo, `contiene un secreto (${f.regla})`);

  const entries = [];
  for (const ruta of docs) {
    const size = statSync(join(dir, ruta)).size;
    if (size > MAX_BYTES) {
      reject(ruta, "supera 2 MiB");
      continue;
    }
    const data = readFileSync(join(dir, ruta));
    if (isBinary(data)) {
      reject(ruta, "no es texto");
      continue;
    }
    entries.push({ ruta, data });
  }
  for (const f of scanInjection(entries)) {
    if (!f.archivo) continue;
    if (f.nivel === "bloqueo") reject(f.archivo, f.texto);
    else warnings.push({ ruta: f.archivo, texto: f.texto });
  }

  const rechazados = [...reasons].map(([ruta, motivos]) => ({ ruta, motivos: [...motivos] }));
  return {
    aceptados: docs.filter((d) => !reasons.has(d)),
    rechazados,
    avisos: warnings.filter((w) => !reasons.has(w.ruta)),
  };
}

/** Replaces `ready` with a copy of only the accepted documents. */
export function publish(capture: string, ready: string, accepted: string[]): void {
  rmSync(ready, { recursive: true, force: true });
  for (const f of accepted) {
    mkdirSync(dirname(join(ready, f)), { recursive: true });
    copyFileSync(join(capture, f), join(ready, f));
  }
  mkdirSync(ready, { recursive: true });
}
