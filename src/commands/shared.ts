import { UserError } from "../core/errors.js";
import { findProjectRoot } from "../core/paths.js";

export function requireProject(): string {
  const root = findProjectRoot();
  if (!root) {
    throw new UserError(
      "No estás dentro de un proyecto evol (no hay evol.config.json aquí ni en las carpetas superiores).",
    );
  }
  return root;
}

export function out(line = ""): void {
  process.stdout.write(`${line}\n`);
}

export function warn(line: string): void {
  process.stderr.write(`aviso: ${line}\n`);
}
