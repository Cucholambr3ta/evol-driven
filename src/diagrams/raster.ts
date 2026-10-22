import { spawnSync } from "node:child_process";
import { ToolUnavailableError } from "./layout.js";

export interface RasterResult {
  bytes: number;
  warnings: string[];
}

/** Rasterizes an SVG with VectorCraft's headless CLI. `scale` is pixels per SVG unit. */
export function rasterize(svgPath: string, pngPath: string, scale = 2): RasterResult {
  const run = spawnSync(
    "vectorcraft-cli",
    ["convert", svgPath, pngPath, "--scale", String(scale)],
    {
      encoding: "utf8",
      timeout: 120_000,
    },
  );
  if (run.error) {
    throw new ToolUnavailableError("VectorCraft (vectorcraft-cli)", "no se encontró el comando");
  }
  if (run.status !== 0) {
    throw new ToolUnavailableError(
      "VectorCraft (vectorcraft-cli)",
      `falló al rasterizar ${svgPath}: ${(run.stderr || run.stdout).trim().split("\n")[0] ?? "sin detalle"}`,
    );
  }
  try {
    const body = JSON.parse(run.stdout.trim().split("\n").pop() ?? "{}") as {
      bytes?: number;
      warnings?: string[];
    };
    return { bytes: body.bytes ?? 0, warnings: body.warnings ?? [] };
  } catch {
    return { bytes: 0, warnings: [] };
  }
}
