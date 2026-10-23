import { createInterface } from "node:readline";
import { NotInteractiveError, UserError } from "../core/errors.js";

export function hasTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Asks a person, at the terminal, to type exact words, one question after another, in one session
 * (a second session would lose what the person already typed ahead). Nobody there to ask is an error,
 * and so is closing the input: that is a cancellation, not a crash.
 */
export interface TypingSession {
  confirm(prompt: string, expected: string, cancelMessage?: string): Promise<void>;
  /** Asks a question and returns what was typed, or null if the input was closed. */
  ask(prompt: string): Promise<string | null>;
  close(): void;
}

export function typingSession(): TypingSession {
  if (!hasTerminal()) throw new NotInteractiveError();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Lines are queued as they arrive: a person who types (or pastes) the next answer before it is
  // asked still gets it read, instead of losing it between two questions.
  const queued: string[] = [];
  const waiting: ((line: string | null) => void)[] = [];
  let closed = false;
  rl.on("line", (line) => {
    const next = waiting.shift();
    if (next) next(line);
    else queued.push(line);
  });
  rl.on("close", () => {
    closed = true;
    for (const w of waiting.splice(0)) w(null);
  });
  const nextLine = (): Promise<string | null> => {
    const line = queued.shift();
    if (line !== undefined) return Promise.resolve(line);
    return closed ? Promise.resolve(null) : new Promise((resolve) => waiting.push(resolve));
  };
  return {
    async confirm(prompt, expected, cancelMessage = "Cancelado: lo escrito no coincide.") {
      rl.setPrompt(prompt);
      rl.prompt();
      const answer = await nextLine();
      if (answer === null) throw new UserError("Cancelado: no se escribió nada.");
      if (answer.trim() !== expected) throw new UserError(cancelMessage);
    },
    async ask(prompt) {
      rl.setPrompt(prompt);
      rl.prompt();
      return nextLine();
    },
    close: () => rl.close(),
  };
}

/** Asks a person at the terminal to type `expected`. Throws when nobody is there to ask. */
export async function confirmByTyping(
  prompt: string,
  expected: string,
  cancelMessage = "Cancelado: lo escrito no coincide.",
): Promise<void> {
  const session = typingSession();
  try {
    await session.confirm(prompt, expected, cancelMessage);
  } finally {
    session.close();
  }
}
