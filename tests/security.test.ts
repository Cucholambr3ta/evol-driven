import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { reviewIgnores } from "../src/security/ignore.js";
import { ruleId } from "../src/security/runners.js";
import { toolPath } from "../src/skills/tools.js";
import { loadDisciplines } from "../src/core/disciplines.js";
import type { Discipline } from "../src/core/disciplines.js";
import { verifyDiscipline } from "../src/core/verify.js";
import { cleanSecurityTools, cli, isolateUserConfig, tempDir, write } from "./helpers.js";

/** Resolved before any test points a tool at a stand-in, so it is the one really installed (or null). */
const REAL_GITLEAKS = toolPath("gitleaks");

beforeAll(() => void isolateUserConfig());

const SECRET = "AKIAIOSFODNN7EXAMPLQ";

function stub(name: string, body: string): string {
  const dir = tempDir("evol-sec-tool-");
  const file = join(dir, name);
  writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  chmodSync(file, 0o755);
  return file;
}

/** A gitleaks stand-in that reports one leak and, like a careless tool, also carries the secret. */
const GITLEAKS_LEAK = `case "$1" in version) echo 8.99.0; exit 0;; esac
SRC="$2"; OUT=""
while [ $# -gt 0 ]; do if [ "$1" = "--report-path" ]; then shift; OUT="$1"; fi; shift; done
echo '[{"RuleID":"aws-access-token","File":"'"$SRC"'/scripts/run.sh","StartLine":2,"Secret":"${SECRET}","Match":"KEY=${SECRET}"}]' > "$OUT"
exit 2`;
const GITLEAKS_CLEAN = `case "$1" in version) echo 8.99.0; exit 0;; esac
while [ $# -gt 0 ]; do if [ "$1" = "--report-path" ]; then shift; echo "[]" > "$1"; fi; shift; done
exit 0`;
const BANDIT_CLEAN = `case "$1" in --version) echo "bandit 1.9.4"; exit 0;; esac
echo '{"errors":[],"results":[]}'`;
const SHELLCHECK_CLEAN = `case "$1" in --version) printf 'version: 0.11.0\\n'; exit 0;; esac
echo '[]'`;
const OSV_CLEAN = `case "$1" in --version) echo "osv-scanner version: 2.7.0"; exit 0;; esac
echo '{"results":[]}'`;
const SEMGREP_HIT = `case "$1" in --version) echo 1.99.0; exit 0;; esac
echo '{"results":[{"check_id":"evol.py-shell-true","path":"src/a.py","start":{"line":2},"extra":{"severity":"ERROR","message":"shell=True con ${SECRET}"}},{"check_id":"evol.js-dynamic-require","path":"src/b.js","start":{"line":9},"extra":{"severity":"WARNING"}},{"check_id":"proj.taint-sql","path":"src/c.py","start":{"line":4},"extra":{"severity":"ERROR","metadata":{"evol_severity":"CRITICAL"}}}],"errors":[]}'`;
const SEMGREP_CLEAN = `case "$1" in --version) echo 1.99.0; exit 0;; esac
echo '{"results":[],"errors":[]}'`;
const BANDIT_HIT = `case "$1" in --version) echo "bandit 1.9.4"; exit 0;; esac
echo '{"errors":[],"results":[{"filename":"./src/a.py","line_number":3,"issue_severity":"LOW","test_id":"B105","test_name":"hardcoded_password_string","issue_text":"Possible hardcoded password: '"'"'hunter2hunter2'"'"'","code":"password = hunter2hunter2"}]}'
exit 1`;
const SHELLCHECK_HIT = `case "$1" in --version) printf 'ShellCheck - x\\nversion: 0.11.0\\n'; exit 0;; esac
echo '[{"file":"scripts/run.sh","line":4,"level":"warning","code":2115,"message":"Use rm -rf \${var:?}"}]'
exit 1`;
const OSV_VULN = `case "$1" in --version) echo "osv-scanner version: 2.7.0"; exit 0;; esac
echo '{"results":[{"source":{"path":"'"$PWD"'/package-lock.json"},"packages":[{"package":{"name":"lodash","version":"4.17.15"},"groups":[{"ids":["GHSA-aaaa"],"max_severity":"9.8"},{"ids":["GHSA-bbbb"],"max_severity":"5.3"}],"vulnerabilities":[{"id":"GHSA-aaaa","summary":"Prototype pollution"},{"id":"GHSA-bbbb","summary":"ReDoS"}]}]}]}'
exit 1`;
const OSV_OFFLINE = `case "$1" in --version) echo "osv-scanner version: 2.7.0"; exit 0;; esac
echo "failed to fetch" >&2
exit 127`;
const GUARDDOG_HIT = `case "$1" in --version) echo 3.2.0; exit 0;; esac
echo '[{"dependency":"evil-pkg","version":"1.0.0","result":{"issues":2,"errors":{},"results":{"capability-process-spawn":[{"location":"x.js:1","code":"exec(","message":"m"}],"threat-network-exfiltration":[{"location":"y.js:2","code":"fetch(secret)","message":"m"}],"typosquatting":null}}}]'`;

