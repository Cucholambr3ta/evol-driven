import { parseArgs } from "node:util";
import { UserError } from "../core/errors.js";
import { loadConfig } from "../core/config.js";
import { ACTIVE_AREAS, AREAS, DEFAULT_AREAS, location } from "../security/model.js";
import { isLocalHost } from "../security/runners-active.js";
import type { Area } from "../security/model.js";
import { blockers, count, scan, writeQaReport, writeResult } from "../security/scan.js";
import { out, requireProject } from "./shared.js";
import { confirmByTyping } from "./tty.js";

const USAGE = `Uso: evol security scan [--solo <${AREAS.join("|")}>] [--ci] [--json]
  Sin --solo revisa ${DEFAULT_AREAS.join(", ")} (solo lee archivos).
  ${ACTIVE_AREAS.join(" y ")} envían tráfico a un servicio: solo con --solo, contra los objetivos que el proyecto
  declara en evol.config.json (security.objetivos) y con la confirmación de una persona en una terminal.`;

const STATE: Record<string, string> = {
  ok: "✓",
  falta: "× falta",
  fallo: "× falló",
  "no-aplica": "—",
};

/**
 * A person confirms, at the terminal, that these services are the project's own before any traffic
 * is sent. A target that is not on this machine or a private network needs its host name typed.
 */
async function confirmActive(
  targets: { nombre: string; url: string }[],
  ci: boolean,
): Promise<void> {
  if (targets.length === 0)
    throw new UserError(
      "El proyecto no declara objetivos propios. Añade security.objetivos a evol.config.json (nombre y url de tu servicio).",
    );
  if (ci)
    throw new UserError(
      "Estas pruebas envían tráfico: las confirma una persona en una terminal, no corren con --ci.",
    );
  out("Se enviará tráfico a estos objetivos, declarados como propios:");
  for (const t of targets) out(`  - ${t.nombre}: ${t.url}`);
  for (const t of targets) {
    const host = new URL(t.url).hostname;
    if (!isLocalHost(host))
      await confirmByTyping(
        `«${t.nombre}» (${host}) no está en esta máquina ni en una red privada. Escribe «${host}» para confirmar que es tuyo: `,
        host,
      );
  }
  await confirmByTyping("Escribe «probar» para continuar: ", "probar");
}

export default async function run(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  if (sub !== "scan") throw new UserError(USAGE);
  const { values } = parseArgs({
    args: rest,
    options: {
      solo: { type: "string" },
      ci: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
  });
  let areas: readonly Area[] = DEFAULT_AREAS;
  if (values.solo !== undefined) {
    if (!AREAS.includes(values.solo as Area))
      throw new UserError(`Área desconocida «${values.solo}». ${USAGE}`);
    areas = [values.solo as Area];
  }

  const root = requireProject();
  const active = areas.some((a) => ACTIVE_AREAS.includes(a));
  // the configuration is only read when traffic is going to be sent: a plain scan never needs it
  const targets = active ? (loadConfig(root).security?.objetivos ?? []) : [];
  if (active) await confirmActive(targets, values.ci === true);
  const result = scan(root, areas, new Date(), { objetivos: targets, confirmadas: active });
  writeResult(root, result);
  // a partial scan (--solo) must not wipe the other areas out of the report
  if (areas.length === DEFAULT_AREAS.length) writeQaReport(root, result);
  const reasons = blockers(result);

  if (values.json) {
    out(JSON.stringify({ ...result, bloqueos: reasons }, null, 2));
  } else {
    out(`Escaneo de seguridad (${result.areas.join(", ")})`);
    for (const t of result.herramientas)
      out(
        `  ${(STATE[t.estado] ?? t.estado).padEnd(8)} ${t.herramienta}${t.version ? ` ${t.version}` : ""}${t.red ? " (usa red)" : ""}${t.detalle ? ` — ${t.detalle}` : ""}`,
      );
    const n = count(result.abiertos);
    out("");
    out(
      `Abiertos: ${n.CRITICAL} CRITICAL, ${n.HIGH} HIGH, ${n.MEDIUM} MEDIUM, ${n.LOW} LOW. Ignorados vigentes: ${result.ignorados.length}.`,
    );
    for (const f of result.abiertos.slice(0, 30))
      out(`  ${f.severidad.padEnd(8)} ${f.herramienta} ${f.regla}  ${location(f)}`);
    if (result.abiertos.length > 30)
      out(`  … y ${result.abiertos.length - 30} más en .evol/qa/security/ultimo.json`);
    for (const aviso of result.avisos) out(`aviso: ${aviso}`);
    if (areas.length === DEFAULT_AREAS.length) out("Resumen en .evol/qa/QA_REPORT.md");
  }

  if (values.ci && reasons.length > 0) {
    if (!values.json) for (const r of reasons) process.stderr.write(`bloqueo: ${r}\n`);
    return 1;
  }
  if (!values.ci && reasons.length > 0 && !values.json)
    for (const r of reasons) process.stderr.write(`aviso: ${r} (con --ci esto fallaría)\n`);
  return 0;
}
