import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { parseConfig } from "../src/core/config.js";
import { ACTIVE_AREAS, AREAS, DEFAULT_AREAS } from "../src/security/model.js";
import {
  isLocalHost,
  runSchemathesis,
  runTestssl,
  runZapPassive,
} from "../src/security/runners-active.js";
import { runCheckov, runReuse, runSyft, runTrivy } from "../src/security/runners-infra.js";
import { scan } from "../src/security/scan.js";
import { securityToolStatus } from "../src/security/tools.js";
import { toolPath } from "../src/skills/tools.js";
import { baseConfig, cli, isolateUserConfig, makeProject, tempDir, write } from "./helpers.js";

// resolved before any test points a tool at a stand-in: these are the ones really installed
const REAL = {
  trivy: toolPath("trivy"),
  checkov: toolPath("checkov"),
  syft: toolPath("syft"),
  schemathesis: toolPath("schemathesis"),
  zaproxy: toolPath("zaproxy"),
  testssl: toolPath("testssl"),
};

beforeAll(() => void isolateUserConfig());

const OVERRIDES = [
  "EVOL_TOOL_TRIVY",
  "EVOL_TOOL_CHECKOV",
  "EVOL_TOOL_SYFT",
  "EVOL_TOOL_REUSE",
  "EVOL_TOOL_SCHEMATHESIS",
  "EVOL_TOOL_ZAPROXY",
  "EVOL_TOOL_TESTSSL",
] as const;
afterEach(() => {
  for (const k of OVERRIDES) delete process.env[k];
});

/** A tool stand-in: logs how it was called and runs `body` (`$LOG` is the log file). */
function stub(env: (typeof OVERRIDES)[number], body: string): { log: () => string[] } {
  const dir = tempDir("evol-secarea-");
  const file = join(dir, "tool");
  const log = join(dir, "calls.log");
  writeFileSync(file, `#!/bin/sh\nLOG="${log}"\nprintf '%s\\n' "$*" >> "$LOG"\n${body}\n`, {
    mode: 0o755,
  });
  chmodSync(file, 0o755);
  process.env[env] = file;
  return { log: () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []) };
}

const DOCKER = { Dockerfile: "FROM node:latest\nUSER root\n" };
function project(files: Record<string, string>): string {
  const root = tempDir("evol-secarea-project-");
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
  return root;
}

