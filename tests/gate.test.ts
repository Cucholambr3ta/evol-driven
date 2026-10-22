import { appendFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  appendApproval,
  ensureKey,
  findValidApproval,
  keyPath,
  logPath,
  readKey,
  readLog,
  verifyChain,
} from "../src/core/gate.js";
import type { GateEntry } from "../src/core/gate.js";
import { isolateUserConfig, tempDir } from "./helpers.js";

let configDir: string;
beforeAll(() => {
  configDir = isolateUserConfig();
});

function rewrite(root: string, entries: GateEntry[]): void {
  writeFileSync(logPath(root), entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

describe("clave del gate (criterio 3)", () => {
  it("vive en la configuración del usuario, con permisos 0600", () => {
    ensureKey("proyecto-a");
    expect(keyPath("proyecto-a").startsWith(configDir)).toBe(true);
    expect(statSync(keyPath("proyecto-a")).mode & 0o777).toBe(0o600);
  });

  it("es estable: pedirla otra vez devuelve la misma", () => {
    expect(ensureKey("proyecto-b").equals(ensureKey("proyecto-b"))).toBe(true);
    expect(readKey("no-existe")).toBeNull();
  });

  it("cada proyecto tiene una clave distinta", () => {
    expect(ensureKey("p1").equals(ensureKey("p2"))).toBe(false);
  });
});

describe("cadena de aprobaciones", () => {
  it("una cadena válida verifica y cada entrada apunta a la anterior", () => {
    const root = tempDir();
    const key = ensureKey("cadena");
    appendApproval(root, key, { phase: "briefing", approver: "ana", artifacts: { "a.md": "1" } });
    appendApproval(root, key, { phase: "spec", approver: "ana", artifacts: { "b.md": "2" } });
    const log = readLog(root);
    expect(log).toHaveLength(2);
    expect(log[1]?.previous_hash).not.toBe("0".repeat(64));
    expect(verifyChain(log, key)).toEqual({ ok: true });
  });

  it("detecta que se modificó el contenido de una entrada", () => {
    const root = tempDir();
    const key = ensureKey("manipulado");
    appendApproval(root, key, { phase: "briefing", approver: "ana", artifacts: { "a.md": "1" } });
    const log = readLog(root);
    rewrite(root, [{ ...(log[0] as GateEntry), approver: "intruso" }]);
    const result = verifyChain(readLog(root), key);
    expect(result.ok).toBe(false);
  });

  it("detecta una entrada eliminada del medio (cadena rota)", () => {
    const root = tempDir();
    const key = ensureKey("rota");
    for (const phase of ["briefing", "spec", "plan"] as const) {
      appendApproval(root, key, { phase, approver: "ana", artifacts: {} });
    }
    const log = readLog(root);
    rewrite(root, [log[0] as GateEntry, log[2] as GateEntry]);
    expect(verifyChain(readLog(root), key).ok).toBe(false);
  });

  it("detecta una firma hecha con otra clave", () => {
    const root = tempDir();
    appendApproval(root, ensureKey("falsa"), { phase: "briefing", approver: "ana", artifacts: {} });
    expect(verifyChain(readLog(root), ensureKey("otra")).ok).toBe(false);
  });

  it("detecta una entrada añadida a mano sin firma válida", () => {
    const root = tempDir();
    const key = ensureKey("añadida");
    const entry = appendApproval(root, key, { phase: "briefing", approver: "ana", artifacts: {} });
    appendFileSync(logPath(root), JSON.stringify({ ...entry, seq: 1, signature: "AAAA" }) + "\n");
    expect(verifyChain(readLog(root), key).ok).toBe(false);
  });

  it("la aprobación solo es vigente mientras los artefactos no cambien (criterio 4)", () => {
    const root = tempDir();
    const key = ensureKey("vigente");
    appendApproval(root, key, {
      phase: "briefing",
      approver: "ana",
      artifacts: { "a.md": "hash1" },
    });
    const log = readLog(root);
    expect(findValidApproval(log, "briefing", { "a.md": "hash1" })).not.toBeNull();
    expect(findValidApproval(log, "briefing", { "a.md": "hash2" })).toBeNull();
    expect(findValidApproval(log, "briefing", { "a.md": "hash1", "b.md": "x" })).toBeNull();
    expect(findValidApproval(log, "spec", { "a.md": "hash1" })).toBeNull();
  });

  it("el registro no guarda ni la clave ni nada que la revele", () => {
    const root = tempDir();
    const key = ensureKey("sin-clave");
    appendApproval(root, key, { phase: "briefing", approver: "ana", artifacts: {} });
    const text = readFileSync(join(root, ".evol", "gate-log.jsonl"), "utf8");
    expect(text).not.toContain(key.toString("hex"));
    expect(text).not.toContain(key.toString("base64"));
  });
});
