import { appendFileSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProvider } from "../src/codeintel/index.js";
import { AmbiguousSymbolError, SymbolNotFoundError } from "../src/codeintel/provider.js";
import type {
  Availability,
  CodeIntelProvider,
  ImpactResult,
  QueryOptions,
  SymbolRef,
  TraceResult,
} from "../src/codeintel/provider.js";
import { changedSymbolsWithoutTests } from "../src/codeintel/native/changes.js";
import { GRAPH_FILE, indexProject } from "../src/codeintel/native/indexer.js";
import { NativeProvider } from "../src/codeintel/native/provider.js";
import { GraphStore } from "../src/codeintel/native/store.js";
import { baseConfig, copyFixture, git, write } from "./helpers.js";

function snapshot(root: string) {
  const store = new GraphStore(join(root, GRAPH_FILE));
  try {
    return store.snapshot();
  } finally {
    store.close();
  }
}

describe("grafo del indexador nativo (criterio 10)", () => {
  const root = copyFixture("sample");
  indexProject(root);
  const { nodes, edges } = snapshot(root);

  it("crea un nodo por archivo, clase, método y función", () => {
    const ids = nodes.map((n) => n.split("|")[0]);
    expect(ids).toEqual(
      expect.arrayContaining([
        "src/a.ts",
        "src/a.ts#Base",
        "src/a.ts#Base.hello",
        "src/a.ts#Child",
        "src/a.ts#Child.run",
        "src/b.ts#greet",
        "src/c.ts#main",
        "src/c.ts#unused",
        "tests/c.test.ts",
      ]),
    );
    expect(nodes).toContain("src/a.ts#Base.hello|method|Base.hello|src/a.ts|4|6");
  });

  it("IMPORTS entre archivos", () => {
    expect(edges).toEqual(
      expect.arrayContaining([
        "src/a.ts|IMPORTS|src/b.ts",
        "src/c.ts|IMPORTS|src/a.ts",
        "tests/c.test.ts|IMPORTS|src/c.ts",
      ]),
    );
  });

  it("CALLS resuelve la llamada importada al símbolo real, no al import", () => {
    expect(edges).toContain("src/a.ts#Base.hello|CALLS|src/b.ts#greet");
    expect(edges.filter((e) => e.includes("|CALLS|") && e.endsWith("ImportSpecifier"))).toEqual([]);
  });

  it("CALLS por this.método y por new Clase().método", () => {
    expect(edges).toContain("src/a.ts#Child.run|CALLS|src/a.ts#Base.hello");
    expect(edges).toContain("src/c.ts#main|CALLS|src/a.ts#Child");
    expect(edges).toContain("src/c.ts#main|CALLS|src/a.ts#Child.run");
  });

  it("EXTENDS, CONTAINS y EXPORTS", () => {
    expect(edges).toContain("src/a.ts#Child|EXTENDS|src/a.ts#Base");
    expect(edges).toContain("src/a.ts#Base|CONTAINS|src/a.ts#Base.hello");
    expect(edges).toContain("src/a.ts|CONTAINS|src/a.ts#Base");
    expect(edges).toContain("src/b.ts|EXPORTS|src/b.ts#greet");
  });

  it("los tests producen TESTS hacia el código, no CALLS", () => {
    expect(edges).toContain("tests/c.test.ts|TESTS|src/c.ts#main");
    expect(edges.filter((e) => e.startsWith("tests/c.test.ts|CALLS"))).toEqual([]);
  });

  it("resuelve JavaScript además de TypeScript", () => {
    const js = copyFixture("sample");
    write(js, "src/util.js", "export function dbl(x) { return x * 2; }\n");
    write(
      js,
      "src/use.js",
      'import { dbl } from "./util.js";\nexport function run() { return dbl(2); }\n',
    );
    indexProject(js);
    expect(snapshot(js).edges).toContain("src/use.js#run|CALLS|src/util.js#dbl");
  });

  it("un archivo con errores de sintaxis no rompe el indexado", () => {
    const broken = copyFixture("sample");
    write(broken, "src/roto.ts", "export function a( {{{ \n");
    expect(() => indexProject(broken)).not.toThrow();
    expect(snapshot(broken).nodes.some((n) => n.startsWith("src/a.ts#Base|"))).toBe(true);
  });
});