describe("contenedores: trivy y checkov", () => {
  const TRIVY_OUT = JSON.stringify({
    Results: [
      {
        Target: "Dockerfile",
        Misconfigurations: [
          {
            ID: "DS-0002",
            Title: "Image user should not be 'root'",
            Severity: "HIGH",
            Status: "FAIL",
            CauseMetadata: { StartLine: 4 },
          },
          { ID: "DS-0026", Title: "No HEALTHCHECK defined", Severity: "LOW", Status: "FAIL" },
          { ID: "DS-0001", Title: "':latest' tag used", Severity: "MEDIUM", Status: "PASS" },
        ],
      },
    ],
  });

  it("trivy: normaliza lo que falla, ignora lo que pasa y no usa el .trivyignore del proyecto", () => {
    const s = stub(
      "EVOL_TOOL_TRIVY",
      `case "$1" in --version) echo "Version: 0.99.0"; exit 0;; esac\necho '${TRIVY_OUT}'`,
    );
    const run = runTrivy(project({ ...DOCKER, ".trivyignore": "DS-0002\n" }).toString(), [
      "Dockerfile",
      ".trivyignore",
    ]);
    expect(run.outcome).toMatchObject({ herramienta: "trivy", estado: "ok", version: "0.99.0" });
    expect(
      run.findings.map(
        (f) => `${f.severidad} ${f.regla} ${f.archivo}${f.linea ? `:${f.linea}` : ""}`,
      ),
    ).toEqual(["HIGH DS-0002 Dockerfile:4", "LOW DS-0026 Dockerfile"]);
    const call = s.log().find((l) => l.startsWith("config")) ?? "";
    expect(call).toContain("--skip-check-update");
    expect(call).toMatch(/--ignorefile \S+sin-ignorados/);
  });

  it("trivy: sin Dockerfile, Terraform ni manifiestos no corre; con un manifiesto de Kubernetes sí", () => {
    const s = stub("EVOL_TOOL_TRIVY", `echo '{"Results":[]}'`);
    const none = project({ "src/a.ts": "export {};\n" });
    expect(runTrivy(none, ["src/a.ts"]).outcome.estado).toBe("no-aplica");
    expect(s.log()).toEqual([]);
    const k8s = project({ "k8s/app.yaml": "apiVersion: v1\nkind: Pod\n" });
    expect(runTrivy(k8s, ["k8s/app.yaml"]).outcome.estado).toBe("ok");
  });

  it("trivy: si falta se dice, y si no devuelve un informe legible es un fallo, no un visto bueno", () => {
    process.env["EVOL_TOOL_TRIVY"] = "";
    expect(runTrivy(project(DOCKER), ["Dockerfile"]).outcome.estado).toBe("falta");
    stub("EVOL_TOOL_TRIVY", `echo "boom" >&2; exit 3`);
    const bad = runTrivy(project(DOCKER), ["Dockerfile"]);
    expect(bad.outcome.estado).toBe("fallo");
    expect(bad.outcome.detalle).toContain("código 3");
  });

  it("checkov: solo mira los pipelines de CI, con MEDIUM porque no trae severidad, y no descarga nada", () => {
    const out = JSON.stringify({
      check_type: "github_actions",
      results: {
        failed_checks: [
          {
            check_id: "CKV_GHA_2",
            check_name: "Ensure run commands are not vulnerable to shell injection",
            file_path: "/.github/workflows/ci.yml",
            file_line_range: [8, 8],
            severity: null,
          },
        ],
      },
    });
    const s = stub(
      "EVOL_TOOL_CHECKOV",
      `case "$1" in --version) echo 3.3.28; exit 0;; esac\necho '${out}'\nexit 1`,
    );
    const files = [".github/workflows/ci.yml", "src/a.ts"];
    const run = runCheckov(project({}), files);
    expect(run.outcome.estado).toBe("ok");
    expect(run.findings).toMatchObject([
      { regla: "CKV_GHA_2", severidad: "MEDIUM", archivo: ".github/workflows/ci.yml", linea: 8 },
    ]);
    const call = s.log().find((l) => l.includes("--framework")) ?? "";
    expect(call).toContain("--framework github_actions");
    expect(call).toContain("--skip-download");
    expect(runCheckov(project({}), ["src/a.ts"]).outcome.estado).toBe("no-aplica");
  });
});

describe("licencias: syft y reuse", () => {
  it("syft: guarda el SBOM como evidencia y avisa de una licencia copyleft fuerte", () => {
    const sbom = JSON.stringify({
      components: [
        { name: "left-pad", version: "1.3.0", licenses: [{ license: { id: "MIT" } }] },
        { name: "gpl-lib", version: "2.0.0", licenses: [{ license: { id: "GPL-3.0-only" } }] },
      ],
    });
    stub(
      "EVOL_TOOL_SYFT",
      `case "$1" in --version) echo "syft 1.99.0"; exit 0;; esac
for a in "$@"; do case "$a" in cyclonedx-json=*) echo '${sbom}' > "\${a#cyclonedx-json=}";; esac; done`,
    );
    const root = project({ "package-lock.json": "{}" });
    const run = runSyft(root, ["package-lock.json"]);
    expect(run.outcome).toMatchObject({ estado: "ok", version: "1.99.0" });
    expect(run.outcome.detalle).toContain("2 componente(s)");
    expect(run.findings).toMatchObject([{ regla: "copyleft-GPL-3.0-only", severidad: "MEDIUM" }]);
    expect(existsSync(join(root, ".evol/qa/security/sbom.cdx.json"))).toBe(true);
    expect(runSyft(project({}), ["src/a.ts"]).outcome.estado).toBe("no-aplica");
  });

  it("reuse: solo en proyectos que ya usan REUSE, un hallazgo por tipo de incumplimiento", () => {
    stub(
      "EVOL_TOOL_REUSE",
      `case "$1" in --version) echo "reuse, version 6.2.0"; exit 0;; esac
echo '{"non_compliant":{"missing_licensing_info":["a","b"],"missing_copyright_info":["a"],"bad_licenses":[]}}'
exit 1`,
    );
    expect(runReuse(project({}), ["src/a.ts"]).outcome.estado).toBe("no-aplica");
    const run = runReuse(project({ "REUSE.toml": "version = 1\n" }), ["REUSE.toml"]);
    expect(run.outcome).toMatchObject({ estado: "ok", version: "6.2.0" });
    expect(run.findings.map((f) => `${f.regla}: ${f.mensaje}`)).toEqual([
      "missing_copyright_info: 1 archivo(s) sin información de copyright",
      "missing_licensing_info: 2 archivo(s) sin información de licencia",
    ]);
  });
});