type ToolEnv =
  | "EVOL_TOOL_GITLEAKS"
  | "EVOL_TOOL_SEMGREP"
  | "EVOL_TOOL_BANDIT"
  | "EVOL_TOOL_SHELLCHECK"
  | "EVOL_TOOL_OSV_SCANNER"
  | "EVOL_TOOL_GUARDDOG";

/** Points every tool at a stand-in (or at nothing, with ""). */
function tools(overrides: Partial<Record<ToolEnv, string>>): Record<string, string> {
  const base: Record<ToolEnv, string> = {
    EVOL_TOOL_GITLEAKS: stub("gitleaks", GITLEAKS_CLEAN),
    EVOL_TOOL_SEMGREP: stub("semgrep", SEMGREP_CLEAN),
    EVOL_TOOL_BANDIT: "",
    EVOL_TOOL_SHELLCHECK: "",
    EVOL_TOOL_OSV_SCANNER: "",
    EVOL_TOOL_GUARDDOG: "",
  };
  return { ...base, ...overrides };
}

function project(files: Record<string, string> = {}): string {
  const root = tempDir("evol-sec-project-");
  write(root, "evol.config.json", "{}");
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
  return root;
}

const FULL = {
  "scripts/run.sh": "#!/bin/bash\nrm -rf $1/*\n",
  "src/a.py": "print(1)\n",
  "package-lock.json": "{}",
  "package.json": '{"dependencies":{"evil-pkg":"1.0.0"}}',
};

const scanJson = (root: string, env: Record<string, string>, ...args: string[]) => {
  const r = cli(["security", "scan", "--json", ...args], { cwd: root, env });
  return { ...r, data: r.stdout.trim().startsWith("{") ? JSON.parse(r.stdout) : null };
};

