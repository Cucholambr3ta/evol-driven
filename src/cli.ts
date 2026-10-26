#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { UserError } from "./core/errors.js";
import { packageVersion } from "./core/paths.js";

interface CommandModule {
  default: (argv: string[]) => Promise<number>;
  /** The command's usage text, when it has one: what `evol <comando> --help` prints. */
  USAGE?: string;
}

interface CommandSpec {
  summary: string;
  load: () => Promise<CommandModule>;
}

const COMMANDS: Record<string, CommandSpec> = {
  new: {
    summary: "Crea un proyecto TypeScript con pipeline y memoria",
    load: async () => await import("./commands/new.js"),
  },
  init: {
    summary: "Adopta un proyecto que ya existe (sin tocar sus archivos)",
    load: async () => await import("./commands/init.js"),
  },
  status: {
    summary: "Fase actual, disciplinas activas y artefactos pendientes",
    load: async () => await import("./commands/status.js"),
  },
  next: {
    summary: "Avanza de fase si está verificada y aprobada",
    load: async () => await import("./commands/next.js"),
  },
  prerequisites: {
    summary: "Lo que falta de la fase anterior antes de trabajar en una fase (--fase, --json)",
    load: async () => await import("./commands/prerequisites.js"),
  },
  verify: {
    summary: "Veredicto PASS, WARN o BLOCK de la fase actual (--inicio, --json); no cambia nada",
    load: async () => await import("./commands/verify.js"),
  },
  interrogate: {
    summary:
      "Anota que el plan se interrogó, contra su contenido actual (documento con «Interrogado»)",
    load: async () => await import("./commands/interrogate.js"),
  },
  approve: {
    summary: "Registra la aprobación humana de una fase",
    load: async () => await import("./commands/approve.js"),
  },
  memory: {
    summary: "Guarda y consulta memoria en MemPalace (add | search)",
    load: async () => await import("./commands/memory.js"),
  },
  index: {
    summary: "Construye o actualiza el grafo de código",
    load: async () => ({ default: (await import("./commands/codeintel.js")).runIndex }),
  },
  impact: {
    summary: "Qué depende de un símbolo, directa y transitivamente",
    load: async () => ({ default: (await import("./commands/codeintel.js")).runImpact }),
  },
  trace: {
    summary: "Cadena de llamadas desde un símbolo",
    load: async () => ({ default: (await import("./commands/codeintel.js")).runTrace }),
  },
  report: {
    summary: "Informe del proyecto en DOCX y PDF (o Markdown) con los 14 diagramas UML",
    load: async () => await import("./commands/report.js"),
  },
  diagrams: {
    summary: "Genera los diagramas UML del proyecto como SVG (--png con VectorCraft)",
    load: async () => await import("./commands/diagrams.js"),
  },
  lessons: {
    summary: "Busca en otros proyectos las lecciones que ya registraste (check)",
    load: async () => await import("./commands/lessons.js"),
  },
  coverage: {
    summary: "Matriz criterio CA-n → escenario → prueba, con los huecos",
    load: async () => ({ default: (await import("./commands/analysis.js")).runCoverage }),
  },
  risk: {
    summary: "Archivos ordenados por riesgo (alcance × falta de pruebas)",
    load: async () => ({ default: (await import("./commands/analysis.js")).runRisk }),
  },
  export: {
    summary: "Conjunto de datos del proyecto con esquema versionado (--json)",
    load: async () => ({ default: (await import("./commands/analysis.js")).runExport }),
  },
  disciplines: {
    summary:
      "Lista, sugiere, activa y desactiva disciplinas (list | profiles | suggest | enable | disable)",
    load: async () => await import("./commands/disciplines.js"),
  },
  skills: {
    summary:
      "Biblioteca de skills: lista, revisa, exporta, audita y aprueba (list | check | export | audit | approve)",
    load: async () => await import("./commands/skills.js"),
  },
  security: {
    summary: "Escaneo de seguridad: secretos, código y dependencias (scan [--solo] [--ci])",
    load: async () => await import("./commands/security.js"),
  },
  knowledge: {
    summary:
      "Fuentes de documentación con origen, fecha y licencia, y su revisión (source | review)",
    load: async () => await import("./commands/knowledge.js"),
  },
  agents: {
    summary: "Crea o refresca la integración con Claude Code y MCP",
    load: async () => await import("./commands/agents.js"),
  },
  checkpoint: {
    summary:
      "Guarda el estado del trabajo (fase, git, notas) para que otro agente o sesión lo retome (--nota, --verificar)",
    load: async () => await import("./commands/checkpoint.js"),
  },
  handoff: {
    summary: "Traspaso entre agentes: checkpoint con el resultado de la verificación",
    load: async () => await import("./commands/handoff.js"),
  },
  hook: {
    summary: "Salida para los hooks de Claude Code (session-start)",
    load: async () => await import("./commands/hook.js"),
  },
  mcp: {
    summary: "Servidor MCP de solo lectura (estado, verificación, código, memoria)",
    load: async () => await import("./commands/mcp.js"),
  },
  mejora: {
    summary:
      "Buzón de mejoras del framework: anota desde cualquier proyecto, no cambia nada (add | list | hecha | descartar)",
    load: async () => await import("./commands/mejora.js"),
  },
  docs: {
    summary:
      "Comprueba la documentación del proyecto: dominios, requisitos y dossiers, con su trazabilidad (check | evidencia)",
    load: async () => await import("./commands/docs.js"),
  },
  ciclo: {
    summary: "Abre un segundo ciclo del pipeline tras terminar el primero (nuevo)",
    load: async () => await import("./commands/ciclo.js"),
  },
  update: {
    summary: "Instala una versión firmada del framework desde GitHub (--comprobar, --volver)",
    load: async () => await import("./commands/update.js"),
  },
  release: {
    summary:
      "Publica una versión del framework: changelog, CI, commit y etiqueta firmada (no sube nada)",
    load: async () => await import("./commands/release.js"),
  },
  version: {
    summary: "Qué evol es: versión, canal (origen o estable), commit e integridad (--json)",
    load: async () => await import("./commands/version.js"),
  },
  setup: {
    summary: "Instala lo que falta (pregunta antes de cada cosa) y prepara tu biblioteca de skills",
    load: async () => await import("./commands/setup.js"),
  },
  doctor: {
    summary: "Comprueba Node, Git, MemPalace y el proyecto",
    load: async () => await import("./commands/doctor.js"),
  },
};

