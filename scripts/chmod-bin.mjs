import { chmodSync } from "node:fs";
import { join } from "node:path";

// tsc does not keep the executable bit; the bin must be runnable when used straight from dist/.
chmodSync(join(import.meta.dirname, "..", "dist", "cli.js"), 0o755);
