import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { toolPath } from "../skills/tools.js";
import type { RunResult, SecFinding, Severity } from "./model.js";
import { done, failedRun, firstLine, json, missingRun, notApplicable } from "./runners.js";
import type { Spec } from "./runners.js";
import { securityToolVersion } from "./tools.js";

/**
 * The areas that send traffic to a running service (`api` and `tls`). They only reach a target the
 * project declares as its own (`security.objetivos` in evol.config.json), and `evol security scan`
 * asks a person to confirm in a terminal before running them. Everything they do is passive or
 * read-only unless the target says writes are fine.
 */
export interface Target {
  nombre: string;
  url: string;
  openapi?: string | undefined;
  escritura?: boolean | undefined;
}

const LOCAL =
  /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[\w-]+\.(local|localhost|test|internal|lan))$/i;

/** True when the host is on this machine or a private network: not somebody else's server. */
export const isLocalHost = (host: string): boolean => LOCAL.test(host);

const spec = (tool: Spec["tool"], area: Spec["area"], targets: Target[]): Spec => ({
  tool,
  area,
  obligatoria: false,
  red: targets.some((t) => !isLocalHost(new URL(t.url).hostname)),
});

const ST_LABEL: Record<string, string> = {
  ST101: "error de servidor (5xx)",
  ST102: "la respuesta no cumple el esquema",
  ST103: "código de estado no documentado",
  ST104: "cabecera de respuesta no documentada",
  ST201: "contenido de respuesta inesperado",
  ST204: "método no declarado aceptado",
};

/** Where an OpenAPI path may point: inside the project, never absolute or going up. */
function schemaPath(root: string, relative: string): string | null {
  const clean = normalize(relative);
  if (isAbsolute(clean) || clean.startsWith("..")) return null;
  const file = join(root, clean);
  return existsSync(file) ? file : null;
}

