import { Child } from "./a.js";

export const main = (): string => new Child().run();

export function unused(): number {
  return 1;
}
