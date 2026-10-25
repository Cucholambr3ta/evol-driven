import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { userInfo } from "node:os";
import { sha256 } from "./hash.js";
import { evolPath, userConfigDir } from "./paths.js";
import { UserError } from "./errors.js";
import { nextPhase } from "./phases.js";
import type { Phase } from "./phases.js";

const GENESIS = "0".repeat(64);

export interface GateEntry {
  seq: number;
  timestamp: string;
  phase: Phase;
  approver: string;
  action: "approved" | "ciclo-nuevo";
  /** Set when the approval skipped a check that normally stops it; part of what is signed. */
  anulacion?: string;
  /**
   * The cycle this entry belongs to, set from the cycle a project opens its second one onward
   * (criterio 146). Absent on every entry of the first cycle, and on every entry written before
   * this field existed: both count as cycle 1.
   */
  ciclo?: number;
  /** path (relative to the project) -> sha256 of the file at approval time */
  artifacts: Record<string, string>;
  nonce: string;
  previous_hash: string;
  payload_hash: string;
  signature: string;
}

export type ChainResult = { ok: true } | { ok: false; reason: string; seq: number };

export function keyPath(projectId: string): string {
  return join(userConfigDir(), "keys", `${projectId}.key`);
}

/** Creates the project's gate key in the user's config dir (mode 0600) if it does not exist. */
export function ensureKey(projectId: string): Buffer {
  const file = keyPath(projectId);
  if (existsSync(file)) return readKeyFile(file);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const key = randomBytes(32);
  writeFileSync(file, key.toString("hex"), { mode: 0o600 });
  chmodSync(file, 0o600);
  return key;
}

export function readKey(projectId: string): Buffer | null {
  const file = keyPath(projectId);
  return existsSync(file) ? readKeyFile(file) : null;
}

function readKeyFile(file: string): Buffer {
  return Buffer.from(readFileSync(file, "utf8").trim(), "hex");
}

function sortedArtifacts(artifacts: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(artifacts).sort(([a], [b]) => a.localeCompare(b)));
}

/** Canonical JSON of the signed fields, in a fixed order. */
function canonicalPayload(entry: Omit<GateEntry, "payload_hash" | "signature">): string {
  return JSON.stringify({
    seq: entry.seq,
    timestamp: entry.timestamp,
    phase: entry.phase,
    approver: entry.approver,
    action: entry.action,
    // undefined is left out of the JSON, so the entries written before these fields still verify
    anulacion: entry.anulacion,
    ciclo: entry.ciclo,
    artifacts: sortedArtifacts(entry.artifacts),
    nonce: entry.nonce,
    previous_hash: entry.previous_hash,
  });
}

function sign(key: Buffer, canonical: string): string {
  return createHmac("sha256", key).update(canonical).digest("base64");
}

function entryHash(entry: Pick<GateEntry, "payload_hash" | "signature">): string {
  return sha256(JSON.stringify({ payload_hash: entry.payload_hash, signature: entry.signature }));
}

export function logPath(root: string): string {
  return evolPath(root, "gate-log.jsonl");
}

export function readLog(root: string): GateEntry[] {
  const file = logPath(root);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GateEntry);
}

function appendEntry(
  root: string,
  key: Buffer,
  base: Omit<GateEntry, "seq" | "nonce" | "previous_hash" | "payload_hash" | "signature">,
): GateEntry {
  const log = readLog(root);
  const last = log[log.length - 1];
  const withChain: Omit<GateEntry, "payload_hash" | "signature"> = {
    ...base,
    seq: log.length,
    nonce: randomBytes(16).toString("base64"),
    previous_hash: last ? entryHash(last) : GENESIS,
  };
  const canonical = canonicalPayload(withChain);
  const entry: GateEntry = {
    ...withChain,
    payload_hash: sha256(canonical),
    signature: sign(key, canonical),
  };
  mkdirSync(dirname(logPath(root)), { recursive: true });
  appendFileSync(logPath(root), `${JSON.stringify(entry)}\n`);
  return entry;
}

