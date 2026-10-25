import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir, write } from "./helpers.js";

export const skill = (name: string, body = "Haz algo.") =>
  `---\nname: ${name}\ndescription: Una skill de prueba llamada ${name} para las versiones\n---\n\n${body}\n`;

/** A source repository with a signing key of its own (no passphrase), as the tests need. */
export function origin(opts: { signing?: boolean } = {}): string {
  const root = tempDir("evol-origen-");
  const sh = (cmd: string, args: string[]) => spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  write(root, "package.json", JSON.stringify({ name: "evol-driven", version: "0.2.0" }, null, 2));
  write(
    root,
    "package-lock.json",
    JSON.stringify(
      { name: "evol-driven", version: "0.2.0", packages: { "": { version: "0.2.0" } } },
      null,
      2,
    ),
  );
  write(root, "skills/tdd/SKILL.md", skill("tdd"));
  sh("git", ["init", "-q", "-b", "trabajo"]);
  sh("git", ["config", "user.email", "ana@example.com"]);
  sh("git", ["config", "user.name", "Ana"]);
  if (opts.signing !== false) {
    const key = join(tempDir("evol-key-"), "id");
    sh("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", key]);
    const allowed = join(tempDir("evol-signers-"), "allowed_signers");
    writeFileSync(allowed, `ana@example.com ${readFileSync(`${key}.pub`, "utf8")}`);
    sh("git", ["config", "gpg.format", "ssh"]);
    sh("git", ["config", "user.signingkey", `${key}.pub`]);
    sh("git", ["config", "gpg.ssh.allowedSignersFile", allowed]);
  }
  sh("git", ["add", "-A"]);
  sh("git", ["commit", "-q", "-m", "primer commit"]);
  return root;
}

export const git = (root: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: root, encoding: "utf8" });

/** The allowed-signers file that matches the key `origin()` signs with. */
export function signersOf(root: string): string {
  return git(root, "config", "gpg.ssh.allowedSignersFile").stdout.trim();
}
