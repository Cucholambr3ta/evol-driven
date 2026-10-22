import { join, resolve } from "node:path";
import type { EvolConfig } from "../../core/config.js";
import type { Finding } from "../../core/verify.js";
import { GRAPH_FILE, indexProject, isTestPath } from "./indexer.js";
import { GraphStore } from "./store.js";

/** Symbols modified in the working tree that no test reaches (QA check, native provider only). */
export async function changedSymbolsWithoutTests(
  root: string,
  config: EvolConfig,
): Promise<Finding[]> {
  if (config.codeIntel !== "native") return [];
  indexProject(root);
  const store = new GraphStore(join(resolve(root), GRAPH_FILE));
  try {
    const findings: Finding[] = [];
    for (const node of store.modifiedSymbols()) {
      if (!["function", "method", "class"].includes(node.kind) || isTestPath(node.file)) continue;
      const covered =
        store.hasIncoming(node.id, "TESTS") ||
        store.children(node.id).some((c) => store.hasIncoming(c, "TESTS"));
      if (!covered) {
        findings.push({
          modulo: "-",
          disciplina: "CODEINTEL",
          mensaje: `el símbolo «${node.id}» fue modificado y ningún test lo cubre`,
        });
      }
    }
    return findings;
  } finally {
    store.close();
  }
}
