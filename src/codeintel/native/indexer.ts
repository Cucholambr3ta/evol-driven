import { existsSync, globSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve, sep } from "node:path";
import { Node, Project, SyntaxKind, ts } from "ts-morph";
import type { SourceFile } from "ts-morph";
import { sha256File } from "../../core/hash.js";
import { GraphStore } from "./store.js";
import type { EdgeRow, NodeRow } from "./store.js";

export const GRAPH_FILE = ".evol/codegraph.sqlite";

const SOURCE_GLOB = "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}";
const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".evol",
  ".git",
  ".next",
  "out",
]);

export function isTestPath(rel: string): boolean {
  return /(^|\/)(tests?|__tests__)\//i.test(rel) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(rel);
}

export function listSourceFiles(rootAbs: string): string[] {
  const skip = (entry: string | { name: string }): boolean =>
    IGNORED_DIRS.has(typeof entry === "string" ? (entry.split("/").pop() ?? entry) : entry.name);
  return globSync(SOURCE_GLOB, { cwd: rootAbs, exclude: skip })
    .map((f) => f.split(sep).join("/"))
    .filter((f) => !/\.d\.[cm]?ts$/.test(f))
    .sort();
}

interface SymbolInfo {
  id: string;
  kind: string;
  name: string;
  file: string;
  start: number;
  end: number;
}

interface Extraction {
  nodes: NodeRow[];
  edges: EdgeRow[];
}

function isFunctionInitializer(node: Node | undefined): boolean {
  return node !== undefined && (Node.isArrowFunction(node) || Node.isFunctionExpression(node));
}

class Extractor {
  constructor(
    private readonly rootAbs: string,
    private readonly indexed: Set<string>,
  ) {}

  private relOf(sf: SourceFile): string {
    return relative(this.rootAbs, sf.getFilePath()).split(sep).join("/");
  }

  /** Maps a declaration to the symbol it defines in the graph, if it belongs to the project. */
  describe(decl: Node): SymbolInfo | null {
    const sf = decl.getSourceFile();
    if (!this.indexed.has(sf.getFilePath())) return null;
    const file = this.relOf(sf);
    const make = (kind: string, name: string | undefined, node: Node = decl): SymbolInfo | null =>
      name
        ? {
            id: `${file}#${name}`,
            kind,
            name,
            file,
            start: node.getStartLineNumber(),
            end: node.getEndLineNumber(),
          }
        : null;
    const className = (node: Node | undefined): string | undefined =>
      node && Node.isClassDeclaration(node) ? (node.getName() ?? "default") : undefined;

    if (Node.isClassDeclaration(decl)) {
      return Node.isSourceFile(decl.getParent())
        ? make("class", decl.getName() ?? "default")
        : null;
    }
    if (Node.isConstructorDeclaration(decl)) {
      const cls = decl.getParent();
      return Node.isClassDeclaration(cls) ? make("class", cls.getName() ?? "default", cls) : null;
    }
    if (Node.isFunctionDeclaration(decl)) {
      return Node.isSourceFile(decl.getParent())
        ? make("function", decl.getName() ?? "default")
        : null;
    }
    if (Node.isMethodDeclaration(decl)) {
      const owner = className(decl.getParent());
      return owner ? make("method", `${owner}.${decl.getName()}`) : null;
    }
    if (Node.isPropertyDeclaration(decl) && isFunctionInitializer(decl.getInitializer())) {
      const owner = className(decl.getParent());
      return owner ? make("method", `${owner}.${decl.getName()}`) : null;
    }
    if (Node.isInterfaceDeclaration(decl)) return make("interface", decl.getName());
    if (Node.isEnumDeclaration(decl)) return make("enum", decl.getName());
    if (Node.isTypeAliasDeclaration(decl)) return make("type", decl.getName());
    if (Node.isVariableDeclaration(decl)) {
      const statement = decl.getVariableStatement();
      if (!statement || !Node.isSourceFile(statement.getParent())) return null;
      const isFn = isFunctionInitializer(decl.getInitializer());
      if (!isFn && !statement.isExported()) return null;
      return make(isFn ? "function" : "variable", decl.getName());
    }
    return null;
  }

  /** The declaration a reference ultimately points at, following import aliases. */
  private resolve(expression: Node): SymbolInfo | null {
    let symbol = expression.getSymbol();
    if (!symbol) return null;
    if (symbol.isAlias()) symbol = symbol.getAliasedSymbol() ?? symbol;
    for (const decl of symbol.getDeclarations()) {
      const info = this.describe(decl);
      if (info) return info;
    }
    return null;
  }