describe("impact y trace", () => {
  const root = copyFixture("sample");
  const provider = new NativeProvider(root);

  it("impact devuelve los dependientes transitivos con su profundidad", async () => {
    const result = await provider.impact("greet");
    expect(result.dependents.map((d) => `${d.depth}:${d.id}:${d.via}`)).toEqual([
      "1:src/a.ts#Base.hello:CALLS",
      "2:src/a.ts#Child.run:CALLS",
      "3:src/c.ts#main:CALLS",
      "4:tests/c.test.ts:TESTS",
    ]);
  });

  it("impact respeta la profundidad máxima", async () => {
    const result = await provider.impact("greet", { maxDepth: 2 });
    expect(result.dependents.map((d) => d.id)).toEqual([
      "src/a.ts#Base.hello",
      "src/a.ts#Child.run",
    ]);
  });

  it("impact de una clase incluye a quien llama a sus métodos y a sus subclases", async () => {
    const ids = (await provider.impact("Base")).dependents.map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining(["src/a.ts#Child", "src/a.ts#Child.run", "src/c.ts#main"]),
    );
  });

  it("impact de un archivo sigue sus IMPORTS", async () => {
    const ids = (await provider.impact("src/b.ts")).dependents.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["src/a.ts", "src/c.ts", "tests/c.test.ts"]));
  });

  it("un símbolo sin dependientes devuelve la lista vacía", async () => {
    expect((await provider.impact("unused")).dependents).toEqual([]);
  });

  it("trace sigue las llamadas hacia adelante", async () => {
    const result = await provider.trace("main");
    expect(result.steps.map((s) => `${s.depth}:${s.id}`)).toEqual([
      "1:src/a.ts#Child",
      "1:src/a.ts#Child.run",
      "2:src/a.ts#Base.hello",
      "3:src/b.ts#greet",
    ]);
  });

  it("un símbolo inexistente falla con SymbolNotFoundError", async () => {
    await expect(provider.impact("noExiste")).rejects.toThrow(SymbolNotFoundError);
  });

  it("un nombre ambiguo falla listando los candidatos", async () => {
    const dup = copyFixture("sample");
    write(dup, "src/d.ts", "export function greet(): void {}\n");
    const error = await new NativeProvider(dup).impact("greet").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AmbiguousSymbolError);
    expect((error as AmbiguousSymbolError).candidates.map((c) => c.id).sort()).toEqual([
      "src/b.ts#greet",
      "src/d.ts#greet",
    ]);
  });

  it("el id completo desambigua", async () => {
    const dup = copyFixture("sample");
    write(dup, "src/d.ts", "export function greet(): void {}\n");
    expect((await new NativeProvider(dup).impact("src/d.ts#greet")).dependents).toEqual([]);
  });
});

describe("actualización incremental (criterio 12)", () => {
  it("un segundo index sin cambios no reprocesa ningún archivo", () => {
    const root = copyFixture("sample");
    const first = indexProject(root);
    expect(first.reindexed).toHaveLength(4);
    const second = indexProject(root);
    expect(second.reindexed).toEqual([]);
    expect(second.cascaded).toEqual([]);
    expect(second.unchanged).toBe(4);
  });

  it("tras editar el cuerpo de una función, reprocesa solo ese archivo", () => {
    const root = copyFixture("sample");
    indexProject(root);
    writeFileSync(
      join(root, "src/b.ts"),
      readFileSync(join(root, "src/b.ts"), "utf8").replace("hi ", "hola "),
    );
    const report = indexProject(root);
    expect(report.reindexed).toEqual(["src/b.ts"]);
    expect(report.cascaded).toEqual([]);
    expect(report.unchanged).toBe(3);
  });

  it("tocar un archivo sin cambiar su contenido no lo reprocesa", () => {
    const root = copyFixture("sample");
    indexProject(root);
    const future = new Date(Date.now() + 60_000);
    utimesSync(join(root, "src/b.ts"), future, future);
    expect(indexProject(root).reindexed).toEqual([]);
  });

  it("si cambia el conjunto de símbolos, reprocesa también a quien lo importa", () => {
    const root = copyFixture("sample");
    indexProject(root);
    appendFileSync(join(root, "src/b.ts"), "export function nueva(): number {\n  return 1;\n}\n");
    const report = indexProject(root);
    expect(report.reindexed).toEqual(["src/b.ts"]);
    expect(report.cascaded).toEqual(["src/a.ts"]);
  });

  it("eliminar un archivo lo quita del grafo y reprocesa a quien lo importaba", () => {
    const root = copyFixture("sample");
    indexProject(root);
    rmSync(join(root, "src/b.ts"));
    const report = indexProject(root);
    expect(report.removed).toEqual(["src/b.ts"]);
    expect(report.cascaded).toEqual(["src/a.ts"]);
    const { nodes, edges } = snapshot(root);
    expect(nodes.some((n) => n.startsWith("src/b.ts"))).toBe(false);
    expect(edges.some((e) => e.includes("src/b.ts#greet"))).toBe(false);
  });

  it("--full reprocesa todo", () => {
    const root = copyFixture("sample");
    indexProject(root);
    expect(indexProject(root, { full: true }).reindexed).toHaveLength(4);
  });
});