describe("api y tls: solo contra lo declarado y solo con una persona", () => {
  const API = { nombre: "api", url: "http://127.0.0.1:3000", openapi: "openapi.yaml" };

  it("schemathesis: lee el JUnit, un 5xx es HIGH, y sin escritura solo prueba GET y HEAD", () => {
    const xml = `<testsuites><testsuite><testcase name="GET /boom"><failure message="ST101, ST204">x</failure></testcase><testcase name="GET /ok"></testcase></testsuite></testsuites>`;
    const s = stub(
      "EVOL_TOOL_SCHEMATHESIS",
      `case "$1" in --version) echo "st, version 4.99.0"; exit 0;; esac
while [ $# -gt 0 ]; do if [ "$1" = "--report-junit-path" ]; then shift; echo '${xml}' > "$1"; fi; shift; done
exit 1`,
    );
    const root = project({ "openapi.yaml": "openapi: 3.0.3\n" });
    const run = runSchemathesis(root, [API]);
    expect(run.outcome).toMatchObject({ estado: "ok", version: "4.99.0", red: false });
    expect(run.findings.map((f) => `${f.severidad} ${f.regla}`)).toEqual([
      "HIGH ST101",
      "MEDIUM ST204",
    ]);
    expect(run.findings[0]?.mensaje).toContain("GET /boom");
    const call = s.log().find((l) => l.startsWith("run")) ?? "";
    expect(call).toContain("--include-method-regex ^(GET|HEAD)$");
    const writes = runSchemathesis(root, [{ ...API, escritura: true }]);
    expect(writes.outcome.estado).toBe("ok");
    expect(
      s
        .log()
        .filter((l) => l.startsWith("run"))
        .pop(),
    ).not.toContain("--include-method-regex");
  });

  it("schemathesis: un openapi fuera del proyecto o inexistente no se usa", () => {
    stub("EVOL_TOOL_SCHEMATHESIS", `echo nunca`);
    const root = project({});
    for (const openapi of ["../fuera.yaml", "/etc/passwd", "no-existe.yaml"]) {
      const run = runSchemathesis(root, [{ ...API, openapi }]);
      expect(run.outcome.estado).toBe("fallo");
    }
    expect(runSchemathesis(root, [{ nombre: "x", url: "http://127.0.0.1:1" }]).outcome.estado).toBe(
      "no-aplica",
    );
  });

  it("zaproxy: corre en modo línea de órdenes, sin red y sin pantalla, y mapea el riesgo", () => {
    const report = JSON.stringify({
      site: [
        {
          alerts: [
            {
              pluginid: "10038",
              alert: "Content Security Policy (CSP) Header Not Set",
              riskcode: "2",
            },
            { pluginid: "10020", alert: "Missing Anti-clickjacking Header", riskcode: "1" },
            { pluginid: "10109", alert: "Informativo", riskcode: "0" },
          ],
        },
      ],
    });
    const s = stub(
      "EVOL_TOOL_ZAPROXY",
      `DIR=$(sed -n 's/.*reportDir: "\\(.*\\)"/\\1/p' "$(echo "$@" | sed 's/.*-autorun //')")
echo '${report}' > "$DIR/zap.json"
exit 2`,
    );
    const display = process.env["DISPLAY"];
    process.env["DISPLAY"] = ":0";
    try {
      const run = runZapPassive(project({}), [API]);
      expect(run.outcome.estado).toBe("ok");
      expect(run.findings.map((f) => `${f.severidad} ${f.regla}`)).toEqual([
        "MEDIUM 10038",
        "LOW 10020",
      ]);
    } finally {
      if (display === undefined) delete process.env["DISPLAY"];
      else process.env["DISPLAY"] = display;
    }
    const call = s.log()[0] ?? "";
    expect(call).toContain("-cmd -silent");
    expect(call).toContain("-Xmx1g");
    expect(call).toContain("-autorun");
  });

  it("testssl: agrupa los cifrados, descarta lo derivado y solo mira los https", () => {
    const rows = JSON.stringify([
      { id: "cipher-tls1_2_xc027", severity: "LOW", finding: "TLSv1.2 xc027" },
      { id: "cipher-tls1_2_xc028", severity: "LOW", finding: "TLSv1.2 xc028" },
      { id: "cert_chain_of_trust", severity: "CRITICAL", finding: "failed (self signed)." },
      { id: "HSTS", severity: "LOW", finding: "not offered" },
      { id: "overall_grade", severity: "CRITICAL", finding: "T" },
      { id: "engine_problem", severity: "WARN", finding: "No engine" },
      { id: "TLS1_3", severity: "OK", finding: "offered" },
    ]);
    stub(
      "EVOL_TOOL_TESTSSL",
      `case "$1" in --version) printf 'testssl version 3.9.9\\n'; exit 0;; esac
while [ $# -gt 0 ]; do if [ "$1" = "--jsonfile" ]; then shift; echo '${rows}' > "$1"; fi; shift; done`,
    );
    const run = runTestssl(project({}), [{ nombre: "web", url: "https://127.0.0.1:8443" }]);
    expect(run.outcome.estado).toBe("ok");
    expect(run.findings.map((f) => `${f.severidad} ${f.regla}`).sort()).toEqual([
      "CRITICAL cert_chain_of_trust",
      "LOW HSTS",
      "LOW cipher-suites",
    ]);
    expect(run.findings.find((f) => f.regla === "cipher-suites")?.mensaje).toContain("2 suite(s)");
    expect(runTestssl(project({}), [API]).outcome.estado).toBe("no-aplica");
  });

  it("scan(): un área que envía tráfico no corre sin confirmación ni sin objetivos declarados", () => {
    const s = stub("EVOL_TOOL_TESTSSL", `echo nunca`);
    const root = project({});
    const targets = [{ nombre: "web", url: "https://127.0.0.1:8443" }];
    const unconfirmed = scan(root, ["tls"], new Date(), { objetivos: targets });
    expect(unconfirmed.herramientas[0]).toMatchObject({ estado: "no-aplica" });
    expect(unconfirmed.herramientas[0]?.detalle).toContain("confirma una persona");
    const noTargets = scan(root, ["tls"], new Date(), { confirmadas: true });
    expect(noTargets.herramientas[0]?.detalle).toContain("security.objetivos");
    expect(s.log()).toEqual([]);
  });

  it("qué es un host propio", () => {
    for (const h of [
      "localhost",
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.5",
      "172.20.0.1",
      "api.local",
      "x.test",
      "[::1]",
    ])
      expect(isLocalHost(h), h).toBe(true);
    for (const h of ["example.com", "8.8.8.8", "172.32.0.1", "localhost.evil.com"])
      expect(isLocalHost(h), h).toBe(false);
  });
});