function help(): string {
  const width = Math.max(...Object.keys(COMMANDS).map((n) => n.length));
  const lines = Object.entries(COMMANDS).map(
    ([name, spec]) => `  ${name.padEnd(width)}  ${spec.summary}`,
  );
  return [
    "evol — framework de desarrollo con pipeline de disciplinas y memoria persistente",
    "",
    "Uso: evol <comando> [opciones]",
    "",
    ...lines,
    "",
    "  --version  Muestra la versión",
    "  --help     Muestra esta ayuda",
  ].join("\n");
}

const KNOWN_ERRORS = new Set([
  "UserError",
  "NotInteractiveError",
  "MemoryUnavailableError",
  "SymbolNotFoundError",
  "AmbiguousSymbolError",
  "ProviderUnavailableError",
]);

async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === "--help" || name === "-h" || name === "help") {
    process.stdout.write(`${help()}\n`);
    return name ? 0 : 1;
  }
  if (name === "--version" || name === "-v") {
    process.stdout.write(`${packageVersion()}\n`);
    return 0;
  }
  const spec = COMMANDS[name];
  if (!spec) {
    process.stderr.write(`Comando desconocido: ${name}\n\n${help()}\n`);
    return 2;
  }
  const command = await spec.load();
  // only what comes before «--» is an option: after it a question may be literally «--help»
  const options = rest.slice(0, rest.includes("--") ? rest.indexOf("--") : rest.length);
  if (options.includes("--help") || options.includes("-h")) {
    process.stdout.write(
      `evol ${name} — ${spec.summary}\n${command.USAGE ? `\n${command.USAGE}\n` : ""}`,
    );
    return 0;
  }
  try {
    return await command.default(rest);
  } catch (error) {
    // node's option parser throws its own errors: say what was wrong and where to look, not a stack
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS")) {
      const message = (error as Error).message;
      const option = /'(--?[\w-]+)/.exec(message)?.[1];
      const reason =
        code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" && option
          ? `Opción desconocida «${option}»`
          : code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE" && option
            ? `Falta el valor de «${option}» o no es válido`
            : "Opciones o argumentos no válidos";
      throw new UserError(`${reason}.\nMira las opciones con: evol ${name} --help`);
    }
    throw error;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    const err = error as Error;
    if (err instanceof UserError || KNOWN_ERRORS.has(err.name)) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`Error inesperado: ${err.stack ?? err.message}\n`);
    process.exit(2);
  },
);