  private enclosing(node: Node, fileId: string): string {
    let current: Node | undefined = node.getParent();
    while (current && !Node.isSourceFile(current)) {
      if (
        Node.isFunctionDeclaration(current) ||
        Node.isMethodDeclaration(current) ||
        Node.isConstructorDeclaration(current) ||
        Node.isVariableDeclaration(current) ||
        Node.isPropertyDeclaration(current)
      ) {
        const info = this.describe(current);
        if (info) return info.id;
      }
      current = current.getParent();
    }
    return fileId;
  }

  extract(sf: SourceFile): Extraction {
    const file = this.relOf(sf);
    const test = isTestPath(file);
    const nodes = new Map<string, NodeRow>();
    const edges: EdgeRow[] = [];

    nodes.set(file, {
      id: file,
      kind: "file",
      name: file.split("/").pop() ?? file,
      file,
      start_line: 1,
      end_line: sf.getEndLineNumber(),
    });

    const add = (info: SymbolInfo | null, parent: string): SymbolInfo | null => {
      if (!info) return null;
      nodes.set(info.id, {
        id: info.id,
        kind: info.kind,
        name: info.name,
        file: info.file,
        start_line: info.start,
        end_line: info.end,
      });
      edges.push({ src: parent, dst: info.id, kind: "CONTAINS" });
      return info;
    };

    const inherit = (from: SymbolInfo | null, expressions: Node[]): void => {
      if (!from) return;
      for (const expression of expressions) {
        const target = this.resolve(expression);
        if (target) edges.push({ src: from.id, dst: target.id, kind: "EXTENDS" });
      }
    };

    for (const statement of sf.getStatements()) {
      if (Node.isClassDeclaration(statement)) {
        const cls = add(this.describe(statement), file);
        inherit(cls, [
          ...(statement.getExtends() ? [statement.getExtends()!.getExpression()] : []),
          ...statement.getImplements().map((i) => i.getExpression()),
        ]);
        if (cls) {
          for (const member of statement.getMembers()) {
            if (Node.isMethodDeclaration(member) || Node.isPropertyDeclaration(member)) {
              add(this.describe(member), cls.id);
            }
          }
        }
      } else if (Node.isInterfaceDeclaration(statement)) {
        const iface = add(this.describe(statement), file);
        inherit(
          iface,
          statement.getExtends().map((e) => e.getExpression()),
        );
      } else if (
        Node.isFunctionDeclaration(statement) ||
        Node.isEnumDeclaration(statement) ||
        Node.isTypeAliasDeclaration(statement)
      ) {
        add(this.describe(statement), file);
      } else if (Node.isVariableStatement(statement)) {
        for (const declaration of statement.getDeclarations())
          add(this.describe(declaration), file);
      }
    }

    for (const declaration of [...sf.getImportDeclarations(), ...sf.getExportDeclarations()]) {
      const target = declaration.getModuleSpecifierSourceFile();
      if (target && this.indexed.has(target.getFilePath())) {
        edges.push({ src: file, dst: this.relOf(target), kind: "IMPORTS" });
      }
    }

    for (const decls of sf.getExportedDeclarations().values()) {
      for (const decl of decls) {
        const info = this.describe(decl);
        if (info) edges.push({ src: file, dst: info.id, kind: "EXPORTS" });
      }
    }

    const callers = [
      ...sf.getDescendantsOfKind(SyntaxKind.CallExpression),
      ...sf.getDescendantsOfKind(SyntaxKind.NewExpression),
    ];
    for (const call of callers) {
      let target: SymbolInfo | null;
      try {
        target = this.resolve(call.getExpression());
      } catch {
        continue;
      }
      if (!target) continue;
      if (test) {
        if (!isTestPath(target.file)) edges.push({ src: file, dst: target.id, kind: "TESTS" });
      } else {
        edges.push({ src: this.enclosing(call, file), dst: target.id, kind: "CALLS" });
      }
    }

    return { nodes: [...nodes.values()], edges };
  }
}

function createProject(rootAbs: string, files: string[]): Project {
  const options = { allowJs: true, noEmit: true, skipLibCheck: true } as const;
  const tsconfig = join(rootAbs, "tsconfig.json");
  const project = existsSync(tsconfig)
    ? new Project({
        tsConfigFilePath: tsconfig,
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
        compilerOptions: options,
      })
    : new Project({
        skipFileDependencyResolution: true,
        compilerOptions: {
          ...options,
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
        },
      });
  for (const rel of files) project.addSourceFileAtPath(join(rootAbs, rel));
  return project;
}

type Range = [number, number];

