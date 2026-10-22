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
import type { Phase } from "./phases.js";

const GENESIS = "0".repeat(64);

export interface GateEntry {
  seq: number;
  timestamp: string;
  phase: Phase;
  approver: string;
  action: "approved";
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

export function appendApproval(
  root: string,
  key: Buffer,
  data: { phase: Phase; approver?: string; artifacts: Record<string, string> },
): GateEntry {
  const log = readLog(root);
  const last = log[log.length - 1];
  const base: Omit<GateEntry, "payload_hash" | "signature"> = {
    seq: log.length,
    timestamp: new Date().toISOString(),
    phase: data.phase,
    approver: data.approver ?? userInfo().username,
    action: "approved",
    artifacts: sortedArtifacts(data.artifacts),
    nonce: randomBytes(16).toString("base64"),
    previous_hash: last ? entryHash(last) : GENESIS,
  };
  const canonical = canonicalPayload(base);
  const entry: GateEntry = {
    ...base,
    payload_hash: sha256(canonical),
    signature: sign(key, canonical),
  };
  mkdirSync(dirname(logPath(root)), { recursive: true });
  appendFileSync(logPath(root), `${JSON.stringify(entry)}\n`);
  return entry;
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

export function sameArtifacts(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

/** The most recent approval of `phase` whose artifact hashes still match the files on disk. */
export function findValidApproval(
  entries: GateEntry[],
  phase: Phase,
  current: Record<string, string>,
): GateEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && entry.phase === phase) {
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
