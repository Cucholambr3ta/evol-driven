import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publicKeys, setupSigners, signerLine } from "../src/setup/signing.js";
import { tempDir } from "./helpers.js";

const BODY_A = "AAAAC3NzaC1lZDI1NTE5AAAAIGVkMjU1MTlrZXlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ";
const BODY_B = "AAAAC3NzaC1lZDI1NTE5AAAAIGVkMjU1MTlrZXlCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQg";

function sshDir(files: Record<string, string>): string {
  const dir = tempDir("evol-ssh-");
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

const yes = { yesNo: async () => true };
const no = { yesNo: async () => false };
const quiet = (): { say: (l: string) => void; lines: string[] } => {
  const lines: string[] = [];
  return { say: (l) => void lines.push(l), lines };
};

describe("claves públicas para firmar versiones", () => {
  it("lista solo las claves públicas válidas, las ed25519 primero, y nunca abre la privada", () => {
    const dir = sshDir({
      "id_rsa.pub": `ssh-rsa ${BODY_A} correo`,
      "id_ed25519.pub": `ssh-ed25519 ${BODY_B} correo`,
      id_ed25519: "-----BEGIN OPENSSH PRIVATE KEY-----\nsecreto\n",
      "viejo.pub": `ssh-dss ${BODY_A} x`,
      "roto.pub": "esto no es una clave",
    });
    chmodSync(join(dir, "id_ed25519"), 0o000);
    const keys = publicKeys(dir);
    expect(keys.map((k) => k.type)).toEqual(["ssh-ed25519", "ssh-rsa"]);
    expect(keys[0]?.fingerprint).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/);
  });

  it("la huella es la misma que da ssh-keygen", () => {
    const dir = tempDir("evol-ssh-gen-");
    const gen = spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", join(dir, "k")], {
      encoding: "utf8",
    });
    if (gen.status !== 0) return; // ssh-keygen is not installed: nothing to compare with
    const expected = /(SHA256:\S+)/.exec(
      spawnSync("ssh-keygen", ["-lf", join(dir, "k.pub")], { encoding: "utf8" }).stdout,
    )?.[1];
    expect(publicKeys(dir)[0]?.fingerprint).toBe(expected);
  });

  it("la línea de allowed_signers usa el correo de git y el espacio de nombres git", () => {
    const [key] = publicKeys(sshDir({ "k.pub": `ssh-ed25519 ${BODY_A} comentario` }));
    expect(key && signerLine("yo@example.com", key)).toBe(
      `yo@example.com namespaces="git" ssh-ed25519 ${BODY_A}`,
    );
  });
});

describe("evol setup: quién puede firmar versiones", () => {
  const file = (): string => join(tempDir("evol-signers-"), "allowed_signers");

  it("pregunta antes de escribir, y escribe la línea sin el comentario de la clave", async () => {
    const out = file();
    const { say, lines } = quiet();
    const dir = sshDir({ "id_ed25519.pub": `ssh-ed25519 ${BODY_A} comentario privado` });
    const r = await setupSigners(say, yes, { file: out, email: "yo@example.com", dir });
    expect(r.estado).toBe("autorizada");
    expect(readFileSync(out, "utf8")).toBe(
      `yo@example.com namespaces="git" ssh-ed25519 ${BODY_A}\n`,
    );
    expect(readFileSync(out, "utf8")).not.toContain("comentario");
    expect(lines.join("\n")).toContain("git config gpg.format ssh");
  });

  it("si la persona dice que no, no escribe nada", async () => {
    const out = file();
    const dir = sshDir({ "id_ed25519.pub": `ssh-ed25519 ${BODY_A}` });
    const r = await setupSigners(quiet().say, no, { file: out, email: "yo@example.com", dir });
    expect(r.estado).toBe("omitida");
    expect(existsSync(out)).toBe(false);
  });

  it("si la clave ya está autorizada no pregunta ni cambia el archivo", async () => {
    const out = file();
    const dir = sshDir({ "id_ed25519.pub": `ssh-ed25519 ${BODY_A}` });
    writeFileSync(out, `otro@example.com namespaces="git" ssh-ed25519 ${BODY_A}\n`);
    const never = { yesNo: async () => Promise.reject(new Error("no debía preguntar")) };
    const r = await setupSigners(quiet().say, never, { file: out, email: "yo@example.com", dir });
    expect(r.estado).toBe("ya-estaba");
  });

  it("añade a un archivo existente sin pisar lo que ya había, aunque no termine en salto de línea", async () => {
    const out = file();
    writeFileSync(out, `viejo@example.com namespaces="git" ssh-ed25519 ${BODY_B}`);
    const dir = sshDir({ "id_ed25519.pub": `ssh-ed25519 ${BODY_A}` });
    await setupSigners(quiet().say, yes, { file: out, email: "yo@example.com", dir });
    const lines = readFileSync(out, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("viejo@example.com");
    expect(lines[1]).toContain("yo@example.com");
  });

  it("sin clave pública o sin correo de git lo dice y no escribe", async () => {
    const out = file();
    const empty = tempDir("evol-ssh-vacio-");
    const none = await setupSigners(quiet().say, yes, {
      file: out,
      email: "yo@example.com",
      dir: empty,
    });
    expect(none.estado).toBe("sin-clave");
    const dir = sshDir({ "id_ed25519.pub": `ssh-ed25519 ${BODY_A}` });
    const noMail = await setupSigners(quiet().say, yes, { file: out, email: null, dir });
    expect(noMail.estado).toBe("sin-correo");
    expect(existsSync(out)).toBe(false);
  });
});
