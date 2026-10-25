import { z } from "zod";
import { languageOf } from "./inventory.js";
import type { Entry, Language } from "./inventory.js";
import type { AuditFinding, Capacidades } from "./report.js";

/**
 * Static analysis of a skill. Nothing here runs anything: it reads text. It is a heuristic, not a
 * proof: a determined author can hide behaviour from it, which is why it is one layer among several
 * (see «Auditoría reforzada» in the specification).
 */

const text = (e: Entry): string => e.data.toString("utf8");
const find = (
  regla: string,
  nivel: AuditFinding["nivel"],
  texto: string,
  archivo?: string,
): AuditFinding => ({
  regla,
  nivel,
  texto,
  ...(archivo ? { archivo } : {}),
});

/* ---------- dangerous patterns ---------- */

interface Danger {
  regla: string;
  pattern: RegExp;
  texto: string;
  /** Level in a script; documents (Markdown, JSON...) get `docs` instead, or are skipped when null. */
  scripts: AuditFinding["nivel"];
  docs: AuditFinding["nivel"] | null;
}

const DANGERS: Danger[] = [
  {
    regla: "descarga-y-ejecuta",
    pattern:
      /\b(curl|wget)\b[^\n|;]*\|\s*(sudo\s+)?(ba|z|da)?sh\b|\b(ba)?sh\s+<\(\s*(curl|wget)|base64\s+(-d|--decode)[^\n]*\|\s*(ba)?sh/i,
    texto: "Descarga código de la red y lo ejecuta sin revisarlo (confirma de dónde viene).",
    scripts: "bloqueo",
    docs: "aviso",
  },
  {
    regla: "ejecucion-dinamica",
    pattern:
      /(^|[;&|(])\s*eval\s+["'$`(]|(?<![.\w])(exec|eval|compile)\s*\(\s*(base64|bytes|["'`]|[a-z_]+\()|\bnew\s+Function\s*\(|(?<![.\w])eval\s*\(/m,
    texto: "Ejecuta código construido en tiempo de ejecución (eval, exec o Function).",
    scripts: "bloqueo",
    docs: null,
  },
  {
    regla: "elevacion",
    pattern: /(^|[\s;&|(])(sudo|doas)\s|\bsu\s+-/,
    texto: "Pide privilegios de administrador.",
    scripts: "bloqueo",
    docs: "aviso",
  },
  {
    regla: "permisos-amplios",
    pattern: /\bchmod\s+(-R\s+)?(0?777|a\+rwx|[ugo]*\+s)\b/,
    texto: "Da permisos demasiado amplios.",
    scripts: "bloqueo",
    docs: "aviso",
  },
  {
    regla: "borrado",
    pattern: /\brm\s+-[A-Za-z]*[rf][A-Za-z]*\s+(\/(?!tmp\b)|~|\$HOME|\$\{HOME\}|\*)/,
    texto: "Borra de forma destructiva fuera de su carpeta.",
    scripts: "bloqueo",
    docs: "aviso",
  },
  {
    regla: "credenciales",
    pattern:
      /(~|\$HOME|\$\{HOME\}|\/home\/[^/\s]+)\/\.(ssh|aws|gnupg|kube|docker|npmrc|netrc|config\/(evol|gh))|\.gate-key|\/etc\/(shadow|sudoers)|\bid_(rsa|ed25519)\b|credentials\.json/,
    texto: "Lee archivos de credenciales o claves.",
    scripts: "bloqueo",
    docs: "aviso",
  },
  {
    regla: "credenciales",
    pattern: /(^|[\s"'=/])\.env(\s|["']|$)/m,
    texto: "Lee un archivo .env, que suele llevar secretos: confirma qué toma de él.",
    scripts: "aviso",
    docs: null,
  },
  {
    regla: "conexion-remota",
    pattern: /\/dev\/tcp\/|\bsocat\b|\bncat?\s+(-\w*\s+)*-\w*e|bash\s+-i\s+>&/,
    texto: "Abre una shell remota o una conexión directa de red.",
    scripts: "bloqueo",
    docs: null,
  },
  {
    regla: "fuga-de-variables",
    pattern:
      /\b(printenv|env)\b[^\n]*\|\s*(curl|nc|wget)|\b(curl|wget)\b[^\n]*(-d|--data[\w-]*)\s+@?-?\s*[<(]?\s*\(?(printenv|env)\b|json\s*=\s*dict\(os\.environ\)/i,
    texto: "Envía todas las variables de entorno a la red.",
    scripts: "bloqueo",
    docs: "aviso",
  },
  {
    regla: "secreto-a-la-red",
    pattern: /\b(curl|wget)\b[^\n]*\$\{?[A-Za-z_]*(KEY|TOKEN|SECRET|PASSWORD|PASS)\b/i,
    texto: "Manda una variable secreta a la red: confirma que el dominio es el de su servicio.",
    scripts: "aviso",
    docs: null,
  },
  {
    regla: "persistencia",
    pattern:
      /\bcrontab\b|\/etc\/cron|systemctl\s+(--user\s+)?enable|~\/\.(bashrc|zshrc|profile|bash_profile)|\bauthorized_keys\b|\blaunchctl\b/,
    texto: "Intenta quedarse instalado (tareas programadas, perfiles de shell, claves).",
    scripts: "bloqueo",
    docs: "aviso",
  },
  {
    regla: "instalacion",
    pattern:
      /\b(pip3?|pipx)\s+install\b|\buv\s+pip\s+install\b|\bnpm\s+(i|install|ci)\b|\b(yarn|pnpm)\s+(add|install)\b|\bgem\s+install\b/,
    texto:
      "Instala paquetes al ejecutarse, saltándose el archivo de bloqueo: confirma qué instala.",
    scripts: "aviso",
    docs: null,
  },
];

export function scanDangerous(entries: Entry[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  for (const e of entries) {
    if (e.data.includes(0)) continue;
    const body = text(e);
    const script = languageOf(e.ruta, body) !== null;
    for (const d of DANGERS) {
      const level = script ? d.scripts : d.docs;
      if (level !== null && d.pattern.test(body)) out.push(find(d.regla, level, d.texto, e.ruta));
    }
  }
  return out;
}

/* ---------- instruction injection ---------- */

const NEGATION = /\b(no|nunca|jamás|never|don'?t|do not|not)\b[^.\n]{0,40}$/i;

/** A skill that WARNS about prompt injection mentions the same phrases it forbids: that is not an attack. */
const DEFENSIVE =
  /injection|inyecci[oó]n|attack|ataque|malicious|malicios|untrusted|no\s+confiabl|treat\s+(it\s+|them\s+)?as\s+data|tr[aá]talo\s+como\s+datos|embedded\s+instructions|instrucciones\s+incrustadas|do\s+not\s+(follow|obey)|no\s+(sigas|obedezcas)/i;

export interface Injection {
  regla: string;
  pattern: RegExp;
  texto: string;
  nivel: AuditFinding["nivel"];
  /** For patterns a skill may legitimately mention while forbidding them: a nearby negation downgrades it. */
  negatable?: boolean;
}

export const INJECTIONS: Injection[] = [
  {
    regla: "inyeccion",
    pattern:
      /ignor(a|e|ar)\s+(todas?\s+)?(las\s+)?(instrucciones|reglas|indicaciones)\s+(anteriores|previas)|ignore\s+(all\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions|rules)|disregard\s+(all\s+)?(previous|prior|your)\s+(instructions|rules)|(olvida|forget)\s+(todas\s+)?(tus|your|las)\s+(instrucciones|reglas|instructions|rules)/i,
    texto: "Intenta que el agente ignore sus instrucciones o reglas previas.",
    nivel: "bloqueo",
    negatable: true,
  },
  {
    regla: "inyeccion",
    pattern:
      /no\s+(le\s+)?(digas|muestres|informes)\s+(nada\s+)?al\s+usuario(?!\s+que\b)|sin\s+que\s+(el\s+)?usuario\s+(lo\s+)?sepa|do\s+not\s+(tell|inform|show)\s+the\s+user(?!\s+to\b)|without\s+(telling|informing)\s+the\s+user|hide\s+(this|it)\s+from\s+the\s+user/i,
    texto: "Pide ocultarle algo a la persona.",
    nivel: "bloqueo",
    negatable: true,
  },
  {
    regla: "inyeccion",
    pattern:
      /(ejecuta|run|execute|lanza)[^\n.]{0,60}(sin\s+(pedir\s+)?(confirmaci[oó]n|permiso|aprobaci[oó]n)|without\s+(asking|confirmation|permission|approval))/i,
    texto: "Pide ejecutar algo sin pedir confirmación.",
    nivel: "bloqueo",
  },
  {
    regla: "inyeccion",
    pattern:
      /\b(desactiva|deshabilita|disable|turn\s+off|bypass|salta(te)?)\s+[^\n.]{0,40}(permisos|permissions|sandbox|safety|seguridad|hooks|guardrails|aprobaci[oó]n|approval)/i,
    texto: "Habla de desactivar los controles de seguridad del agente: confirma que no se lo pide.",
    nivel: "aviso",
    negatable: true,
  },
  {
    regla: "inyeccion",
    pattern: /--dangerously-[\w-]+|--yolo\b|--no-verify\b/i,
    texto:
      "Menciona una opción que desactiva los controles de seguridad de un agente o de Git: confirma que solo la documenta.",
    nivel: "aviso",
  },

  {
    regla: "aprobar",
    pattern: /\bevol\s+(approve|next)\b/i,
    texto:
      "Menciona evol approve o evol next: una skill no puede pedirle al agente que apruebe ni que avance de fase.",
    nivel: "bloqueo",
    negatable: true,
  },
  {
    regla: "filtracion",
    pattern:
      /(env[ií]a|sube|publica|send|upload|post|exfiltra)[^\n.]{0,80}(contenido|c[oó]digo|archivos|variables\s+de\s+entorno|credenciales|claves|tokens|memoria|contents|source|environment\s+variables|credentials|secrets|memory)[^\n.]{0,80}(https?:\/\/|servidor|server|endpoint|webhook)/i,
    texto: "Pide enviar contenido del proyecto, secretos o memoria a un servidor.",
    nivel: "bloqueo",
  },
  {
    regla: "inyeccion",
    pattern:
      /ahora\s+eres|you\s+are\s+now\b|act[uú]a\s+como\s+si\s+no\s+tuvieras|act\s+as\s+if\s+you\s+(have|had)\s+no/i,
    texto: "Intenta cambiar la identidad o las reglas del agente.",
    nivel: "aviso",
  },
  {
    regla: "inyeccion",
    pattern:
      /sin\s+(pedir\s+)?(confirmaci[oó]n|permiso)|without\s+(asking|confirmation|permission)/i,
    texto: "Habla de actuar sin confirmación.",
    nivel: "aviso",
    negatable: true,
  },
  {
    regla: "comentario-oculto",
    pattern:
      /<!--[\s\S]*?(ignore|ignora|instructions|instrucciones|system|sistema|assistant|asistente)[\s\S]*?-->/i,
    texto: "Un comentario oculto de HTML contiene lo que parecen instrucciones.",
    nivel: "aviso",
  },
];

export const INVISIBLE = new RegExp(
  "[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069]|[\\u{E0000}-\\u{E007F}]",
  "u",
);

export function scanInjection(entries: Entry[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  for (const e of entries) {
    if (e.data.includes(0)) continue;
    const body = text(e).replace(new RegExp("^\\uFEFF"), "");
    if (INVISIBLE.test(body)) {
      out.push(
        find(
          "inyeccion",
          "bloqueo",
          "Contiene caracteres invisibles o de control de dirección: pueden esconder instrucciones.",
          e.ruta,
        ),
      );
    }
    for (const i of INJECTIONS) {
      const match = i.pattern.exec(body);
      if (!match) continue;
      const before = body.slice(Math.max(0, match.index - 60), match.index);
      const around = body.slice(
        Math.max(0, match.index - 200),
        match.index + match[0].length + 200,
      );
      const negated = i.negatable === true && (NEGATION.test(before) || DEFENSIVE.test(around));
      const nivel = negated ? "aviso" : i.nivel;
      out.push(
        find(
          i.regla,
          nivel,
          negated
            ? `${i.texto} (aparece junto a una negación o a una advertencia: confirma que la prohíbe).`
            : i.texto,
          e.ruta,
        ),
      );
    }
  }
  return out;
}

/* ---------- dependencies ---------- */

const NODE_LOCKS = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
];
const PY_LOCKS = ["uv.lock", "poetry.lock", "Pipfile.lock", "pdm.lock"];
const INSTALL_HOOKS = ["preinstall", "install", "postinstall", "prepare", "prepublish"];
const EXACT = /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/;

export type Ecosystem = "node" | "python";

export function dependencyFindings(entries: Entry[]): {
  findings: AuditFinding[];
  ecosystems: Set<Ecosystem>;
} {
  const findings: AuditFinding[] = [];
  const ecosystems = new Set<Ecosystem>();
  const paths = new Set(entries.map((e) => e.ruta));
  const dirOf = (ruta: string): string =>
    ruta.includes("/") ? ruta.slice(0, ruta.lastIndexOf("/") + 1) : "";
  const block = (regla: string, texto: string, archivo: string): void =>
    void findings.push(find(regla, "bloqueo", texto, archivo));

  for (const e of entries) {
    const name = e.ruta.split("/").pop() ?? "";
    const dir = dirOf(e.ruta);
    if (name === "package.json") {
      let pkg: {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      try {
        pkg = JSON.parse(text(e)) as typeof pkg;
      } catch {
        block("dependencias", "package.json no es JSON válido.", e.ruta);
        continue;
      }
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.optionalDependencies,
        ...pkg.peerDependencies,
      };
      for (const hook of INSTALL_HOOKS) {
        if (pkg.scripts?.[hook])
          block(
            "dependencias",
            `Tiene un gancho de instalación («${hook}»): ejecuta código al instalar.`,
            e.ruta,
          );
      }
      if (Object.keys(deps).length > 0) {
        ecosystems.add("node");
        for (const [name2, version] of Object.entries(deps)) {
          if (!EXACT.test(version))
            block("dependencias", `«${name2}» no tiene una versión fija («${version}»).`, e.ruta);
        }
        if (!NODE_LOCKS.some((l) => paths.has(`${dir}${l}`)))
          block(
            "dependencias",
            "Tiene dependencias pero ningún archivo de bloqueo (package-lock.json, pnpm-lock.yaml o yarn.lock).",
            e.ruta,
          );
      }
    } else if (/^requirements[\w.-]*\.txt$/.test(name)) {
      ecosystems.add("python");
      for (const raw of text(e).split(/\r?\n/)) {
        const line = raw.replace(/\s+#.*$/, "").trim();
        if (line === "" || line.startsWith("#")) continue;
        if (/^(-e\b|--editable|--index-url|--extra-index-url|--find-links|-f\b|-i\b)/.test(line))
          block(
            "dependencias",
            `Usa una fuente de paquetes distinta o instala en modo editable («${line.slice(0, 40)}»).`,
            e.ruta,
          );
        else if (/^(git\+|https?:|file:)|@\s*(git|https?)/.test(line))
          block(
            "dependencias",
            `Instala desde una dirección, no desde el índice de paquetes («${line.slice(0, 40)}»).`,
            e.ruta,
          );
        else if (!/^[A-Za-z0-9._-]+(\[[^\]]+\])?==\S+/.test(line) && !line.startsWith("--hash"))
          block("dependencias", `«${line.slice(0, 40)}» no tiene una versión fija (==).`, e.ruta);
      }
    } else if (name === "pyproject.toml") {
      if (/^\s*dependencies\s*=|\[tool\.poetry\.dependencies\]/m.test(text(e))) {
        ecosystems.add("python");
        if (!PY_LOCKS.some((l) => paths.has(`${dir}${l}`)))
          block(
            "dependencias",
            "Tiene dependencias pero ningún archivo de bloqueo (uv.lock, poetry.lock...).",
            e.ruta,
          );
      }
    } else if (name === "setup.py" && /setuptools|distutils|\bsetup\s*\(/.test(text(e)))
      block("dependencias", "setup.py ejecuta código al instalar.", e.ruta);
    else if (name === "Pipfile" && !paths.has(`${dir}Pipfile.lock`))
      block("dependencias", "Pipfile sin Pipfile.lock.", e.ruta);
  }
  return { findings, ecosystems };
}

/* ---------- capabilities ---------- */

export const CapacidadesSchema = z.object({
  red: z.array(z.string()).default([]),
  escribe: z.array(z.string()).default([]),
  comandos: z.array(z.string()).default([]),
  entorno: z.array(z.string()).default([]),
});
export const DeclaracionSchema = z.object({
  version: z.literal(1),
  scripts: z.record(z.string(), CapacidadesSchema),
});
export type Declaracion = z.infer<typeof DeclaracionSchema>;
export const DECLARATION_FILE = "capacidades.json";

const SHELL_BUILTINS = new Set([
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "for",
  "while",
  "until",
  "do",
  "done",
  "case",
  "esac",
  "in",
  "function",
  "select",
  "time",
  "!",
  "[",
  "[[",
  "]]",
  "]",
  "echo",
  "printf",
  "cd",
  "pwd",
  "set",
  "unset",
  "export",
  "local",
  "readonly",
  "declare",
  "typeset",
  "return",
  "exit",
  "break",
  "continue",
  "shift",
  "read",
  "test",
  "true",
  "false",
  ":",
  ".",
  "source",
  "eval",
  "exec",
  "trap",
  "wait",
  "getopts",
  "let",
  "alias",
  "type",
  "hash",
  "umask",
  "pushd",
  "popd",
  "mapfile",
  "readarray",
  "command",
  "builtin",
  "nohup",
  "sudo",
  "doas",
  "env",
  "xargs",
]);
const SHELL_SPECIAL_VARS = new Set([
  "IFS",
  "RANDOM",
  "LINENO",
  "BASH_SOURCE",
  "BASH_REMATCH",
  "BASH_VERSION",
  "FUNCNAME",
  "PIPESTATUS",
  "SECONDS",
  "OPTIND",
  "OPTARG",
  "REPLY",
  "UID",
  "EUID",
  "PPID",
  "SHELL_BUILTINS",
]);
const NET_TOOLS = /(^|[\s;&|(])(curl|wget|nc|ncat|ssh|scp|sftp|rsync|ftp|telnet)\s/;

const empty = (): Capacidades => ({ red: [], escribe: [], comandos: [], entorno: [] });
const uniq = (list: string[]): string[] => [...new Set(list)].sort();

function hostsIn(body: string): string[] {
  return [...body.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)]
    .map((m) => (m[1] ?? "").toLowerCase())
    .filter((h) => h !== "" && !NAMESPACE_HOSTS.has(h));
}

/** XML and schema namespaces look like URLs but nothing connects to them. */
const NAMESPACE_HOSTS = new Set([
  "www.w3.org",
  "schemas.openxmlformats.org",
  "schemas.microsoft.com",
  "purl.org",
  "schemas.xmlsoap.org",
  "www.opengis.net",
  "xmlns.com",
]);

/**
 * Replaces every quoted string with a placeholder (`Q<n>Q`), so words inside text are not read as
 * commands, and keeps the `$(...)` groups that were inside double quotes, as commands of their own.
 */
function maskQuotes(line: string): { masked: string; quotes: string[] } {
  const quotes: string[] = [];
  const masked = line.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, (m) => {
    const index = quotes.push(m.slice(1, -1)) - 1;
    const inner = m.startsWith('"')
      ? [...m.matchAll(/\$\([^()]*\)/g)].map((x) => `;${x[0]};`).join("")
      : "";
    return `Q${index}Q${inner}`;
  });
  return { masked, quotes };
}

function stripShellComment(line: string): string {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? "";
    if (quote) {
      if (c === quote && line[i - 1] !== "\\") quote = "";
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(line[i - 1] ?? ""))) return line.slice(0, i);
  }
  return line;
}

const WRAPPERS = new Set([
  "sudo",
  "doas",
  "exec",
  "command",
  "builtin",
  "nohup",
  "time",
  "env",
  "xargs",
  "!",
]);
const ARITHMETIC = /^[\w]+[+\-*/%]\d+$|^\d/;

function inferShell(body: string): Capacidades {
  const cap = empty();
  const lines = body
    .replace(/\\\r?\n/g, " ")
    .split(/\r?\n/)
    .map(stripShellComment)
    .filter((l) => l.trim() !== "");
  const joined = lines.join("\n");
  cap.red.push(...hostsIn(joined));
  const defined = new Set(
    [...joined.matchAll(/^\s*(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\s*\)/gm)].map(
      (m) => m[1] ?? "",
    ),
  );
  const assigned = new Set(
    [
      ...joined.matchAll(
        /(?:^|[\s;&|(])(?:export\s+|local\s+|readonly\s+|declare\s+)?([A-Za-z_]\w*)=/g,
      ),
    ].map((m) => m[1] ?? ""),
  );
  for (const m of joined.matchAll(/(?:^|[\s;&|(])(?:for|read(?:\s+-\w+)*)\s+([A-Za-z_]\w*)/g))
    assigned.add(m[1] ?? "");
  for (const m of joined.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)/g)) {
    const name = m[1] ?? "";
    if (!assigned.has(name) && !SHELL_SPECIAL_VARS.has(name)) cap.entorno.push(name);
  }

  let networked = false;
  for (const line of lines) {
    const { masked, quotes } = maskQuotes(line);
    const unquote = (word: string): string =>
      word.replace(/Q(\d+)Q/g, (_m, n: string) => quotes[Number(n)] ?? "");
    if (NET_TOOLS.test(` ${masked}`) || /\bgit\s+(clone|fetch|pull|push|ls-remote)\b/.test(masked))
      networked = true;

    // redirections: «> file», «>> file», «&> file» (but not «2>&1»)
    for (const m of masked.matchAll(/(?:^|[^<>&0-9])(?:\d?>>?|&>>?)\s*([^\s&|;<>()]+)/g)) {
      const target = unquote(m[1] ?? "");
      if (target !== "") cap.escribe.push(target);
    }

    for (const raw of masked.split(/[|;&(){}`\n]+/)) {
      let words = raw
        .trim()
        .split(/\s+/)
        .filter((w) => w !== "");
      for (;;) {
        const w = words[0] ?? "";
        if (/^[A-Za-z_]\w*=/.test(w) || WRAPPERS.has(w)) words = words.slice(1);
        else break;
      }
      const first = words[0];
      if (
        !first ||
        SHELL_BUILTINS.has(first) ||
        defined.has(first) ||
        first.startsWith("-") ||
        first.startsWith(")") ||
        ARITHMETIC.test(first)
      )
        continue;
      if (first.startsWith("$")) cap.comandos.push("$dinámico");
      else if (/^[\w./-]+(\+\+)?$/.test(first)) cap.comandos.push(first);
      else continue;

      const args = words.slice(1).map(unquote);
      const operands = args.filter((a) => !a.startsWith("-"));
      const name = first.split("/").pop() ?? first;
      if (["cp", "mv", "install", "ln"].includes(name) && operands.length > 0)
        cap.escribe.push(operands[operands.length - 1] ?? "");
      else if (["touch", "mkdir", "rmdir", "truncate", "rm", "tee"].includes(name))
        cap.escribe.push(...operands);
      else if (name === "sed" && args.some((a) => /^-[A-Za-z]*i/.test(a)) && operands.length > 1)
        cap.escribe.push(operands[operands.length - 1] ?? "");
      else if (name === "dd") {
        for (const a of args) if (a.startsWith("of=")) cap.escribe.push(a.slice(3));
      } else if (name === "curl" || name === "wget") {
        for (let i = 0; i < args.length; i++) {
          const a = args[i] ?? "";
          if (/^(-o|-O|--output|--output-document)$/.test(a) && args[i + 1])
            cap.escribe.push(args[i + 1] ?? "");
          else if (a.startsWith("--output=") || a.startsWith("--output-document="))
            cap.escribe.push(a.slice(a.indexOf("=") + 1));
        }
      }
    }
  }
  if (networked && cap.red.length === 0) cap.red.push("*");
  cap.escribe = cap.escribe.filter(
    (t) => t !== "" && !t.startsWith("&") && !/^\/dev\/(null|stderr|stdout|tty)$/.test(t),
  );
  return cap;
}

function inferPython(body: string): Capacidades {
  const src = body
    .split(/\r?\n/)
    .map((l) => l.replace(/(^|\s)#.*$/, ""))
    .join("\n");
  const cap = empty();
  cap.red.push(...hostsIn(src));
  if (
    /\b(requests|urllib|http\.client|aiohttp|httpx|ftplib|smtplib|socket|websockets?)\b/.test(
      src,
    ) &&
    cap.red.length === 0
  )
    cap.red.push("*");
  for (const m of src.matchAll(
    /subprocess\.(?:run|Popen|call|check_output|check_call)\(\s*\[?\s*["']([^"']+)["']/g,
  ))
    cap.comandos.push((m[1] ?? "").split(/\s+/)[0] ?? "");
  for (const m of src.matchAll(/os\.system\(\s*["']([^"'\s]+)/g)) cap.comandos.push(m[1] ?? "");
  for (const m of src.matchAll(/os\.environ(?:\.get)?\s*[[(]\s*["']([A-Za-z_]\w*)["']/g))
    cap.entorno.push(m[1] ?? "");
  for (const m of src.matchAll(/os\.getenv\(\s*["']([A-Za-z_]\w*)["']/g))
    cap.entorno.push(m[1] ?? "");
  if (
    /os\.environ\s*[^.[\s]|os\.environ\.(items|copy|keys)|os\.environ\[\s*[^"'\s]/.test(src) &&
    !/os\.environ(?:\.get)?\s*[[(]\s*["']/.test(src)
  )
    cap.entorno.push("*");
  for (const m of src.matchAll(
    /open\(\s*(["'][^"']+["']|[A-Za-z_][\w.]*)\s*,\s*["'](?:w|a|x)[b+t]*["']/g,
  ))
    cap.escribe.push(literalOrDynamic(m[1] ?? ""));
  for (const m of src.matchAll(
    /(?:shutil\.(?:copy|copy2|copyfile|move|copytree)|os\.(?:rename|replace|remove|unlink|makedirs|mkdir|rmdir))\(\s*(?:[^,)]+,\s*)?(["'][^"']+["']|[A-Za-z_][\w.]*)/g,
  ))
    cap.escribe.push(literalOrDynamic(m[1] ?? ""));
  for (const m of src.matchAll(
    /(?:Path\(\s*(["'][^"']+["'])\s*\)|[A-Za-z_]\w*)\.(?:write_text|write_bytes|mkdir|unlink|rename|touch)\(/g,
  ))
    if (m[1]) cap.escribe.push(literalOrDynamic(m[1]));
  return cap;
}

function inferJs(body: string): Capacidades {
  const src = body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/(^|\s)\/\/.*$/, ""))
    .join("\n");
  const cap = empty();
  cap.red.push(...hostsIn(src));
  if (
    /\bfetch\s*\(|\bhttps?\.(request|get)\b|XMLHttpRequest|WebSocket|\baxios\b|\bgot\s*\(|node:(http|https|net|dgram)/.test(
      src,
    ) &&
    cap.red.length === 0
  )
    cap.red.push("*");
  for (const m of src.matchAll(
    /\b(?:exec|execSync|spawn|spawnSync|execFile|execFileSync)\(\s*["'`]([^"'`]+)["'`]/g,
  ))
    cap.comandos.push((m[1] ?? "").split(/\s+/)[0] ?? "");
  for (const m of src.matchAll(/process\.env\.([A-Za-z_]\w*)/g)) cap.entorno.push(m[1] ?? "");
  for (const m of src.matchAll(/process\.env\[\s*["']([A-Za-z_]\w*)["']\s*\]/g))
    cap.entorno.push(m[1] ?? "");
  if (
    /process\.env\[\s*[^"'\s]|\.\.\.process\.env|Object\.(keys|entries|assign)\(\s*process\.env/.test(
      src,
    )
  )
    cap.entorno.push("*");
  for (const m of src.matchAll(
    /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync)\(\s*(["'`][^"'`]+["'`]|[A-Za-z_][\w.]*)/g,
  ))
    cap.escribe.push(literalOrDynamic(m[1] ?? ""));
  return cap;
}

function literalOrDynamic(arg: string): string {
  return /^["'`]/.test(arg) ? arg.slice(1, -1) : `$dinámico(${arg})`;
}

export function inferCapabilities(ruta: string, body: string): Capacidades | null {
  const language: Language | null = languageOf(ruta, body);
  if (language === null) return null;
  const cap =
    language === "shell"
      ? inferShell(body)
      : language === "python"
        ? inferPython(body)
        : inferJs(body);
  return {
    red: uniq(cap.red),
    escribe: uniq(cap.escribe),
    comandos: uniq(cap.comandos.filter((c) => c !== "")),
    entorno: uniq(cap.entorno),
  };
}

function hostAllowed(host: string, declared: string[]): boolean {
  return declared.some(
    (d) => d === "*" || d === host || (d.startsWith("*.") && host.endsWith(d.slice(1))),
  );
}

/** What a script does beyond what its declaration says, by category. */
export function exceeds(inferred: Capacidades, declared: Capacidades): Capacidades {
  const writes = (t: string): boolean =>
    declared.escribe.includes("*") ||
    declared.escribe.some(
      (p) => t === p || t.startsWith(p.endsWith("/") ? p : `${p}/`) || t.startsWith(p),
    );
  return {
    red: inferred.red.filter((h) => !hostAllowed(h, declared.red)),
    escribe: inferred.escribe.filter((t) => !writes(t)),
    comandos: inferred.comandos.filter(
      (c) => !declared.comandos.includes(c) && !declared.comandos.includes("*"),
    ),
    entorno: inferred.entorno.filter(
      (v) => !declared.entorno.includes(v) && !declared.entorno.includes("*"),
    ),
  };
}

export const isEmptyCap = (c: Capacidades): boolean =>
  c.red.length + c.escribe.length + c.comandos.length + c.entorno.length === 0;