describe("el grafo es derivable (criterio 13)", () => {
  it("borrar .evol/codegraph.sqlite y reindexar reproduce el mismo grafo", () => {
    const root = copyFixture("sample");
    indexProject(root);
    const before = snapshot(root);
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(join(root, `${GRAPH_FILE}${suffix}`), { force: true });
    indexProject(root);
    expect(snapshot(root)).toEqual(before);
  });

  it("el grafo incremental coincide con uno reconstruido desde cero", () => {
    const root = copyFixture("sample");
    indexProject(root);
    writeFileSync(
      join(root, "src/b.ts"),
      readFileSync(join(root, "src/b.ts"), "utf8").replace("hi ", "hola "),
    );
    appendFileSync(join(root, "src/c.ts"), "export function extra(): number {\n  return 2;\n}\n");
    indexProject(root);
    const incremental = snapshot(root);
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(join(root, `${GRAPH_FILE}${suffix}`), { force: true });
    indexProject(root);
    expect(snapshot(root)).toEqual(incremental);
  });
});

describe("MODIFIES desde git y la verificación de QA", () => {
  function repo() {
    const root = copyFixture("sample");
    git(root, "init", "-q", "-b", "main");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "inicial");
    return root;
  }

  it("sin cambios en el árbol de trabajo no hay símbolos modificados", () => {
    expect(indexProject(repo()).modified).toBe(0);
  });

  it("marca como modificado el símbolo cuyas líneas cambiaron", () => {
    const root = repo();
    writeFileSync(
      join(root, "src/b.ts"),
      readFileSync(join(root, "src/b.ts"), "utf8").replace("hi ", "hola "),
    );
    expect(indexProject(root).modified).toBe(1);
    const store = new GraphStore(join(root, GRAPH_FILE));
    expect(store.modifiedSymbols().map((n) => n.id)).toEqual(["src/b.ts#greet"]);
    store.close();
  });

  it("al comitear, deja de estar modificado", () => {
    const root = repo();
    writeFileSync(
      join(root, "src/b.ts"),
      readFileSync(join(root, "src/b.ts"), "utf8").replace("hi ", "hola "),
    );
    indexProject(root);
    git(root, "commit", "-q", "-am", "cambio");
    expect(indexProject(root).modified).toBe(0);
  });

  it("un archivo nuevo sin comitear cuenta entero como modificado", () => {
    const root = repo();
    write(root, "src/nuevo.ts", "export function nuevo(): number {\n  return 1;\n}\n");
    const store = new GraphStore(join(root, GRAPH_FILE));
    indexProject(root);
    expect(store.modifiedSymbols().map((n) => n.id)).toContain("src/nuevo.ts#nuevo");
    store.close();
  });

  it("QA exige tests para los símbolos modificados", async () => {
    const root = repo();
    const config = baseConfig([], {
      qa: { requireTestsForChangedSymbols: true, requireCriteriaCoverage: false },
    });
    // `unused` no lo prueba nadie; `main` sí.
    writeFileSync(
      join(root, "src/c.ts"),
      readFileSync(join(root, "src/c.ts"), "utf8").replace("return 1", "return 99"),
    );
    let findings = await changedSymbolsWithoutTests(root, config);
    expect(findings.map((f) => f.mensaje)).toEqual([
      "el símbolo «src/c.ts#unused» fue modificado y ningún test lo cubre",
    ]);

    git(root, "checkout", "--", "src/c.ts");
    writeFileSync(
      join(root, "src/c.ts"),
      readFileSync(join(root, "src/c.ts"), "utf8").replace("new Child()", "new Child( )"),
    );
    findings = await changedSymbolsWithoutTests(root, config);
    expect(findings).toEqual([]);
  });

  it("con otro proveedor no aplica la verificación", async () => {
    const root = repo();
    writeFileSync(
      join(root, "src/c.ts"),
      readFileSync(join(root, "src/c.ts"), "utf8").replace("return 1", "return 99"),
    );
    expect(
      await changedSymbolsWithoutTests(root, baseConfig([], { codeIntel: "gitnexus" })),
    ).toEqual([]);
  });
});

