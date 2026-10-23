#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { UserError } from "./core/errors.js";
import { packageVersion } from "./core/paths.js";

interface CommandSpec {
  summary: string;
  load: () => Promise<(argv: string[]) => Promise<number>>;
}

const COMMANDS: Record<string, CommandSpec> = {
  new: {
    summary: "Crea un proyecto TypeScript con pipeline y memoria",
    load: async () => (await import("./commands/new.js")).default,
  },
  init: {
    summary: "Adopta un proyecto que ya existe (sin tocar sus archivos)",
    load: async () => (await import("./commands/init.js")).default,
  },
  status: {
    summary: "Fase actual, disciplinas activas y artefactos pendientes",
    load: async () => (await import("./commands/status.js")).default,
  },
  next: {
    summary: "Avanza de fase si está verificada y aprobada",
    load: async () => (await import("./commands/next.js")).default,
  },
  approve: {
    summary: "Registra la aprobación humana de una fase",
    load: async () => (await import("./commands/approve.js")).default,
  },
  memory: {
    summary: "Guarda y consulta memoria en MemPalace (add | search)",
    load: async () => (await import("./commands/memory.js")).default,
  },
  index: {
    summary: "Construye o actualiza el grafo de código",
    load: async () => (await import("./commands/codeintel.js")).runIndex,
  },
  impact: {
    summary: "Qué depende de un símbolo, directa y transitivamente",
    load: async () => (await import("./commands/codeintel.js")).runImpact,
  },
  trace: {
    summary: "Cadena de llamadas desde un símbolo",
    load: async () => (await import("./commands/codeintel.js")).runTrace,
  },
  report: {
    summary: "Informe del proyecto en DOCX y PDF (o Markdown) con los 14 diagramas UML",
    load: async () => (await import("./commands/report.js")).default,
  },
  diagrams: {
    summary: "Genera los diagramas UML del proyecto como SVG (--png con VectorCraft)",
    load: async () => (await import("./commands/diagrams.js")).default,
  },
  lessons: {
    summary: "Busca en otros proyectos las lecciones que ya registraste (check)",
    load: async () => (await import("./commands/lessons.js")).default,
  },
  coverage: {
    summary: "Matriz criterio CA-n → escenario → prueba, con los huecos",
    load: async () => (await import("./commands/analysis.js")).runCoverage,
  },
  risk: {
    summary: "Archivos ordenados por riesgo (alcance × falta de pruebas)",
    load: async () => (await import("./commands/analysis.js")).runRisk,
  },
  export: {
    summary: "Conjunto de datos del proyecto con esquema versionado (--json)",
    load: async () => (await import("./commands/analysis.js")).runExport,
  },
  disciplines: {
    summary:
      "Lista, sugiere, activa y desactiva disciplinas (list | profiles | suggest | enable | disable)",
    load: async () => (await import("./commands/disciplines.js")).default,
  },
  skills: {
    summary:
      "Biblioteca de skills: lista, revisa, exporta y audita (list | check | export | audit)",
    load: async () => (await import("./commands/skills.js")).default,
  },
  security: {
    summary: "Escaneo de seguridad: secretos, código y dependencias (scan [--solo] [--ci])",
    load: async () => (await import("./commands/security.js")).default,
  },
  agents: {
    summary: "Crea o refresca la integración con Claude Code y MCP",
    load: async () => (await import("./commands/agents.js")).default,
  },
  hook: {
    summary: "Salida para los hooks de Claude Code (session-start)",
    load: async () => (await import("./commands/hook.js")).default,
  },
  mcp: {
    summary: "Servidor MCP de solo lectura (estado, verificación, código, memoria)",
    load: async () => (await import("./commands/mcp.js")).default,
  },
  doctor: {
    summary: "Comprueba Node, Git, MemPalace y el proyecto",
    load: async () => (await import("./commands/doctor.js")).default,
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
  return (await spec.load())(rest);
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
