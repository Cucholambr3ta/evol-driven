import { join, resolve } from "node:path";
import type {
  Availability,
  CodeIntelProvider,
  ImpactItem,
  ImpactResult,
  QueryOptions,
  SymbolRef,
  TraceResult,
  TraceStep,
} from "../provider.js";
import { AmbiguousSymbolError, SymbolNotFoundError } from "../provider.js";
import { GRAPH_FILE, indexProject } from "./indexer.js";
import { GraphStore, toSymbolRef } from "./store.js";
import type { EdgeKind, NodeRow } from "./store.js";

/** Evol's own indexer: ts-morph analysis stored in SQLite. */
export class NativeProvider implements CodeIntelProvider {
  readonly name = "native";
  private readonly root: string;

  constructor(
    root: string,
    private readonly options: { autoIndex?: boolean } = {},
  ) {
    this.root = resolve(root);
  }

  // The methods are async on purpose: failures must be rejected promises, not synchronous throws.
  async available(): Promise<Availability> {
    return { ok: true, detail: "indexador propio (ts-morph + SQLite)" };
  }

  private use<T>(fn: (store: GraphStore) => T): T {
    if (this.options.autoIndex !== false) indexProject(this.root);
    const store = new GraphStore(join(this.root, GRAPH_FILE));
    try {
      return fn(store);
    } finally {
      store.close();
    }
  }

  private resolveOne(store: GraphStore, query: string): NodeRow {
    const found = store.find(query);
    const [first] = found;
    if (!first) throw new SymbolNotFoundError(query);
    if (found.length > 1) throw new AmbiguousSymbolError(query, found.map(toSymbolRef));
    return first;
  }

  async findSymbol(query: string): Promise<SymbolRef[]> {
    return this.use((store) => store.find(query).map(toSymbolRef));
  }

  async impact(query: string, options: QueryOptions = {}): Promise<ImpactResult> {
    return this.use((store) => {
      const target = this.resolveOne(store, query);
      const seeds = [target.id, ...store.children(target.id)];
      const kinds: EdgeKind[] =
        target.kind === "file"
          ? ["IMPORTS", "CALLS", "EXTENDS", "TESTS"]
          : ["CALLS", "EXTENDS", "TESTS"];
      const dependents: ImpactItem[] = [];
      for (const row of store.dependents(seeds, kinds, options.maxDepth ?? 10)) {
        const node = store.getNode(row.id);
        if (node) dependents.push({ ...toSymbolRef(node), depth: row.depth, via: row.via });
      }
      return { target: toSymbolRef(target), dependents };
    });
  }

  async trace(query: string, options: QueryOptions = {}): Promise<TraceResult> {
    return this.use((store) => {
      const entry = this.resolveOne(store, query);
      const seeds = [entry.id, ...store.children(entry.id)];
      const steps: TraceStep[] = [];
      for (const row of store.reachable(seeds, options.maxDepth ?? 5)) {
        const node = store.getNode(row.id);
        if (node) steps.push({ ...toSymbolRef(node), depth: row.depth, from: row.from });
      }
      return { entry: toSymbolRef(entry), steps };
    });
  }
}
