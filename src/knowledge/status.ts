import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { indexedLibraries } from "./engine.js";
import type { KnowledgeSource } from "./model.js";
import { readRegistry } from "./store.js";

/** A capture older than this is probably out of date. */
export const STALE_DAYS = 90;

export interface SourceStatus {
  id: string;
  nombre: string;
  version: string;
  estado: KnowledgeSource["estado"];
  capturadoEl: string;
  edadDias: number;
  documentos: number | null;
  indexada: boolean;
  avisos: string[];
}

const SEMVER = /^v?(\d+)\.(\d+)(?:\.\d+)?/;

/** The version of an npm package the project has installed, read from its lockfile; null when unknown. */
export function lockedVersion(root: string, pkg: string): string | null {
  const file = join(root, "package-lock.json");
  if (!existsSync(file)) return null;
  try {
    const lock = JSON.parse(readFileSync(file, "utf8")) as {
      packages?: Record<string, { version?: string }>;
    };
    return lock.packages?.[`node_modules/${pkg}`]?.version ?? null;
  } catch {
    return null;
  }
}

/** Both are x.y: the documentation and the project agree on major and minor. */
export function sameMinor(docs: string, locked: string): boolean | null {
  const a = SEMVER.exec(docs);
  const b = SEMVER.exec(locked);
  if (!a || !b) return null;
  return a[1] === b[1] && a[2] === b[2];
}

export async function knowledgeStatus(
  options: { root?: string | null; now?: Date } = {},
): Promise<SourceStatus[]> {
  const now = options.now ?? new Date();
  const indexed = new Map((await indexedLibraries()).map((l) => [l.nombre, l]));
  const rows: SourceStatus[] = [];
  for (const s of Object.values(readRegistry().fuentes)) {
    if (s.estado === "retirada") continue;
    const age = Math.floor((now.getTime() - new Date(s.capturadoEl).getTime()) / 86_400_000);
    const lib = indexed.get(s.id);
    const warnings: string[] = [];
    if (s.estado !== "revisada") warnings.push(`sin revisar (${s.estado}): no se puede indexar`);
    else if (!lib || lib.documentos === 0)
      warnings.push(`sin indexar: evol knowledge ingest ${s.id}`);
    else if (lib.estado !== "completed" && lib.estado !== "completado")
      warnings.push(`indexación ${lib.estado}`);
    if (age > STALE_DAYS) warnings.push(`captura de hace ${age} días (más de ${STALE_DAYS})`);
    if (options.root && s.paquete) {
      const locked = lockedVersion(options.root, s.paquete);
      if (locked && sameMinor(s.version, locked) === false)
        warnings.push(
          `documenta la ${s.version} de ${s.paquete} y el proyecto usa la ${locked}: vuelve a capturarla`,
        );
    }
    rows.push({
      id: s.id,
      nombre: s.nombre,
      version: s.version,
      estado: s.estado,
      capturadoEl: s.capturadoEl,
      edadDias: age,
      documentos: lib?.documentos ?? null,
      indexada: (lib?.documentos ?? 0) > 0,
      avisos: warnings,
    });
  }
  return rows;
}