describe("evol security scan", () => {
  it("normaliza a un formato común y mapea las severidades de cada herramienta", () => {
    const root = project(FULL);
    const r = scanJson(
      root,
      tools({
        EVOL_TOOL_GITLEAKS: stub("gitleaks", GITLEAKS_LEAK),
        EVOL_TOOL_SEMGREP: stub("semgrep", SEMGREP_HIT),
        EVOL_TOOL_BANDIT: stub("bandit", BANDIT_HIT),
        EVOL_TOOL_SHELLCHECK: stub("shellcheck", SHELLCHECK_HIT),
        EVOL_TOOL_OSV_SCANNER: stub("osv-scanner", OSV_VULN),
        EVOL_TOOL_GUARDDOG: stub("guarddog", GUARDDOG_HIT),
      }),
    );
    expect(r.status).toBe(0);
    const open = r.data.abiertos as {
      herramienta: string;
      area: string;
      regla: string;
      severidad: string;
      archivo: string;
      linea?: number;
    }[];
    const by = (tool: string, regla: string) =>
      open.find((f) => f.herramienta === tool && f.regla === regla);
    expect(by("gitleaks", "aws-access-token")).toMatchObject({
      area: "secretos",
      severidad: "CRITICAL",
      archivo: "scripts/run.sh",
      linea: 2,
    });
    expect(by("semgrep", "evol.py-shell-true")?.severidad).toBe("HIGH");
    expect(by("semgrep", "evol.js-dynamic-require")?.severidad).toBe("MEDIUM");
    expect(by("semgrep", "proj.taint-sql")?.severidad).toBe("CRITICAL");
    expect(by("bandit", "B105")).toMatchObject({ severidad: "LOW", archivo: "src/a.py" });
    expect(by("shellcheck", "SC2115")?.severidad).toBe("MEDIUM");
    expect(by("osv-scanner", "GHSA-aaaa")).toMatchObject({
      severidad: "CRITICAL",
      archivo: "package-lock.json",
    });
    expect(by("osv-scanner", "GHSA-bbbb")?.severidad).toBe("MEDIUM");
    expect(by("guarddog", "threat-network-exfiltration")?.severidad).toBe("HIGH");
    // «capability-*» only says what a package can do: it is not a finding
    expect(open.some((f) => f.regla.startsWith("capability-"))).toBe(false);
    // most severe first
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const ranks = open.map((f) => order.indexOf(f.severidad));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("nunca incluye el valor de un secreto, ni en la salida ni en lo que guarda", () => {
    const root = project(FULL);
    const env = tools({
      EVOL_TOOL_GITLEAKS: stub("gitleaks", GITLEAKS_LEAK),
      EVOL_TOOL_SEMGREP: stub("semgrep", SEMGREP_HIT),
      EVOL_TOOL_BANDIT: stub("bandit", BANDIT_HIT),
    });
    const human = cli(["security", "scan"], { cwd: root, env });
    const json = cli(["security", "scan", "--json"], { cwd: root, env });
    const saved = readFileSync(join(root, ".evol/qa/security/ultimo.json"), "utf8");
    const report = readFileSync(join(root, ".evol/qa/QA_REPORT.md"), "utf8");
    for (const text of [human.stdout, human.stderr, json.stdout, saved, report]) {
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain("hunter2");
    }
  });

  it("guarda el resultado y reescribe solo su sección de QA_REPORT.md, con una línea CRITICAL por hallazgo", () => {
    const root = project({
      ...FULL,
      ".evol/qa/QA_REPORT.md": "# QA de mi proyecto\n\nNotas a mano que se conservan.\n",
    });
    const env = tools({ EVOL_TOOL_GITLEAKS: stub("gitleaks", GITLEAKS_LEAK) });
    expect(cli(["security", "scan"], { cwd: root, env }).status).toBe(0);
    const first = readFileSync(join(root, ".evol/qa/QA_REPORT.md"), "utf8");
    expect(first).toContain("Notas a mano que se conservan.");
    expect(first).toMatch(/^- \[ \] CRITICAL: gitleaks aws-access-token en scripts\/run\.sh:2$/m);
    expect(existsSync(join(root, ".evol/qa/security/ultimo.json"))).toBe(true);

    // a second scan replaces the section, it does not pile up another one
    cli(["security", "scan"], { cwd: root, env });
    const second = readFileSync(join(root, ".evol/qa/QA_REPORT.md"), "utf8");
    expect(second.match(/evol:security-scan:inicio/g)).toHaveLength(1);
    expect(second.match(/CRITICAL: gitleaks/g)).toHaveLength(1);

    // once the leak is gone the line is gone, and the notes are still there
    cli(["security", "scan"], { cwd: root, env: tools({}) });
    const clean = readFileSync(join(root, ".evol/qa/QA_REPORT.md"), "utf8");
    expect(clean).not.toMatch(/\[ \] CRITICAL/);
    expect(clean).toContain("Sin hallazgos críticos abiertos.");
    expect(clean).toContain("Notas a mano que se conservan.");
  });

  it("solo los CRITICAL llevan la casilla que SecDD busca", () => {
    const root = project(FULL);
    cli(["security", "scan"], {
      cwd: root,
      env: tools({
        EVOL_TOOL_SEMGREP: stub("semgrep", SEMGREP_HIT),
        EVOL_TOOL_BANDIT: stub("bandit", BANDIT_HIT),
      }),
    });
    const report = readFileSync(join(root, ".evol/qa/QA_REPORT.md"), "utf8");
    expect(report.match(/^- \[ \] /gm)).toHaveLength(1); // only proj.taint-sql
    expect(report).toMatch(/^- HIGH: semgrep evol\.py-shell-true en src\/a\.py:2$/m);
  });

  describe("--ci", () => {
    it("sale con error si hay un CRITICAL o un HIGH sin ignorar, y sin --ci solo avisa", () => {
      const root = project(FULL);
      const env = tools({ EVOL_TOOL_SEMGREP: stub("semgrep", SEMGREP_HIT) });
      const ci = cli(["security", "scan", "--ci"], { cwd: root, env });
      expect(ci.status).toBe(1);
      expect(ci.stderr).toContain("CRITICAL");
      expect(ci.stderr).toContain("HIGH");
      const plain = cli(["security", "scan"], { cwd: root, env });
      expect(plain.status).toBe(0);
      expect(plain.stderr).toContain("con --ci esto fallaría");
    });

    it("pasa limpio cuando no hay hallazgos y corrieron las herramientas obligatorias", () => {
      const root = project({ "src/x.ts": "export {};\n" });
      expect(cli(["security", "scan", "--ci"], { cwd: root, env: tools({}) }).status).toBe(0);
    });

    it("pasa si solo quedan MEDIUM y LOW", () => {
      const root = project(FULL);
      const only = `case "$1" in --version) echo 1.99.0; exit 0;; esac
echo '{"results":[{"check_id":"evol.js-dynamic-require","path":"src/b.js","start":{"line":9},"extra":{"severity":"WARNING"}}],"errors":[]}'`;
      const env = tools({
        EVOL_TOOL_SEMGREP: stub("semgrep", only),
        EVOL_TOOL_BANDIT: stub("bandit", BANDIT_CLEAN),
        EVOL_TOOL_SHELLCHECK: stub("shellcheck", SHELLCHECK_CLEAN),
        EVOL_TOOL_OSV_SCANNER: stub("osv-scanner", OSV_CLEAN),
      });
      expect(cli(["security", "scan", "--ci"], { cwd: root, env }).status).toBe(0);
    });

    it("falla si falta una herramienta obligatoria: un escaneo que no corrió no es un visto bueno", () => {
      const root = project({ "src/x.ts": "export {};\n" });
      const r = cli(["security", "scan", "--ci"], {
        cwd: root,
        env: tools({ EVOL_TOOL_GITLEAKS: "" }),
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("falta gitleaks");
    });

    it("falla si bandit falta y hay Python, pero no si no hay Python", () => {
      const withPython = project({ "src/a.py": "print(1)\n" });
      expect(
        cli(["security", "scan", "--ci"], { cwd: withPython, env: tools({}) }).stderr,
      ).toContain("falta bandit");
      const without = project({ "src/x.ts": "export {};\n" });
      expect(cli(["security", "scan", "--ci"], { cwd: without, env: tools({}) }).status).toBe(0);
    });

    it("falla si osv-scanner no pudo consultar (sin red), en vez de dar por buenas las dependencias", () => {
      const root = project({ "package-lock.json": "{}" });
      const r = cli(["security", "scan", "--ci"], {
        cwd: root,
        env: tools({ EVOL_TOOL_OSV_SCANNER: stub("osv-scanner", OSV_OFFLINE) }),
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("osv-scanner no pudo completar el escaneo");
    });

    it("guarddog es opcional: si falta solo se avisa", () => {
      const root = project({ "package.json": '{"dependencies":{"a":"1.0.0"}}' });
      const r = scanJson(root, tools({}), "--ci");
      expect(r.status).toBe(0);
      const guarddog = (r.data.herramientas as { herramienta: string; estado: string }[]).find(
        (t) => t.herramienta === "guarddog",
      );
      expect(guarddog?.estado).toBe("falta");
    });
  });

  describe("--solo", () => {
    it("limita a un área y no toca el resto de QA_REPORT.md", () => {
      const root = project(FULL);
      const r = scanJson(
        root,
        tools({ EVOL_TOOL_SEMGREP: stub("semgrep", SEMGREP_HIT) }),
        "--solo",
        "secretos",
      );
      expect(r.data.areas).toEqual(["secretos"]);
      expect((r.data.herramientas as { herramienta: string }[]).map((t) => t.herramienta)).toEqual([
        "gitleaks",
      ]);
      expect(existsSync(join(root, ".evol/qa/QA_REPORT.md"))).toBe(false);
    });

    it("rechaza un área desconocida", () => {
      const r = cli(["security", "scan", "--solo", "magia"], { cwd: project(), env: tools({}) });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("Área desconocida");
    });
  });

  describe("archivo de ignorados", () => {
    const hit = (extra: object) =>
      JSON.stringify({
        ignorados: [
          {
            herramienta: "gitleaks",
            regla: "aws-access-token",
            archivo: "scripts/run.sh",
            motivo: "clave de ejemplo de la documentación de AWS",
            responsable: "ana",
            caduca: "2999-01-01",
            ...extra,
          },
        ],
      });
    const leak = () =>
      tools({
        EVOL_TOOL_GITLEAKS: stub("gitleaks", GITLEAKS_LEAK),
        EVOL_TOOL_BANDIT: stub("bandit", BANDIT_CLEAN),
        EVOL_TOOL_SHELLCHECK: stub("shellcheck", SHELLCHECK_CLEAN),
        EVOL_TOOL_OSV_SCANNER: stub("osv-scanner", OSV_CLEAN),
      });

    it("un ignorado completo y vigente oculta el hallazgo, pero queda registrado con su motivo", () => {
      const root = project({ ...FULL, ".evol/security-ignore.json": hit({}) });
      const r = scanJson(root, leak(), "--ci");
      expect(r.status).toBe(0);
      expect(r.data.abiertos).toEqual([]);
      expect(r.data.ignorados[0].ignorado).toMatchObject({
        responsable: "ana",
        caduca: "2999-01-01",
      });
    });

    it("rechaza un ignorado sin motivo, responsable o caducidad: el hallazgo sigue abierto", () => {
      for (const missing of ["motivo", "responsable", "caduca"]) {
        const root = project({ ...FULL, ".evol/security-ignore.json": hit({ [missing]: "" }) });
        const r = scanJson(root, leak(), "--ci");
        expect(r.status, missing).toBe(1);
        expect(r.data.abiertos).toHaveLength(1);
        expect(r.data.avisos.join(" ")).toContain(`falta ${missing}`);
      }
    });

    it("rechaza una fecha que no es AAAA-MM-DD", () => {
      const root = project({ ...FULL, ".evol/security-ignore.json": hit({ caduca: "mañana" }) });
      const r = scanJson(root, leak());
      expect(r.data.abiertos).toHaveLength(1);
      expect(r.data.avisos.join(" ")).toContain("AAAA-MM-DD");
    });

    it("al caducar, el hallazgo vuelve a aparecer", () => {
      const root = project({
        ...FULL,
        ".evol/security-ignore.json": hit({ caduca: "2020-01-01" }),
      });
      const r = scanJson(root, leak(), "--ci");
      expect(r.status).toBe(1);
      expect(r.data.abiertos).toHaveLength(1);
      expect(r.data.avisos.join(" ")).toContain("caducó el 2020-01-01");
    });

    it("con línea solo cubre esa línea", () => {
      const root = project({ ...FULL, ".evol/security-ignore.json": hit({ linea: 99 }) });
      expect(scanJson(root, leak()).data.abiertos).toHaveLength(1);
      const same = project({ ...FULL, ".evol/security-ignore.json": hit({ linea: 2 }) });
      expect(scanJson(same, leak()).data.abiertos).toHaveLength(0);
    });

    it("un archivo ilegible no ignora nada", () => {
      const root = project({ ...FULL, ".evol/security-ignore.json": "{no es json" });
      const r = scanJson(root, leak());
      expect(r.data.abiertos).toHaveLength(1);
      expect(r.data.avisos.join(" ")).toContain("no es un JSON válido");
    });
  });

  it("fuera de un proyecto evol da un error claro", () => {
    const r = cli(["security", "scan"], { cwd: tempDir(), env: tools({}) });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("No estás dentro de un proyecto evol");
  });

  it("ignora node_modules, dist y la carpeta .evol al decidir qué aplica", () => {
    const root = project({
      "node_modules/x/a.py": "print(1)\n",
      "dist/run.sh": "#!/bin/sh\n",
      ".evol/note.py": "print(1)\n",
    });
    // no Python or shell outside those folders, so bandit and shellcheck do not apply and do not block
    expect(cli(["security", "scan", "--ci"], { cwd: root, env: tools({}) }).status).toBe(0);
  });
});

describe("evol doctor y las herramientas de seguridad (criterio 93)", () => {
  const doctor = (env: Record<string, string>) =>
    cli(["doctor"], { cwd: project(), env: { ...env, EVOL_TOOL_GUARDDOG: "" } }).stdout;

  it("informa de cada una: si está, su versión y si es obligatoria", () => {
    const out = doctor(
      tools({
        EVOL_TOOL_GITLEAKS: stub("gitleaks", GITLEAKS_CLEAN),
        EVOL_TOOL_SEMGREP: stub("semgrep", SEMGREP_CLEAN),
        EVOL_TOOL_BANDIT: stub("bandit", BANDIT_CLEAN),
        EVOL_TOOL_SHELLCHECK: stub("shellcheck", SHELLCHECK_HIT),
        EVOL_TOOL_OSV_SCANNER: stub("osv-scanner", OSV_CLEAN),
      }),
    );
    expect(out).toMatch(
      /✓ Seguridad: gitleaks: 8\.99\.0 — secretos; obligatoria; sin ella toda skill/,
    );
    expect(out).toMatch(
      /✓ Seguridad: semgrep: 1\.99\.0 — código; obligatoria; sin ella toda skill/,
    );
    expect(out).toMatch(
      /✓ Seguridad: bandit: 1\.9\.4 — código Python; obligatoria si el proyecto lo necesita/,
    );
    expect(out).toContain("✓ Seguridad: shellcheck: 0.11.0 — scripts de shell");
    expect(out).toContain("✓ Seguridad: osv-scanner: 2.7.0 — dependencias (usa red)");
    expect(out).toMatch(
      /! Seguridad: guarddog: no instalada: .* — paquetes maliciosos \(usa red\); opcional/,
    );
  });

  it("solo avisa cuando falta una: doctor no falla por eso", () => {
    const r = cli(["doctor"], {
      cwd: project(),
      env: tools({ EVOL_TOOL_GITLEAKS: "", EVOL_TOOL_SEMGREP: "" }),
    });
    expect(r.stdout).toMatch(
      /! Seguridad: gitleaks: no instalada: .*obligatoria; sin ella toda skill/,
    );
    expect(r.stdout).toMatch(/! Seguridad: semgrep: no instalada/);
    expect(r.stdout).not.toMatch(/✗ Seguridad/);
  });
});

describe("SecDD y el escaneo (criterio 105)", () => {
  const secdd = loadDisciplines().get("SecDD") as Discipline;
  const verify = (root: string, env: Record<string, string>) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try {
      return verifyDiscipline(secdd, { moduleName: "app", moduleRoot: root, phase: "qa" });
    } finally {
      for (const key of Object.keys(env)) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    }
  };

  it("no toca ningún archivo: comprobar la fase no puede invalidar su propia aprobación", () => {
    const root = project({ ".evol/qa/QA_REPORT.md": "# QA\n\nSin cambios.\n" });
    const before = readFileSync(join(root, ".evol/qa/QA_REPORT.md"), "utf8");
    expect(verify(root, cleanSecurityTools())).toEqual([]);
    expect(readFileSync(join(root, ".evol/qa/QA_REPORT.md"), "utf8")).toBe(before);
    expect(existsSync(join(root, ".evol/qa/security"))).toBe(false);
  });

  it("bloquea por un CRITICAL sin ignorar o por una herramienta obligatoria que falta", () => {
    const root = project({ ".evol/qa/QA_REPORT.md": "# QA\n", "scripts/run.sh": "#!/bin/bash\n" });
    const leak = { ...cleanSecurityTools(), EVOL_TOOL_GITLEAKS: stub("gitleaks", GITLEAKS_LEAK) };
    expect(verify(root, leak).map((f) => f.mensaje)).toContain(
      "escaneo de seguridad: 1 hallazgo(s) CRITICAL sin ignorar",
    );
    const noSemgrep = { ...cleanSecurityTools(), EVOL_TOOL_SEMGREP: "" };
    expect(verify(root, noSemgrep).map((f) => f.mensaje)).toContain(
      "escaneo de seguridad: falta semgrep, que es obligatoria",
    );
  });
});

describe("reviewIgnores", () => {
  it("compara la caducidad por día: el último día todavía vale", () => {
    const root = project({
      ".evol/security-ignore.json": JSON.stringify({
        ignorados: [
          {
            herramienta: "semgrep",
            regla: "r",
            archivo: "a.py",
            motivo: "m",
            responsable: "r",
            caduca: "2026-10-23",
          },
        ],
      }),
    });
    expect(reviewIgnores(root, new Date("2026-10-23T23:59:00Z")).vigentes).toHaveLength(1);
    expect(reviewIgnores(root, new Date("2026-10-24T00:00:00Z")).vigentes).toHaveLength(0);
  });
});

describe("ruleId", () => {
  it("quita el prefijo de carpeta que semgrep antepone al id de la regla", () => {
    const dir = "/home/u/proj/evol/rules/semgrep";
    expect(ruleId("home.u.proj.evol.rules.semgrep.evol.py-shell-true", "/work", [dir])).toBe(
      "evol.py-shell-true",
    );
    expect(ruleId("evol.py-shell-true", "/work", [dir])).toBe("evol.py-shell-true");
    // a rule folder inside the project is named relative to it
    expect(ruleId(".evol.semgrep.mi-regla", "/work", ["/work/.evol/semgrep"])).toBe("mi-regla");
  });
});

describe.skipIf(REAL_GITLEAKS === null)("con el gitleaks real", () => {
  it("encuentra una clave AWS sembrada y no copia su valor", () => {
    const root = project({
      "scripts/run.sh": `#!/bin/bash\nexport AWS_ACCESS_KEY_ID="${SECRET}"\nexport AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"\n`,
      // the project's own ignores must not hide it
      ".gitleaksignore": "scripts/run.sh:aws-access-token:2\n",
      ".gitleaks.toml": "[allowlist]\npaths = ['''scripts/''']\n",
      "node_modules/dep/leak.js": `const k = "${SECRET}";\n`,
    });
    const r = scanJson(
      root,
      tools({ EVOL_TOOL_GITLEAKS: REAL_GITLEAKS ?? "" }),
      "--solo",
      "secretos",
    );
    const open = r.data.abiertos as { archivo: string; severidad: string }[];
    expect(open.some((f) => f.archivo === "scripts/run.sh" && f.severidad === "CRITICAL")).toBe(
      true,
    );
    expect(open.some((f) => f.archivo.startsWith("node_modules"))).toBe(false);
    expect(r.stdout).not.toContain(SECRET);
    expect(readFileSync(join(root, ".evol/qa/security/ultimo.json"), "utf8")).not.toContain(SECRET);
  });
});
