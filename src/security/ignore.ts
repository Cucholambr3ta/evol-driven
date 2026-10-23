import { existsSync, readFileSync } from "node:fs";
import { evolPath } from "../core/paths.js";
import type { SecFinding } from "./model.js";

export const IGNORE_FILE = "security-ignore.json";

export interface IgnoreEntry {
  herramienta: string;
  regla: string;
  archivo: string;
  /** Optional: when present it must match too; when absent the whole file is covered for that rule. */
  linea?: number;
  motivo: string;
  responsable: string;
  /** YYYY-MM-DD, the last day the ignore still applies. */
  caduca: string;
}

export interface IgnoreReview {
  /** Entries that apply today. */
  vigentes: IgnoreEntry[];
  /** Problems worth telling the person: rejected entries, expired ones, an unreadable file. */
  problemas: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Today as YYYY-MM-DD in UTC, the same way `caduca` is compared. */
export const dayOf = (now: Date): string => now.toISOString().slice(0, 10);

/**
 * Reads `.evol/security-ignore.json`. A finding is ignored only here, and only with a reason, an
 * owner and an expiry date: an entry missing any of them is rejected (the finding stays), and an
 * expired one stops applying, so the finding comes back.
 */
export function reviewIgnores(root: string, now: Date): IgnoreReview {
  const file = evolPath(root, IGNORE_FILE);
  if (!existsSync(file)) return { vigentes: [], problemas: [] };
  const problemas: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {
      vigentes: [],
      problemas: [`.evol/${IGNORE_FILE} no es un JSON válido: no se ignora nada`],
    };
  }
  const list = (parsed as { ignorados?: unknown } | null)?.ignorados;
  if (!Array.isArray(list)) {
    return {
      vigentes: [],
      problemas: [`.evol/${IGNORE_FILE} no tiene la lista «ignorados»: no se ignora nada`],
    };
  }
  const today = dayOf(now);
  const vigentes: IgnoreEntry[] = [];
  list.forEach((raw: unknown, i) => {
    const e = (raw ?? {}) as Record<string, unknown>;
    const label = `ignorado ${i + 1}`;
    const missing = ["herramienta", "regla", "archivo", "motivo", "responsable", "caduca"].filter(
      (k) => text(e[k]) === "",
    );
    if (missing.length > 0) {
      problemas.push(`${label} rechazado: falta ${missing.join(", ")}`);
      return;
    }
    const caduca = text(e["caduca"]);
    if (!DATE.test(caduca) || Number.isNaN(Date.parse(`${caduca}T00:00:00Z`))) {
      problemas.push(`${label} rechazado: «caduca» debe ser una fecha AAAA-MM-DD`);
      return;
    }
    if (caduca < today) {
      problemas.push(
        `${label} caducó el ${caduca} (${text(e["herramienta"])} ${text(e["regla"])} en ${text(e["archivo"])}): el hallazgo vuelve a aparecer`,
      );
      return;
    }
    const linea = typeof e["linea"] === "number" ? e["linea"] : undefined;
    vigentes.push({
      herramienta: text(e["herramienta"]),
      regla: text(e["regla"]),
      archivo: text(e["archivo"]),
      ...(linea !== undefined ? { linea } : {}),
      motivo: text(e["motivo"]),
      responsable: text(e["responsable"]),
      caduca,
    });
  });
  return { vigentes, problemas };
}

export function isIgnored(f: SecFinding, entries: IgnoreEntry[]): IgnoreEntry | undefined {
  return entries.find(
    (e) =>
      e.herramienta === f.herramienta &&
      e.regla === f.regla &&
      e.archivo === f.archivo &&
      (e.linea === undefined || e.linea === f.linea),
  );
}
