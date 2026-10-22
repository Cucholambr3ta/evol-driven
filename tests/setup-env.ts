import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runs before each test file is collected. Projects built while a file is being collected (a
 * `const root = makeProject(...)` inside a describe) would otherwise write their gate keys into
 * the real ~/.config/evol.
 */
const dir = mkdtempSync(join(tmpdir(), "evol-config-"));
process.env["EVOL_CONFIG_DIR"] = dir;
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