describe("la CLI y la configuración", () => {
  const target = { nombre: "api", url: "http://127.0.0.1:3000", escritura: false };
  const withTargets = (): string => makeProject(["FDD"], { security: { objetivos: [target] } });
  const scanArgs = (root: string, ...args: string[]) =>
    cli(["security", "scan", ...args], { cwd: root, env: {} });

  it("un escaneo normal cubre las áreas que solo leen archivos", () => {
    expect(DEFAULT_AREAS).toEqual([
      "secretos",
      "codigo",
      "dependencias",
      "contenedores",
      "licencias",
    ]);
    expect(ACTIVE_AREAS).toEqual(["api", "tls"]);
    expect(AREAS).toHaveLength(7);
    const r = scanArgs(project({ "evol.config.json": "{}" }), "--json", "--solo", "licencias");
    expect(JSON.parse(r.stdout).areas).toEqual(["licencias"]);
  });

  it("api y tls piden una persona en una terminal: sin ella, no hay tráfico", () => {
    const r = scanArgs(withTargets(), "--solo", "api");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/terminal/i);
    expect(r.stdout).toContain("Se enviará tráfico a estos objetivos");
  });

  it("con --ci no se envía tráfico, aunque haya objetivos", () => {
    const r = scanArgs(withTargets(), "--solo", "tls", "--ci");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no corren con --ci");
  });

  it("sin objetivos declarados lo dice y no pregunta nada", () => {
    const r = scanArgs(makeProject(["FDD"]), "--solo", "api");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("security.objetivos");
    expect(r.stdout).not.toContain("Se enviará tráfico");
  });

  it("una área desconocida se rechaza y el uso las lista", () => {
    const r = scanArgs(makeProject(["FDD"]), "--solo", "nada");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("contenedores|licencias|api|tls");
  });

  it("los objetivos de evol.config.json se validan", () => {
    const ok = parseConfig({
      ...baseConfig(["FDD"]),
      security: { objetivos: [{ nombre: "a", url: "http://localhost:3000" }] },
    });
    expect(ok.security?.objetivos[0]?.escritura).toBe(false);
    expect(() =>
      parseConfig({
        ...baseConfig(["FDD"]),
        security: { objetivos: [{ nombre: "a", url: "no es una url" }] },
      }),
    ).toThrow();
    expect(() =>
      parseConfig({
        ...baseConfig(["FDD"]),
        security: { objetivos: [{ nombre: "", url: "http://x.test" }] },
      }),
    ).toThrow();
  });

  it("evol doctor conoce las siete herramientas nuevas", async () => {
    const names = (await securityToolStatus()).map((t) => t.tool);
    for (const t of ["trivy", "checkov", "syft", "reuse", "schemathesis", "zaproxy", "testssl"])
      expect(names).toContain(t);
  });
});

