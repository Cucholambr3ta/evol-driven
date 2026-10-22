import type { EvolConfig } from "../core/config.js";
import { GitNexusProvider } from "./gitnexus.js";
import { NativeProvider } from "./native/provider.js";
import type { CodeIntelProvider } from "./provider.js";

/** The configured provider. It never falls back to another one silently. */
export function createProvider(config: EvolConfig, root: string): CodeIntelProvider {
  return config.codeIntel === "gitnexus" ? new GitNexusProvider() : new NativeProvider(root);
}

export * from "./provider.js";
