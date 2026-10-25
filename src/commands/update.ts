import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { packageRoot, userConfigDir } from "../core/paths.js";
import { libraryDir } from "../skills/library.js";
import { homeDir, inspectUpdate, rollback, update } from "../release/update.js";
import { readInstallRecord, versionInfo } from "../release/version.js";
import { out } from "./shared.js";
import { hasTerminal, typingSession } from "./tty.js";

const USAGE = "Uso: evol update [--comprobar] [--version x.y.z] [--volver] [--repositorio <url>]";

export const signersFile = (): string => join(userConfigDir(), "allowed_signers");
const binLink = (): string => join(process.env["HOME"] ?? homedir(), ".local", "bin", "evol");

/** Where updates come from: the install record, else the origin's remote, else package.json. */
function repository(explicit?: string): string {
  if (explicit) return explicit;
  const record = readInstallRecord(packageRoot());
  if (record) return record.repositorio;
  const remote = spawnSync("git", ["-C", packageRoot(), "remote", "get-url", "origin"], {
    encoding: "utf8",
  });
  if (remote.status === 0 && remote.stdout.trim()) return remote.stdout.trim();
  const pkg = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")) as {
    repository?: string | { url?: string };
  };
  const url = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  if (url) return url;
  throw new UserError(
    `No sé de dónde actualizar. Indica el repositorio con --repositorio <url>. ${USAGE}`,
  );
}

/** npm ci and the build, without running the install scripts of the dependencies. */
function build(dir: string): void {
  for (const args of [
    ["ci", "--ignore-scripts"],
    ["run", "build"],
    ["prune", "--omit=dev", "--ignore-scripts"],
  ]) {
    const r = spawnSync("npm", args, { cwd: dir, stdio: "inherit" });
    if (r.status !== 0) throw new UserError(`npm ${args.join(" ")} falló al compilar la versión.`);
  }
}

export default async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      comprobar: { type: "boolean" },
      version: { type: "string" },
      volver: { type: "boolean" },
      repositorio: { type: "string" },
    },
  });
  if (values.volver === true) {
    const version = rollback(binLink(), homeDir());
    out(`Vuelto a la versión ${version}. La que había queda como «anterior».`);
    return 0;
  }
  const deps = { repo: repository(values.repositorio), signers: signersFile() };
  if (values.comprobar === true) {
    const info = inspectUpdate(deps, values.version);
    out(
      `Instalada: ${info.actual === "0.0.0" ? "ninguna copia estable" : info.actual} (${versionInfo().canal} es lo que estás ejecutando)`,
    );
    out(`Versiones en ${deps.repo}: ${info.etiquetas.join(", ") || "ninguna"}`);
    if (info.candidata) {
      out(
        `Última: ${info.candidata.version}, firma: ${info.candidata.firma.ok ? "válida" : `NO válida (${info.candidata.firma.detail})`}`,
      );
      out(info.candidata.cambios);
    }
    out("Solo se ha comprobado. Para instalar: evol update");
    return 0;
  }
  if (!hasTerminal())
    throw new UserError(
      `evol update pide tu confirmación: ejecútalo en una terminal (o usa --comprobar). ${USAGE}`,
    );
  const session = typingSession();
  try {
    const result = await update(
      {
        ...deps,
        binLink: binLink(),
        build,
        log: out,
        confirm: async (summary) => {
          out(`\n${summary}\n`);
          const answer = (await session.ask("¿Instalar esta versión? [s/N] "))
            ?.trim()
            .toLowerCase();
          return answer === "s" || answer === "si" || answer === "sí";
        },
      },
      libraryDir(),
      values.version,
    );
    if (result.estado === "cancelada") out("Cancelado: no se instaló nada.");
    else if (result.estado === "instalada") {
      out(
        `Versión ${result.version} instalada en ${join(homeDir(), "versiones", result.version ?? "")} (solo lectura).`,
      );
      const s = result.skills;
      if (s)
        out(
          `Skills: ${s.nuevas.length} nuevas y ${s.cambiadas.length} cambiadas llegan SIN aprobar; ${s.iguales.length} sin cambios. Apruébalas tú: evol skills approve <nombre>.`,
        );
      if (result.devLink) out(`Tu copia del origen sigue disponible como: ${result.devLink}`);
      out("Volver a la anterior: evol update --volver");
    }
    return 0;
  } finally {
    session.close();
  }
}