/** In-memory provider used to prove that anything implementing the interface passes the same tests. */
class FakeProvider implements CodeIntelProvider {
  readonly name = "fake";
  private readonly calls: Record<string, string[]> = { top: ["mid"], mid: ["leaf"], leaf: [] };
  private ref = (id: string): SymbolRef => ({
    id,
    kind: "function",
    name: id,
    file: "fake.ts",
    line: 1,
  });

  available(): Promise<Availability> {
    return Promise.resolve({ ok: true, detail: "fake" });
  }

  findSymbol(query: string): Promise<SymbolRef[]> {
    return Promise.resolve(query in this.calls ? [this.ref(query)] : []);
  }

  impact(query: string, options: QueryOptions = {}): Promise<ImpactResult> {
    if (!(query in this.calls)) return Promise.reject(new SymbolNotFoundError(query));
    const dependents: ImpactResult["dependents"] = [];
    let frontier = [query];
    for (let depth = 1; depth <= (options.maxDepth ?? 10); depth++) {
      const next = Object.keys(this.calls).filter((c) =>
        frontier.some((f) => this.calls[c]?.includes(f)),
      );
      for (const id of next) dependents.push({ ...this.ref(id), depth, via: "CALLS" });
      frontier = next;
    }
    return Promise.resolve({ target: this.ref(query), dependents });
  }

  trace(query: string, options: QueryOptions = {}): Promise<TraceResult> {
    if (!(query in this.calls)) return Promise.reject(new SymbolNotFoundError(query));
    const steps: TraceResult["steps"] = [];
    let frontier = [query];
    for (let depth = 1; depth <= (options.maxDepth ?? 5); depth++) {
      const next: string[] = [];
      for (const from of frontier) {
        for (const id of this.calls[from] ?? []) {
          steps.push({ ...this.ref(id), depth, from });
          next.push(id);
        }
      }
      frontier = next;
    }
    return Promise.resolve({ entry: this.ref(query), steps });
  }
}

interface Scenario {
  provider: CodeIntelProvider;
  leaf: string;
  mid: string;
  top: string;
}

const scenarios: [string, () => Scenario][] = [
  [
    "native",
    () => ({
      provider: new NativeProvider(copyFixture("sample")),
      leaf: "greet",
      mid: "Base.hello",
      top: "Child.run",
    }),
  ],
  ["fake", () => ({ provider: new FakeProvider(), leaf: "leaf", mid: "mid", top: "top" })],
];

describe.each(scenarios)("contrato de CodeIntelProvider: %s (criterio 14)", (_name, make) => {
  it("available() responde ok", async () => {
    expect((await make().provider.available()).ok).toBe(true);
  });

  it("findSymbol encuentra lo que existe y devuelve vacío para lo que no", async () => {
    const { provider, leaf } = make();
    expect((await provider.findSymbol(leaf)).map((s) => s.name)).toContain(leaf);
    expect(await provider.findSymbol("noExisteNada")).toEqual([]);
  });

  it("impact lista los dependientes ordenados por profundidad", async () => {
    const { provider, leaf, mid, top } = make();
    const result = await provider.impact(leaf);
    const byDepth = result.dependents.map((d) => [d.depth, d.name]);
    expect(byDepth).toContainEqual([1, mid]);
    expect(byDepth).toContainEqual([2, top]);
    const depths = result.dependents.map((d) => d.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  it("impact con maxDepth 1 solo devuelve los directos", async () => {
    const { provider, leaf, mid } = make();
    expect((await provider.impact(leaf, { maxDepth: 1 })).dependents.map((d) => d.name)).toEqual([
      mid,
    ]);
  });

  it("trace sigue las llamadas hacia adelante", async () => {
    const { provider, leaf, mid, top } = make();
    const names = (await provider.trace(top)).steps.map((s) => [s.depth, s.name]);
    expect(names).toContainEqual([1, mid]);
    expect(names).toContainEqual([2, leaf]);
  });

  it("un símbolo inexistente falla con SymbolNotFoundError", async () => {
    const { provider } = make();
    await expect(provider.impact("noExisteNada")).rejects.toThrow(SymbolNotFoundError);
    await expect(provider.trace("noExisteNada")).rejects.toThrow(SymbolNotFoundError);
  });
});

describe("fábrica de proveedores", () => {
  it("por defecto usa el nativo y respeta el configurado", () => {
    expect(createProvider(baseConfig([]), "/tmp").name).toBe("native");
    expect(createProvider(baseConfig([], { codeIntel: "gitnexus" }), "/tmp").name).toBe("gitnexus");
  });
});