/** Line ranges changed in the working tree, per file relative to `rootAbs`. */
export function workingTreeChanges(rootAbs: string): Map<string, Range[]> {
  const git = (...args: string[]): string | null => {
    // -c core.quotepath=false keeps non-ASCII paths readable; user git config must not change the output format.
    const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
      cwd: rootAbs,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return result.status === 0 ? result.stdout : null;
  };
  const changes = new Map<string, Range[]>();
  if (git("rev-parse", "--is-inside-work-tree")?.trim() !== "true") return changes;

  const whole = (file: string): void => void changes.set(file, [[1, Number.MAX_SAFE_INTEGER]]);
  const untracked = git("ls-files", "-o", "--exclude-standard") ?? "";
  for (const file of untracked.split("\n").filter(Boolean)) whole(file);

  if (git("rev-parse", "--verify", "HEAD") === null) {
    // No commits yet: everything tracked counts as modified.
    for (const file of (git("ls-files", "-c") ?? "").split("\n").filter(Boolean)) whole(file);
    return changes;
  }
  // --no-prefix: users may have diff.mnemonicPrefix (c/ and w/) or noprefix set in their git config.
  const diff =
    git("diff", "--relative", "--unified=0", "--no-color", "--no-prefix", "HEAD", "--", ".") ?? "";
  let current: string | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = line.slice(4);
      current = path === "/dev/null" ? null : path;
    } else if (line.startsWith("@@") && current) {
      const match = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (!match) continue;
      const start = Number(match[1]);
      const count = match[2] === undefined ? 1 : Number(match[2]);
      const list = changes.get(current) ?? [];
      list.push([start, count === 0 ? start : start + count - 1]);
      changes.set(current, list);
    }
  }
  return changes;
}

function modifiedSymbolIds(store: GraphStore, rootAbs: string): string[] {
  const ids = new Set<string>();
  for (const [file, ranges] of workingTreeChanges(rootAbs)) {
    for (const node of store.nodesInRanges(file)) {
      if (ranges.some(([from, to]) => node.start_line <= to && node.end_line >= from))
        ids.add(node.id);
    }
  }
  return [...ids].sort();
}

export interface IndexReport {
  total: number;
  reindexed: string[];
  /** Reprocessed only because a file they import changed its set of symbols. */
  cascaded: string[];
  removed: string[];
  unchanged: number;
  modified: number;
  stats: { files: number; nodes: number; edges: number };
}

export interface IndexOptions {
  /** Reprocess every file regardless of its hash. */
  full?: boolean;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

export function indexProject(root: string, options: IndexOptions = {}): IndexReport {
  const rootAbs = resolve(root);
  const store = new GraphStore(join(rootAbs, GRAPH_FILE));
  try {
    const files = listSourceFiles(rootAbs);
    const present = new Set(files);
    const known = new Map(store.files().map((f) => [f.path, f]));

    const changed: string[] = [];
    for (const rel of files) {
      const stat = statSync(join(rootAbs, rel));
      const previous = known.get(rel);
      if (
        !options.full &&
        previous &&
        previous.mtime_ms === stat.mtimeMs &&
        previous.size === stat.size
      )
        continue;
      if (!options.full && previous && previous.hash === sha256File(join(rootAbs, rel))) {
        store.touchFile(rel, stat.mtimeMs, stat.size);
        continue;
      }
      changed.push(rel);
    }
    const removed = [...known.keys()].filter((p) => !present.has(p));

    const processed: string[] = [];
    const cascaded: string[] = [];
    if (changed.length > 0 || removed.length > 0) {
      const queue = [...changed];
      const queued = new Set(queue);
      for (const rel of removed) {
        for (const importer of store.importers(rel)) {
          if (present.has(importer) && !queued.has(importer)) {
            queue.push(importer);
            queued.add(importer);
            cascaded.push(importer);
          }
        }
        store.removeFile(rel);
      }
      const project = createProject(rootAbs, files);
      const extractor = new Extractor(
        rootAbs,
        new Set(files.map((f) => project.getSourceFileOrThrow(join(rootAbs, f)).getFilePath())),
      );
      for (let i = 0; i < queue.length; i++) {
        const rel = queue[i] as string;
        const abs = join(rootAbs, rel);
        const before = store.symbolIds(rel);
        const { nodes, edges } = extractor.extract(project.getSourceFileOrThrow(abs));
        const stat = statSync(abs);
        store.replaceFile(
          { path: rel, hash: sha256File(abs), mtime_ms: stat.mtimeMs, size: stat.size },
          nodes,
          edges,
        );
        processed.push(rel);
        const after = store.symbolIds(rel);
        if (!sameSet(before, after)) {
          for (const importer of store.importers(rel)) {
            if (present.has(importer) && !queued.has(importer)) {
              queue.push(importer);
              queued.add(importer);
              cascaded.push(importer);
            }
          }
        }
      }
    }

    const modified = modifiedSymbolIds(store, rootAbs);
    store.replaceChanges(modified);
    return {
      total: files.length,
      reindexed: processed.filter((f) => !cascaded.includes(f)),
      cascaded,
      removed,
      unchanged: files.length - processed.length,
      modified: modified.length,
      stats: store.stats(),
    };
  } finally {
    store.close();
  }
}
