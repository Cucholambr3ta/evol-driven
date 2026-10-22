import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { remember, ROOMS } from "../src/memory/events.js";
import { MemoryUnavailableError, withMemPalace } from "../src/memory/mempalace.js";
import { baseConfig, tempDir } from "./helpers.js";

const hasMemPalace =
  spawnSync("mempalace-mcp", ["--help"], { encoding: "utf8", timeout: 60_000 }).error === undefined;

describe.skipIf(!hasMemPalace)("MemPalace real (criterio 8)", () => {
  it("add seguido de search recupera el dato en el wing del proyecto", async () => {
    const palacePath = tempDir("evol-palace-");
    const wing = `evoltest_${randomBytes(4).toString("hex")}`;
    const config = baseConfig([], { memory: { wing, enabled: true } });
    const marker = `usamos postgres con volumen persistente ${randomBytes(4).toString("hex")}`;

    const id = await remember(config, "decision", marker, { palacePath, timeoutMs: 120_000 });
    expect(id).toMatch(/^drawer_/);

    const hits = await withMemPalace(
      (m) => m.search({ query: "base de datos postgres", wing, limit: 5 }),
      {
        palacePath,
        timeoutMs: 120_000,
      },
    );
    expect(hits.some((h) => h.text.includes(marker))).toBe(true);
    const hit = hits.find((h) => h.text.includes(marker));
    expect(hit?.wing).toBe(wing);
    expect(hit?.room).toBe(ROOMS.decision);
  }, 240_000);

  it("la búsqueda está aislada por wing", async () => {
    const palacePath = tempDir("evol-palace-");
    const wingA = `evoltest_a${randomBytes(3).toString("hex")}`;
    const wingB = `evoltest_b${randomBytes(3).toString("hex")}`;
    await remember(
      baseConfig([], { memory: { wing: wingA, enabled: true } }),
      "contexto",
      "dato secreto del proyecto A",
      {
        palacePath,
        timeoutMs: 120_000,
      },
    );
    const hitsB = await withMemPalace((m) => m.search({ query: "dato secreto", wing: wingB }), {
      palacePath,
      timeoutMs: 120_000,
    });
    expect(hitsB).toEqual([]);
  }, 240_000);

  it("doctor-style status responde", async () => {
    const palacePath = tempDir("evol-palace-");
    const status = await withMemPalace((m) => m.status(), { palacePath, timeoutMs: 120_000 });
    expect(typeof status).toBe("object");
  }, 240_000);
});

describe("MemPalace ausente (criterio 9)", () => {
  it("withMemPalace lanza un error claro cuando el comando no existe", async () => {
    const previous = process.env["EVOL_MEMPALACE_CMD"];
    process.env["EVOL_MEMPALACE_CMD"] = "evol-test-no-such-command";
    try {
      await expect(withMemPalace(() => Promise.resolve(1))).rejects.toThrow(MemoryUnavailableError);
      await expect(withMemPalace(() => Promise.resolve(1))).rejects.toThrow(
        /no se encontró el comando/,
      );
    } finally {
      if (previous === undefined) delete process.env["EVOL_MEMPALACE_CMD"];
      else process.env["EVOL_MEMPALACE_CMD"] = previous;
    }
  });
});
