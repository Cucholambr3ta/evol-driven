import { createInterface } from "node:readline/promises";
import { NotInteractiveError, UserError } from "../core/errors.js";

export function hasTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Asks a person at the terminal to type `expected`. Throws when nobody is there to ask. */
export async function confirmByTyping(
  prompt: string,
  expected: string,
  cancelMessage = "Cancelado: lo escrito no coincide.",
): Promise<void> {
  if (!hasTerminal()) throw new NotInteractiveError();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(prompt);
    if (answer.trim() !== expected) throw new UserError(cancelMessage);
  } finally {
    rl.close();
  }
}
