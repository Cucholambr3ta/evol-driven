import { greet } from "./b.js";

export class Base {
  hello(): string {
    return greet("x");
  }
}

export class Child extends Base {
  run(): string {
    return this.hello();
  }
}