export function appendApproval(
  root: string,
  key: Buffer,
  data: {
    phase: Phase;
    approver?: string;
    artifacts: Record<string, string>;
    anulacion?: string;
    ciclo?: number;
  },
): GateEntry {
  return appendEntry(root, key, {
    timestamp: new Date().toISOString(),
    phase: data.phase,
    approver: data.approver ?? userInfo().username,
    action: "approved",
    ...(data.anulacion ? { anulacion: data.anulacion } : {}),
    ...(data.ciclo ? { ciclo: data.ciclo } : {}),
    artifacts: sortedArtifacts(data.artifacts),
  });
}

/**
 * Marks, in the signed log, that a new cycle opened (criterio 146): always from «briefing», the
 * first phase, and with no artifacts of its own — it is not an approval, just a boundary a later
 * `findValidApproval` uses to stop an approval from the previous cycle from still counting.
 */
export function appendCycleOpen(
  root: string,
  key: Buffer,
  data: { approver?: string; ciclo: number; phase: Phase },
): GateEntry {
  return appendEntry(root, key, {
    timestamp: new Date().toISOString(),
    phase: data.phase,
    approver: data.approver ?? userInfo().username,
    action: "ciclo-nuevo",
    ciclo: data.ciclo,
    artifacts: {},
  });
}

/** Fail-closed: any inconsistency makes the whole chain invalid. */
export function verifyChain(entries: GateEntry[], key: Buffer): ChainResult {
  let previous = GENESIS;
  for (const [index, entry] of entries.entries()) {
    if (entry.seq !== index) return { ok: false, reason: "secuencia alterada", seq: index };
    if (entry.previous_hash !== previous) {
      return { ok: false, reason: "la cadena de hashes está rota", seq: index };
    }
    const canonical = canonicalPayload(entry);
    if (sha256(canonical) !== entry.payload_hash) {
      return { ok: false, reason: "el contenido fue modificado", seq: index };
    }
    const expected = Buffer.from(sign(key, canonical));
    const actual = Buffer.from(entry.signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return { ok: false, reason: "la firma no es válida", seq: index };
    }
    previous = entryHash(entry);
  }
  return { ok: true };
}

/**
 * The phase `state.json` should be in, from the signed registry alone: the one after the last
 * entry's phase, or `"done"` after retro. `null` with no entries yet (any phase is fine: nothing
 * to compare against). Used to catch a `state.json` edited by hand to skip an approval
 * (criterio 134): the registry is the source of truth, `state.json` is a cache of it.
 */
export function expectedPhase(entries: GateEntry[]): Phase | "done" | null {
  const last = entries.at(-1);
  if (!last) return null;
  // a cycle opening is not a completed phase moving to the next one: it resets to its own phase
  if (last.action === "ciclo-nuevo") return last.phase;
  return nextPhase(last.phase) ?? "done";
}

export function sameArtifacts(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

/**
 * The most recent approval of `phase` whose artifact hashes still match the files on disk. An
 * entry from before `cycle` (criterio 146) never counts, even with matching hashes: an approval
 * belongs to the cycle it was given in, and a new cycle starts every phase unapproved again.
 */
export function findValidApproval(
  entries: GateEntry[],
  phase: Phase,
  current: Record<string, string>,
  cycle = 1,
): GateEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && (entry.ciclo ?? 1) < cycle) return null;
    if (entry && entry.action === "approved" && entry.phase === phase) {
      return sameArtifacts(entry.artifacts, current) ? entry : null;
    }
  }
  return null;
}

export function requireKey(projectId: string): Buffer {
  const key = readKey(projectId);
  if (!key) {
    throw new UserError(
      `Falta la clave del gate de este proyecto (${keyPath(projectId)}). ` +
        "No se guarda en el repositorio: hay que copiarla desde el equipo donde se creó el proyecto.",
    );
  }
  return key;
}
