export interface SymbolRef {
  id: string;
  kind: string;
  name: string;
  file: string;
  line: number;
}

export interface ImpactItem extends SymbolRef {
  /** Hops from the target. 1 = direct dependent. */
  depth: number;
  /** Kind of the relation that links it to the previous step (CALLS, EXTENDS, TESTS, IMPORTS). */
  via: string;
}

export interface ImpactResult {
  target: SymbolRef;
  dependents: ImpactItem[];
  /** Provider output that could not be structured. */
  raw?: string;
}

export interface TraceStep extends SymbolRef {
  depth: number;
  /** Id of the step that calls this one. */
  from: string;
}

export interface TraceResult {
  entry: SymbolRef;
  steps: TraceStep[];
  raw?: string;
}

export interface Availability {
  ok: boolean;
  detail: string;
}

export interface QueryOptions {
  maxDepth?: number;
}

/** Common face of every code-intelligence backend. */
export interface CodeIntelProvider {
  readonly name: string;
  available(): Promise<Availability>;
  findSymbol(query: string): Promise<SymbolRef[]>;
  impact(query: string, options?: QueryOptions): Promise<ImpactResult>;
  trace(query: string, options?: QueryOptions): Promise<TraceResult>;
}

export class SymbolNotFoundError extends Error {
  constructor(query: string) {
    super(`No se encontró ningún símbolo que coincida con «${query}».`);
    this.name = "SymbolNotFoundError";
  }
}

export class AmbiguousSymbolError extends Error {
  constructor(
    query: string,
    readonly candidates: SymbolRef[],
  ) {
    super(
      `«${query}» es ambiguo (${candidates.length} coincidencias). Usa el id completo:\n` +
        candidates.map((c) => `  - ${c.id} (${c.kind})`).join("\n"),
    );
    this.name = "AmbiguousSymbolError";
  }
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string, detail: string) {
    super(`El proveedor de código «${provider}» no está disponible: ${detail}`);
    this.name = "ProviderUnavailableError";
  }
}
