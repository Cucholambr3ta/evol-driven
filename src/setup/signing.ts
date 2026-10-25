import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Prompter, Say } from "./steps.js";

/**
 * Who may sign a release of evol. `evol update` installs a version only if its tag is signed by a key
 * listed in `allowed_signers`, so the person decides here whose signature counts. Only public keys
 * are read: the private one is never opened.
 */
const KEY_TYPES = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp\d+|sk-ssh-ed25519@openssh\.com)$/;

export interface PublicKey {
  file: string;
  type: string;
  /** The base64 body, which is what identifies the key. */
  body: string;
  /** `SHA256:…`, the same fingerprint `ssh-keygen -l` shows. */
  fingerprint: string;
}

export const sshDir = (): string => process.env["EVOL_SSH_DIR"] ?? join(homedir(), ".ssh");

const fingerprintOf = (body: string): string =>
  `SHA256:${createHash("sha256").update(Buffer.from(body, "base64")).digest("base64").replace(/=+$/, "")}`;

/** The public keys in the SSH folder, the ed25519 ones first. */
export function publicKeys(dir: string = sshDir()): PublicKey[] {
  if (!existsSync(dir)) return [];
  const keys: PublicKey[] = [];
  for (const name of readdirSync(dir)
    .filter((f) => f.endsWith(".pub"))
    .sort()) {
    const [type = "", body = ""] = readFileSync(join(dir, name), "utf8").trim().split(/\s+/);
    if (KEY_TYPES.test(type) && /^[A-Za-z0-9+/=]+$/.test(body))
      keys.push({ file: join(dir, name), type, body, fingerprint: fingerprintOf(body) });
  }
  return keys.sort(
    (a, b) => Number(b.type.includes("ed25519")) - Number(a.type.includes("ed25519")),
  );
}

/** One line of `allowed_signers`: git checks the tag's signer by the tagger's e-mail. */
export const signerLine = (email: string, key: PublicKey): string =>
  `${email} namespaces="git" ${key.type} ${key.body}`;

export interface SignersOutcome {
  estado: "ya-estaba" | "autorizada" | "omitida" | "sin-clave" | "sin-correo";
  detalle?: string;
}

export interface SignersOptions {
  /** Where `allowed_signers` lives. */
  file: string;
  /** The e-mail git signs with (`user.email`); without it a signature cannot be matched. */
  email: string | null;
  dir?: string;
}

/** Offers to authorize the person's own SSH key to sign releases; asks before writing anything. */
export async function setupSigners(
  say: Say,
  prompter: Prompter,
  options: SignersOptions,
): Promise<SignersOutcome> {
  const keys = publicKeys(options.dir);
  const key = keys[0];
  if (!key) {
    say("  ! no hay una clave SSH pública (~/.ssh/*.pub). Crea una: ssh-keygen -t ed25519");
    return { estado: "sin-clave" };
  }
  if (!options.email) {
    say("  ! git no tiene user.email: configúralo (git config --global user.email …) y repite.");
    return { estado: "sin-correo" };
  }
  const current = existsSync(options.file) ? readFileSync(options.file, "utf8") : "";
  if (current.split("\n").some((l) => l.includes(key.body))) {
    say(`  ✓ ${key.fingerprint} ya puede firmar versiones (${options.file})`);
    return { estado: "ya-estaba" };
  }
  const ask = `  ¿Autorizar la clave ${key.fingerprint} (${key.file}) a firmar versiones de evol como ${options.email}? [s/N] `;
  if (!(await prompter.yesNo(ask))) {
    say("  Sin firmantes, `evol update` no instalará ninguna versión.");
    return { estado: "omitida" };
  }
  mkdirSync(dirname(options.file), { recursive: true });
  appendFileSync(
    options.file,
    `${current === "" || current.endsWith("\n") ? "" : "\n"}${signerLine(options.email, key)}\n`,
  );
  say(`  ✓ escrito ${options.file}`);
  say("  Para firmar tú las versiones, en el repositorio de origen:");
  say("    git config gpg.format ssh");
  say(`    git config user.signingkey ${key.file}`);
  say(`    git config gpg.ssh.allowedSignersFile ${options.file}`);
  return { estado: "autorizada" };
}
