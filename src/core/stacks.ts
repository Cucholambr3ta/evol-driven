import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The language of a module's tests, for disciplines (today, only TDD) that need to know how to
 * run them. `ts` is evol's own default and needs no override; `generico` means no known test
 * language was found, so nothing is remapped and the person configures it by hand.
 */
export type StackId = "ts" | "python" | "shell" | "generico";

export interface Stack {
  id: StackId;
  /** Replaces TDD's default artifact pattern ("tests/unit/*.test.ts"). Absent for `ts`/`generico`. */
  rutaPrueba?: string;
  /** Replaces TDD's default command ("npx vitest run tests/unit"). Absent for `ts`/`generico`. */
  comando?: string;
}

export const STACKS: Record<StackId, Stack> = {
  ts: { id: "ts" },
  python: {
    id: "python",
    rutaPrueba: "tests/unit/test_*.py",
    comando: "python -m pytest tests/unit",
  },
  shell: { id: "shell", rutaPrueba: "tests/unit/*.bats", comando: "bats tests/unit" },
  generico: { id: "generico" },
};

export const STACK_IDS = Object.keys(STACKS) as StackId[];

export function isStackId(value: string): value is StackId {
  return (STACK_IDS as string[]).includes(value);
}

/**
 * The language of a module's tests, read only (nothing is changed). `ts` wins over `python`/`shell`
 * when a project has both (a Python script bundled in a Node monorepo, say): Node tooling is what
 * the rest of evol already assumes by default, so it stays the default signal.
 */
export function detectStack(moduleDir: string): StackId {
  if (existsSync(join(moduleDir, "package.json"))) return "ts";
  const entries = readdirSync(moduleDir);
  if (
    existsSync(join(moduleDir, "pyproject.toml")) ||
    entries.some((f) => /^requirements.*\.txt$/.test(f) || f.endsWith(".py"))
  ) {
    return "python";
  }
  if (entries.some((f) => f.endsWith(".sh"))) return "shell";
  return "generico";
}