describe("herramientas reales", () => {
  let server: ChildProcess | undefined;
  let port = 0;

  beforeAll(async () => {
    server = spawn(
      process.execPath,
      [
        "-e",
        `const s=require("http").createServer((q,r)=>{
          if(q.url.startsWith("/boom")){r.statusCode=500;r.setHeader("content-type","application/json");r.end("{}");return}
          if(q.url.startsWith("/items")){r.setHeader("content-type","application/json");r.end("[{\\"id\\":1}]");return}
          r.setHeader("content-type","text/html");r.end("<html><body><a href='/items'>x</a></body></html>")
        }).listen(0,"127.0.0.1",()=>console.log(s.address().port))`,
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    port = Number(
      await new Promise<string>((resolve) =>
        server?.stdout?.once("data", (d: Buffer) => resolve(String(d).trim())),
      ),
    );
  });
  afterAll(() => void server?.kill());

  const OPENAPI = `openapi: 3.0.3
info: { title: demo, version: "1" }
paths:
  /items:
    get:
      responses:
        "200": { description: ok }
  /boom:
    get:
      responses:
        "200": { description: ok }
`;

  it.skipIf(!REAL.trivy)(
    "trivy real: encuentra un Dockerfile con root y la etiqueta latest",
    () => {
      const root = project({ Dockerfile: "FROM node:latest\nUSER root\n" });
      const run = runTrivy(root, ["Dockerfile"]);
      expect(run.outcome.estado, run.outcome.detalle).toBe("ok");
      expect(run.findings.map((f) => f.regla)).toEqual(
        expect.arrayContaining(["DS-0001", "DS-0002"]),
      );
    },
  );

  it.skipIf(!REAL.checkov)("checkov real: una acción de GitHub con inyección de comandos", () => {
    const wf =
      "name: ci\non: pull_request_target\njobs:\n  b:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v3\n      - run: echo ${{ github.event.pull_request.title }}\n";
    const root = project({ ".github/workflows/ci.yml": wf });
    const run = runCheckov(root, [".github/workflows/ci.yml"]);
    expect(run.outcome.estado, run.outcome.detalle).toBe("ok");
    expect(run.findings.map((f) => f.regla)).toContain("CKV_GHA_2");
  });

  it.skipIf(!REAL.syft)("syft real: genera el SBOM de un archivo de bloqueo", () => {
    const lock = JSON.stringify({
      name: "x",
      lockfileVersion: 3,
      packages: { "": { name: "x" }, "node_modules/left-pad": { version: "1.3.0" } },
    });
    const root = project({ "package-lock.json": lock });
    const run = runSyft(root, ["package-lock.json"]);
    expect(run.outcome.estado, run.outcome.detalle).toBe("ok");
    expect(
      JSON.parse(readFileSync(join(root, ".evol/qa/security/sbom.cdx.json"), "utf8")).bomFormat,
    ).toBe("CycloneDX");
  });

  it.skipIf(!REAL.schemathesis)(
    "schemathesis real: encuentra el error 500 de una API de ejemplo",
    () => {
      const root = project({ "openapi.yaml": OPENAPI });
      const run = runSchemathesis(root, [
        { nombre: "demo", url: `http://127.0.0.1:${port}`, openapi: "openapi.yaml" },
      ]);
      expect(run.outcome.estado, run.outcome.detalle).toBe("ok");
      const boom = run.findings.find((f) => f.regla === "ST101");
      expect(boom?.severidad).toBe("HIGH");
      expect(boom?.mensaje).toContain("GET /boom");
    },
    120_000,
  );

  it.skipIf(!REAL.zaproxy)(
    "zaproxy real: el análisis pasivo de una página sin cabeceras de seguridad",
    () => {
      const run = runZapPassive(project({}), [
        { nombre: "demo", url: `http://127.0.0.1:${port}/` },
      ]);
      expect(run.outcome.estado, run.outcome.detalle).toBe("ok");
      expect(run.findings.length).toBeGreaterThan(0);
      expect(run.findings.every((f) => f.herramienta === "zaproxy")).toBe(true);
    },
    240_000,
  );

  // testssl takes over a minute even against a local server: opt in with EVOL_SLOW_TESTS=1
  it.skipIf(!REAL.testssl || process.env["EVOL_SLOW_TESTS"] !== "1")(
    "testssl real: un servidor TLS con certificado autofirmado",
    async () => {
      const dir = tempDir("evol-tls-");
      const gen = await new Promise<number | null>((resolve) =>
        spawn(
          "openssl",
          [
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            join(dir, "k.pem"),
            "-out",
            join(dir, "c.pem"),
            "-days",
            "2",
            "-subj",
            "/CN=localhost",
          ],
          { stdio: "ignore" },
        ).on("close", resolve),
      );
      expect(gen).toBe(0);
      const tls = spawn(
        process.execPath,
        [
          "-e",
          `const s=require("https").createServer({key:require("fs").readFileSync("${join(dir, "k.pem")}"),cert:require("fs").readFileSync("${join(dir, "c.pem")}")},(q,r)=>r.end("ok")).listen(0,"127.0.0.1",()=>console.log(s.address().port))`,
        ],
        { stdio: ["ignore", "pipe", "ignore"] },
      );
      try {
        const tlsPort = await new Promise<string>((resolve) =>
          tls.stdout.once("data", (d: Buffer) => resolve(String(d).trim())),
        );
        const run = runTestssl(project({}), [
          { nombre: "tls", url: `https://127.0.0.1:${tlsPort}` },
        ]);
        expect(run.outcome.estado, run.outcome.detalle).toBe("ok");
        expect(run.findings.map((f) => f.regla)).toContain("cert_chain_of_trust");
      } finally {
        tls.kill();
      }
    },
    400_000,
  );
});