const decodeXml = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** schemathesis against the declared OpenAPI document and URL: reads only, unless `escritura`. */
export function runSchemathesis(root: string, targets: Target[]): RunResult {
  const s = spec("schemathesis", "api", targets);
  const withApi = targets.filter((t) => t.openapi);
  if (withApi.length === 0) return notApplicable(s, "ningún objetivo declara su `openapi`");
  const bin = toolPath("schemathesis");
  if (!bin) return missingRun(s);
  const version = securityToolVersion("schemathesis", bin);
  const findings: SecFinding[] = [];
  const problems: string[] = [];
  const work = mkdtempSync(join(tmpdir(), "evol-st-"));
  try {
    for (const t of withApi) {
      const schema = schemaPath(root, t.openapi ?? "");
      if (!schema) {
        problems.push(`${t.nombre}: «${t.openapi}» no existe dentro del proyecto`);
        continue;
      }
      const report = join(work, `${t.nombre.replace(/\W/g, "_")}.xml`);
      const r = spawnSync(
        bin,
        [
          "run",
          schema,
          "--url",
          t.url,
          "--max-examples",
          "25",
          "--workers",
          "1",
          "--no-color",
          ...(t.escritura ? [] : ["--include-method-regex", "^(GET|HEAD)$"]),
          "--report",
          "junit",
          "--report-junit-path",
          report,
        ],
        { cwd: work, encoding: "utf8", timeout: 900_000, maxBuffer: 64 * 1024 * 1024 },
      );
      if (r.error || !existsSync(report) || (r.status !== 0 && r.status !== 1)) {
        problems.push(
          `${t.nombre}: ${r.error?.message ?? `no produjo un informe (código ${r.status}): ${firstLine(r.stderr || r.stdout)}`}`,
        );
        continue;
      }
      const xml = readFileSync(report, "utf8");
      for (const m of xml.matchAll(
        /<testcase name="([^"]*)"[^>]*>\s*<failure[^>]*message="([^"]*)"/g,
      )) {
        const operation = decodeXml(m[1] ?? "");
        for (const code of decodeXml(m[2] ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean))
          findings.push({
            herramienta: "schemathesis",
            area: "api",
            regla: code,
            severidad: code === "ST101" ? "HIGH" : "MEDIUM",
            archivo: t.openapi ?? "",
            mensaje:
              `${t.nombre} ${operation}: ${ST_LABEL[code] ?? `ver «st explain ${code}»`}`.slice(
                0,
                200,
              ),
          });
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (problems.length > 0)
    return { ...failedRun(s, problems.slice(0, 3).join("; "), version), findings };
  return done(s, findings, version);
}

const ZAP_RISK: Record<string, Severity | null> = {
  "3": "HIGH",
  "2": "MEDIUM",
  "1": "LOW",
  "0": null,
};

interface ZapReport {
  site?: { alerts?: { pluginid?: string; alert?: string; name?: string; riskcode?: string }[] }[];
}

/**
 * ZAP in passive mode over a short spider: it reads what the service answers and reports missing
 * headers, cookies without flags and the like. No active scan is ever started. It runs headless
 * through `zap.sh` (`-cmd`), offline (`-silent`), with its own home folder and a capped memory.
 */
export function runZapPassive(_root: string, targets: Target[]): RunResult {
  const s = spec("zaproxy", "api", targets);
  if (targets.length === 0) return notApplicable(s, "sin objetivos declarados");
  const bin = toolPath("zaproxy");
  if (!bin) return missingRun(s);
  const version = securityToolVersion("zaproxy", bin);
  const findings: SecFinding[] = [];
  const problems: string[] = [];
  for (const t of targets) {
    const work = mkdtempSync(join(tmpdir(), "evol-zap-"));
    try {
      const origin = new URL(t.url).origin;
      const plan = join(work, "plan.yaml");
      writeFileSync(
        plan,
        [
          "env:",
          "  contexts:",
          "    - name: objetivo",
          `      urls: [${JSON.stringify(origin)}]`,
          `      includePaths: [${JSON.stringify(`${origin}.*`)}]`,
          "  parameters:",
          "    failOnError: false",
          "    progressToStdout: false",
          "jobs:",
          "  - type: passiveScan-config",
          "    parameters:",
          "      scanOnlyInScope: true",
          "  - type: spider",
          "    parameters:",
          "      maxDuration: 1",
          "      maxDepth: 3",
          "  - type: passiveScan-wait",
          "    parameters:",
          "      maxDuration: 2",
          "  - type: report",
          "    parameters:",
          "      template: traditional-json",
          `      reportDir: ${JSON.stringify(work)}`,
          "      reportFile: zap",
          "",
        ].join("\n"),
      );
      const env = { ...process.env };
      delete env["DISPLAY"];
      delete env["WAYLAND_DISPLAY"];
      const r = spawnSync(
        bin,
        ["-Xmx1g", "-cmd", "-silent", "-dir", join(work, "home"), "-autorun", plan],
        { cwd: dirname(bin), encoding: "utf8", timeout: 900_000, maxBuffer: 64 * 1024 * 1024, env },
      );
      const report = join(work, "zap.json");
      const parsed = existsSync(report) ? json<ZapReport>(readFileSync(report, "utf8")) : null;
      // exit 2 only means the plan had warnings (a 404 at the root, for instance)
      if (r.error || parsed === null || (r.status !== 0 && r.status !== 2)) {
        problems.push(
          `${t.nombre}: ${r.error?.message ?? `no produjo un informe (código ${r.status})`}`,
        );
        continue;
      }
      for (const site of parsed.site ?? [])
        for (const a of site.alerts ?? []) {
          const severidad = ZAP_RISK[a.riskcode ?? ""];
          if (!severidad) continue;
          findings.push({
            herramienta: "zaproxy",
            area: "api",
            regla: a.pluginid ?? "desconocida",
            severidad,
            archivo: t.nombre,
            mensaje: (a.alert ?? a.name ?? "alerta de ZAP").slice(0, 200),
          });
        }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  if (problems.length > 0)
    return { ...failedRun(s, problems.slice(0, 3).join("; "), version), findings };
  return done(s, findings, version);
}

const TESTSSL_SEVERITY: Record<string, Severity> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  WARN: "LOW",
};

/** testssl.sh over the HTTPS targets: protocols, ciphers, certificate and known TLS flaws. */
export function runTestssl(_root: string, targets: Target[]): RunResult {
  const s = spec("testssl", "tls", targets);
  const secure = targets.filter((t) => new URL(t.url).protocol === "https:");
  if (secure.length === 0) return notApplicable(s, "ningún objetivo usa https");
  const bin = toolPath("testssl");
  if (!bin) return missingRun(s);
  const version = securityToolVersion("testssl", bin);
  const findings: SecFinding[] = [];
  const problems: string[] = [];
  const work = mkdtempSync(join(tmpdir(), "evol-tls-"));
  try {
    for (const t of secure) {
      const u = new URL(t.url);
      const out = join(work, `${t.nombre.replace(/\W/g, "_")}.json`);
      const r = spawnSync(
        bin,
        [
          "--jsonfile",
          out,
          "--quiet",
          "--color",
          "0",
          "--warnings",
          "off",
          "--severity",
          "LOW",
          `${u.hostname}:${u.port || "443"}`,
        ],
        { cwd: work, encoding: "utf8", timeout: 900_000, maxBuffer: 64 * 1024 * 1024 },
      );
      const rows = existsSync(out)
        ? json<{ id?: string; severity?: string; finding?: string }[]>(readFileSync(out, "utf8"))
        : null;
      if (r.error || rows === null) {
        problems.push(
          `${t.nombre}: ${r.error?.message ?? `no produjo un informe (código ${r.status}): ${firstLine(r.stderr || r.stdout)}`}`,
        );
        continue;
      }
      // one row per cipher would bury the rest: they are counted together, by severity
      const weak = new Map<Severity, number>();
      for (const row of rows) {
        const severidad = TESTSSL_SEVERITY[(row.severity ?? "").toUpperCase()];
        const id = row.id ?? "desconocida";
        // derived or about testssl itself, not a finding about the service
        if (!severidad || id === "overall_grade" || id === "engine_problem") continue;
        if (id.startsWith("cipher-")) {
          weak.set(severidad, (weak.get(severidad) ?? 0) + 1);
          continue;
        }
        findings.push({
          herramienta: "testssl",
          area: "tls",
          regla: id,
          severidad,
          archivo: t.nombre,
          mensaje: `${id}: ${(row.finding ?? "").replace(/\s+/g, " ")}`.slice(0, 200),
        });
      }
      for (const [severidad, n] of weak)
        findings.push({
          herramienta: "testssl",
          area: "tls",
          regla: "cipher-suites",
          severidad,
          archivo: t.nombre,
          mensaje: `${n} suite(s) de cifrado con valoración ${severidad} (ver testssl para la lista)`,
        });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (problems.length > 0)
    return { ...failedRun(s, problems.slice(0, 3).join("; "), version), findings };
  return done(s, findings, version);
}
