import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SymbolRef } from "../provider.js";

export type EdgeKind =
  "IMPORTS" | "CALLS" | "EXTENDS" | "CONTAINS" | "EXPORTS" | "TESTS" | "MODIFIES";

export interface NodeRow {
  id: string;
  kind: string;
  name: string;
  file: string;
  start_line: number;
  end_line: number;
}

export interface EdgeRow {
  src: string;
  dst: string;
  kind: EdgeKind;
}

export interface FileRow {
  path: string;
  hash: string;
  mtime_ms: number;
  size: number;
}

export const CHANGES_FILE = "__changes__";
export const WORKTREE_NODE = "change:worktree";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS files(
  path TEXT PRIMARY KEY, hash TEXT NOT NULL, mtime_ms REAL NOT NULL, size INTEGER NOT NULL,
  indexed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS nodes(
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, file TEXT NOT NULL,
  start_line INTEGER NOT NULL, end_line INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS edges(
  src TEXT NOT NULL, dst TEXT NOT NULL, kind TEXT NOT NULL, src_file TEXT NOT NULL,
  PRIMARY KEY(src, dst, kind));
CREATE INDEX IF NOT EXISTS edges_dst ON edges(dst, kind);
CREATE INDEX IF NOT EXISTS edges_src ON edges(src, kind);
CREATE INDEX IF NOT EXISTS edges_file ON edges(src_file);
CREATE INDEX IF NOT EXISTS nodes_name ON nodes(name);
CREATE INDEX IF NOT EXISTS nodes_file ON nodes(file);
`;

export class GraphStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  files(): FileRow[] {
    return this.db
      .prepare("SELECT path, hash, mtime_ms, size FROM files")
      .all() as unknown as FileRow[];
  }

  symbolIds(file: string): Set<string> {
    const rows = this.db
      .prepare("SELECT id FROM nodes WHERE file = ? AND kind != 'file'")
      .all(file) as unknown as { id: string }[];
    return new Set(rows.map((r) => r.id));
  }

  /** Files that import `file`. */
  importers(file: string): string[] {
    const rows = this.db
      .prepare("SELECT DISTINCT src FROM edges WHERE dst = ? AND kind = 'IMPORTS'")
      .all(file) as unknown as { src: string }[];
    return rows.map((r) => r.src);
  }

  replaceFile(file: FileRow, nodes: NodeRow[], edges: EdgeRow[]): void {
    this.transaction(() => {
      this.deleteFileRows(file.path);
      const insertNode = this.db.prepare(
        "INSERT OR REPLACE INTO nodes(id, kind, name, file, start_line, end_line) VALUES (?,?,?,?,?,?)",
      );
      for (const n of nodes) insertNode.run(n.id, n.kind, n.name, n.file, n.start_line, n.end_line);
      const insertEdge = this.db.prepare(
        "INSERT OR IGNORE INTO edges(src, dst, kind, src_file) VALUES (?,?,?,?)",
      );
      for (const e of edges) insertEdge.run(e.src, e.dst, e.kind, file.path);
      this.db
        .prepare(
          "INSERT OR REPLACE INTO files(path, hash, mtime_ms, size, indexed_at) VALUES (?,?,?,?,?)",
        )
        .run(file.path, file.hash, file.mtime_ms, file.size, new Date().toISOString());
    });
  }

  touchFile(path: string, mtimeMs: number, size: number): void {
    this.db
      .prepare("UPDATE files SET mtime_ms = ?, size = ? WHERE path = ?")
      .run(mtimeMs, size, path);
  }

  removeFile(path: string): void {
    this.transaction(() => {
      this.deleteFileRows(path);
      this.db.prepare("DELETE FROM files WHERE path = ?").run(path);
    });
  }

  private deleteFileRows(path: string): void {
    this.db.prepare("DELETE FROM nodes WHERE file = ?").run(path);
    this.db.prepare("DELETE FROM edges WHERE src_file = ?").run(path);
  }

  /** Replaces the "uncommitted changes" node and its MODIFIES edges. */
  replaceChanges(symbolIds: string[]): void {
    this.transaction(() => {
      this.deleteFileRows(CHANGES_FILE);
      this.db
        .prepare(
          "INSERT OR REPLACE INTO nodes(id, kind, name, file, start_line, end_line) VALUES (?,?,?,?,?,?)",
        )
        .run(WORKTREE_NODE, "change", "worktree", CHANGES_FILE, 0, 0);
      const insert = this.db.prepare(
        "INSERT OR IGNORE INTO edges(src, dst, kind, src_file) VALUES (?,?,?,?)",
      );
      for (const id of symbolIds) insert.run(WORKTREE_NODE, id, "MODIFIES", CHANGES_FILE);
    });
  }

  nodesInRanges(file: string): NodeRow[] {
    return this.db
      .prepare(
        "SELECT id, kind, name, file, start_line, end_line FROM nodes WHERE file = ? AND kind != 'file'",
      )
      .all(file) as unknown as NodeRow[];
  }

  getNode(id: string): NodeRow | undefined {
    return this.db
      .prepare("SELECT id, kind, name, file, start_line, end_line FROM nodes WHERE id = ?")
      .get(id) as unknown as NodeRow | undefined;
  }

  find(query: string): NodeRow[] {
    const cols = "id, kind, name, file, start_line, end_line";
    const exact = this.getNode(query);
    if (exact && exact.kind !== "change") return [exact];
    return this.db
      .prepare(
        `SELECT ${cols} FROM nodes WHERE kind != 'change' AND
           (name = ?1 OR id LIKE '%#' || ?1 OR (kind = 'file' AND id = ?1))
         ORDER BY id`,
      )
      .all(query) as unknown as NodeRow[];
  }

  children(id: string): string[] {
    const rows = this.db
      .prepare("SELECT dst FROM edges WHERE src = ? AND kind = 'CONTAINS'")
      .all(id) as unknown as { dst: string }[];
    return rows.map((r) => r.dst);
  }

  /** Symbols modified in the working tree. */
  modifiedSymbols(): NodeRow[] {
    return this.db
      .prepare(
        `SELECT n.id, n.kind, n.name, n.file, n.start_line, n.end_line
           FROM edges e JOIN nodes n ON n.id = e.dst
          WHERE e.src = ? AND e.kind = 'MODIFIES' ORDER BY n.id`,
      )
      .all(WORKTREE_NODE) as unknown as NodeRow[];
  }

  hasIncoming(id: string, kind: EdgeKind): boolean {
    return (
      this.db.prepare("SELECT 1 FROM edges WHERE dst = ? AND kind = ? LIMIT 1").get(id, kind) !==
      undefined
    );
  }

  /** Nodes that depend on any of `seeds`, transitively, following `kinds` backwards. */
  dependents(
    seeds: string[],
    kinds: EdgeKind[],
    maxDepth: number,
  ): { id: string; depth: number; via: string }[] {
    if (seeds.length === 0) return [];
    const kindList = kinds.map((k) => `'${k}'`).join(",");
    const seedList = seeds.map((_, i) => `?${i + 1}`).join(",");
    const rows = this.db
      .prepare(
        `WITH RECURSIVE dep(id, depth, via) AS (
           SELECT e.src, 1, e.kind FROM edges e WHERE e.dst IN (${seedList}) AND e.kind IN (${kindList})
           UNION
           SELECT e.src, dep.depth + 1, e.kind FROM edges e JOIN dep ON e.dst = dep.id
            WHERE e.kind IN (${kindList}) AND dep.depth < ?${seeds.length + 1}
         )
         SELECT id, depth, via FROM dep ORDER BY depth, id`,
      )
      .all(...seeds, maxDepth) as unknown as { id: string; depth: number; via: string }[];
    const seen = new Set(seeds);
    const out: { id: string; depth: number; via: string }[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    return out;
  }

  /** Nodes reachable from any of `seeds` following CALLS forwards. */
  reachable(seeds: string[], maxDepth: number): { id: string; depth: number; from: string }[] {
    if (seeds.length === 0) return [];
    const seedList = seeds.map((_, i) => `?${i + 1}`).join(",");
    const rows = this.db
      .prepare(
        `WITH RECURSIVE walk(id, depth, parent) AS (
           SELECT e.dst, 1, e.src FROM edges e WHERE e.src IN (${seedList}) AND e.kind = 'CALLS'
           UNION
           SELECT e.dst, walk.depth + 1, e.src FROM edges e JOIN walk ON e.src = walk.id
            WHERE e.kind = 'CALLS' AND walk.depth < ?${seeds.length + 1}
         )
         SELECT id, depth, parent FROM walk ORDER BY depth, id`,
      )
      .all(...seeds, maxDepth) as unknown as { id: string; depth: number; parent: string }[];
    const seen = new Set(seeds);
    const out: { id: string; depth: number; from: string }[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push({ id: row.id, depth: row.depth, from: row.parent });
    }
    return out;
  }

  /** Every node and edge of the code (not the "uncommitted changes" node), ordered. */
  dump(): { nodes: NodeRow[]; edges: EdgeRow[] } {
    const nodes = this.db
      .prepare(
        "SELECT id, kind, name, file, start_line, end_line FROM nodes WHERE kind != 'change' ORDER BY id",
      )
      .all() as unknown as NodeRow[];
    const edges = this.db
      .prepare("SELECT src, dst, kind FROM edges WHERE src_file != ? ORDER BY src, dst, kind")
      .all(CHANGES_FILE) as unknown as EdgeRow[];
    return { nodes, edges };
  }

  /** Dump used to compare two graphs (nodes and edges, ordered). */
  snapshot(): { nodes: string[]; edges: string[] } {
    const nodes = (
      this.db
        .prepare(
          "SELECT id, kind, name, file, start_line, end_line FROM nodes WHERE kind != 'change' ORDER BY id",
        )
        .all() as unknown as NodeRow[]
    ).map((n) => `${n.id}|${n.kind}|${n.name}|${n.file}|${n.start_line}|${n.end_line}`);
    const edges = (
      this.db
        .prepare("SELECT src, dst, kind FROM edges WHERE src_file != ? ORDER BY src, dst, kind")
        .all(CHANGES_FILE) as unknown as EdgeRow[]
    ).map((e) => `${e.src}|${e.kind}|${e.dst}`);
    return { nodes, edges };
  }

  stats(): { files: number; nodes: number; edges: number } {
    const count = (table: string): number =>
      (this.db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as unknown as { c: number }).c;
    return { files: count("files"), nodes: count("nodes"), edges: count("edges") };
  }
}

export function toSymbolRef(n: NodeRow): SymbolRef {
  return { id: n.id, kind: n.kind, name: n.name, file: n.file, line: n.start_line };
}
