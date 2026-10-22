/** An error whose message is meant to be shown to the user as-is. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export class NotInteractiveError extends UserError {
  constructor() {
    super(
      "Aprobar requiere una terminal interactiva: lo decide una persona, no un proceso automático.",
    );
    this.name = "NotInteractiveError";
  }
}
