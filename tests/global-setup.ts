import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** CLI tests run the compiled binary, so dist/ is rebuilt once before the whole suite. */
export default function setup(): void {
  const result = spawnSync("npm", ["run", "build"], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(`npm run build falló:\n${result.stdout}\n${result.stderr}`);
}
