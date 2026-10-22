import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";
import { UserError } from "../core/errors.js";

/**
 * A small ZIP reader and writer: skills travel as a folder inside a .zip and no dependency is added
 * for it. The writer is deterministic (sorted entries, fixed timestamp), so the same files always
 * give the same bytes. The reader is strict, because a .zip is untrusted input: it refuses paths
 * that escape the folder (zip-slip), symbolic links, encrypted entries and oversized contents.
 */
export interface ZipEntry {
  path: string;
  data: Buffer;
}

export interface ZipLimits {
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
}

export const DEFAULT_LIMITS: ZipLimits = {
  maxEntries: 500,
  maxEntryBytes: 8 * 1024 * 1024,
  maxTotalBytes: 32 * 1024 * 1024,
};

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const UTF8_FLAG = 0x0800;
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
const FILE_MODE = 0o100644;
const SYMLINK_MODE = 0o120000;

/** Normalised entry path, or a UserError when it could leave the target folder. */
export function safeEntryPath(name: string): string {
  const bad =
    name.length === 0 ||
    name.includes("\0") ||
    name.includes("\\") ||
    name.startsWith("/") ||
    /^[A-Za-z]:/.test(name) ||
    name.split("/").some((part) => part === ".." || part === "." || part === "");
  if (bad) throw new UserError(`Ruta insegura dentro del .zip: «${name}».`);
  return name;
}

export function writeZip(entries: ZipEntry[]): Buffer {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of sorted) {
    safeEntryPath(entry.path);
    const name = Buffer.from(entry.path, "utf8");
    const deflated = deflateRawSync(entry.data, { level: 9 });
    const useDeflate = deflated.length < entry.data.length;
    const body = useDeflate ? deflated : entry.data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, body);

    const head = Buffer.alloc(46);
    head.writeUInt32LE(CENTRAL, 0);
    head.writeUInt16LE((3 << 8) | 20, 4); // made by: Unix
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(UTF8_FLAG, 8);
    head.writeUInt16LE(method, 10);
    head.writeUInt16LE(DOS_TIME, 12);
    head.writeUInt16LE(DOS_DATE, 14);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(body.length, 20);
    head.writeUInt32LE(entry.data.length, 24);
    head.writeUInt16LE(name.length, 28);
    head.writeUInt32LE((FILE_MODE << 16) >>> 0, 38);
    head.writeUInt32LE(offset, 42);
    central.push(head, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

const invalid = (why: string): UserError =>
  new UserError(`El archivo no es un .zip válido: ${why}.`);

export function readZip(buffer: Buffer, limits: ZipLimits = DEFAULT_LIMITS): ZipEntry[] {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw invalid("no tiene directorio central");
  const count = buffer.readUInt16LE(end + 10);
  let p = buffer.readUInt32LE(end + 16);
  if (count > limits.maxEntries) {
    throw new UserError(
      `El .zip tiene demasiados archivos (${count}; el máximo es ${limits.maxEntries}).`,
    );
  }

  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== CENTRAL)
      throw invalid("directorio dañado");
    const madeBy = buffer.readUInt16LE(p + 4) >> 8;
    const flags = buffer.readUInt16LE(p + 8);
    const method = buffer.readUInt16LE(p + 10);
    const crc = buffer.readUInt32LE(p + 16);
    const compressed = buffer.readUInt32LE(p + 20);
    const size = buffer.readUInt32LE(p + 24);
    const nameLength = buffer.readUInt16LE(p + 28);
    const next = p + 46 + nameLength + buffer.readUInt16LE(p + 30) + buffer.readUInt16LE(p + 32);
    const mode = buffer.readUInt32LE(p + 38) >>> 16;
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString("utf8", p + 46, p + 46 + nameLength);
    p = next;

    if (name.endsWith("/")) continue; // a folder entry carries no data
    if ((flags & 1) !== 0) throw new UserError(`El .zip tiene un archivo cifrado: «${name}».`);
    if (madeBy === 3 && (mode & 0o170000) === SYMLINK_MODE) {
      throw new UserError(`El .zip contiene un enlace simbólico: «${name}».`);
    }
    safeEntryPath(name);
    if (seen.has(name)) throw new UserError(`El .zip repite la ruta «${name}».`);
    seen.add(name);
    if (size > limits.maxEntryBytes)
      throw new UserError(`«${name}» es demasiado grande dentro del .zip.`);
    total += size;
    if (total > limits.maxTotalBytes)
      throw new UserError("El .zip descomprimido es demasiado grande.");

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL) {
      throw invalid("cabecera local dañada");
    }
    const start =
      localOffset +
      30 +
      buffer.readUInt16LE(localOffset + 26) +
      buffer.readUInt16LE(localOffset + 28);
    const body = buffer.subarray(start, start + compressed);
    let data: Buffer;
    if (method === 0) data = body;
    else if (method === 8) {
      try {
        data = inflateRawSync(body, { maxOutputLength: limits.maxEntryBytes });
      } catch {
        throw invalid(`no se pudo descomprimir «${name}»`);
      }
    } else throw invalid(`método de compresión no admitido en «${name}»`);
    if (data.length !== size || crc32(data) !== crc) throw invalid(`«${name}» está dañado`);
    entries.push({ path: name, data });
  }
  return entries;
}
