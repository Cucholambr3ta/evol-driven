import { describe, expect, it } from "vitest";
import { detectStack, isStackId, STACK_IDS } from "../src/core/stacks.js";
import { tempDir, write } from "./helpers.js";

describe("detectStack (criterio 128)", () => {
  it("un package.json manda, aunque también haya un pyproject.toml", () => {
    const root = tempDir();
    write(root, "package.json", "{}");
    write(root, "pyproject.toml", "[project]\n");
    expect(detectStack(root)).toBe("ts");
  });

  it("un pyproject.toml sin package.json es python", () => {
    const root = tempDir();
    write(root, "pyproject.toml", "[project]\nname = 'demo'\n");
    expect(detectStack(root)).toBe("python");
  });

  it("un requirements.txt sin pyproject.toml también es python", () => {
    const root = tempDir();
    write(root, "requirements.txt", "flask\n");
    expect(detectStack(root)).toBe("python");
  });

  it("un .py suelto en la raíz, sin pyproject.toml ni requirements, también es python", () => {
    const root = tempDir();
    write(root, "main.py", "print('hola')\n");
    expect(detectStack(root)).toBe("python");
  });

  it("un .sh en la raíz, sin lo anterior, es shell", () => {
    const root = tempDir();
    write(root, "deploy.sh", "#!/bin/sh\necho hola\n");
    expect(detectStack(root)).toBe("shell");
  });

  it("nada reconocido es genérico", () => {
    const root = tempDir();
    write(root, "README.md", "# demo\n");
    expect(detectStack(root)).toBe("generico");
  });
});

describe("isStackId", () => {
  it("acepta los cuatro lenguajes y nada más", () => {
    for (const id of STACK_IDS) expect(isStackId(id)).toBe(true);
    expect(isStackId("rust")).toBe(false);
    expect(isStackId("")).toBe(false);
  });
});
