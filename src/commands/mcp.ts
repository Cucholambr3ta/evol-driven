import { parseArgs } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createProvider, ProviderUnavailableError } from "../codeintel/index.js";
import { indexProject } from "../codeintel/native/indexer.js";
import { UserError } from "../core/errors.js";
import { findProjectRoot, packageVersion } from "../core/paths.js";
import { loadContext, verifyPhase } from "../core/pipeline.js";
import type { PipelineContext } from "../core/pipeline.js";
import { statusReport } from "../core/status.js";
import type { StatusReport } from "../core/status.js";
import { appendLesson, remember } from "../memory/events.js";
import type { MemoryKind } from "../memory/events.js";
import { withMemPalace } from "../memory/mempalace.js";

/** The names of the tools this server offers. None of them approves, advances or initializes. */
export const TOOL_NAMES = [
  "evol_status",
  "evol_verify",
  "evol_find_symbol",
  "evol_impact",
  "evol_trace",
  "evol_index",
  "evol_memory_search",
  "evol_memory_add",
] as const;

type Reply = { content: { type: "text"; text: string }[]; isError?: boolean };

const json = (value: unknown): Reply => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

/** The agent-facing shape of the status: same Spanish keys as the other tools. */
export function statusForAgents(report: StatusReport): Record<string, unknown> {
  return {
    proyecto: report.project,
    fase: report.phase,
    completadas: report.completed,
    adoptadas: report.adopted,
    disciplinas: report.disciplines.map((d) => ({
      modulo: d.module,
      id: d.id,
      nombre: d.nombre,
      artefactos: d.artefactos,
    })),
    aprobacion: { estado: report.approval.state, detalle: report.approval.detail ?? null },
  };
}

export function createServer(projectArg?: string): McpServer {
  const server = new McpServer({ name: "evol", version: packageVersion() });

  function context(): { root: string; ctx: PipelineContext } {
    const start = projectArg ?? process.env["EVOL_PROJECT"] ?? process.cwd();
    const root = findProjectRoot(start);
    if (!root) {
      throw new UserError(`No hay un proyecto evol en ${start} (ni en sus carpetas superiores).`);
    }
    return { root, ctx: loadContext(root) };
  }

  /** Every tool answers with text; failures are reported as isError instead of crashing the server. */
  function guard<A>(fn: (args: A) => Promise<Reply> | Reply): (args: A) => Promise<Reply> {
    return async (args) => {
      try {
        return await fn(args);
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: (error as Error).message }] };
      }
    };
  }

  server.registerTool(
    "evol_status",
    {
      description:
        "Estado del pipeline: fase actual, disciplinas activas por módulo, artefactos encontrados o pendientes y estado de la aprobación. No ejecuta nada.",
      inputSchema: {},
    },
    guard(() => json(statusForAgents(statusReport(context().ctx)))),
  );

  server.registerTool(
    "evol_verify",
    {
      description:
        "Ejecuta las verificaciones de la fase actual (incluye los comandos de prueba) y lista los problemas. No cambia el estado: aprobar y avanzar lo hace una persona.",
      inputSchema: {},
    },
    guard(async () => {
      const { ctx } = context();
      const phase = ctx.state.currentPhase;
      if (phase === "done") return json({ fase: phase, listo: true, problemas: [] });
      const problems = await verifyPhase(ctx, phase);
      return json({
        fase: phase,
        listo: problems.length === 0,
        problemas: problems,
        aprobacion: statusForAgents(statusReport(ctx))["aprobacion"],
        nota: "Si no hay problemas, la persona debe ejecutar `evol approve` y luego `evol next`.",
      });
    }),
  );

  const symbolArgs = {
    simbolo: z.string().min(1).describe("Nombre, Clase.método, archivo o id completo"),
  };
  const depthArgs = { ...symbolArgs, profundidad: z.number().int().min(1).max(50).optional() };

  async function provider() {
    const { root, ctx } = context();
    const p = createProvider(ctx.config, root);
    const availability = await p.available();
    if (!availability.ok) throw new ProviderUnavailableError(p.name, availability.detail);
    return p;
  }

  server.registerTool(
    "evol_find_symbol",
    { description: "Busca símbolos del código por nombre.", inputSchema: symbolArgs },
    guard(async ({ simbolo }: { simbolo: string }) =>
      json(await (await provider()).findSymbol(simbolo)),
    ),
  );

  server.registerTool(
    "evol_impact",
    {
      description:
        "Qué depende de un símbolo, directa y transitivamente (llamadas, herencia y tests). Úsalo antes de modificarlo.",
      inputSchema: depthArgs,
    },
    guard(async ({ simbolo, profundidad }: { simbolo: string; profundidad?: number | undefined }) =>
      json(await (await provider()).impact(simbolo, profundidad ? { maxDepth: profundidad } : {})),
    ),
  );

  server.registerTool(
    "evol_trace",
    { description: "Cadena de llamadas hacia adelante desde un símbolo.", inputSchema: depthArgs },
    guard(async ({ simbolo, profundidad }: { simbolo: string; profundidad?: number | undefined }) =>
      json(await (await provider()).trace(simbolo, profundidad ? { maxDepth: profundidad } : {})),
    ),
  );

  server.registerTool(
    "evol_index",
    {
      description: "Construye o actualiza el grafo de código (incremental).",
      inputSchema: { completo: z.boolean().optional().describe("Reprocesar todos los archivos") },
    },
    guard(({ completo }: { completo?: boolean | undefined }) =>
      json(indexProject(context().root, { full: completo === true })),
    ),
  );

  server.registerTool(
    "evol_memory_search",
    {
      description: "Busca en la memoria del proyecto (MemPalace, wing del proyecto).",
      inputSchema: {
        consulta: z.string().min(1),
        limite: z.number().int().min(1).max(20).optional(),
        sala: z.string().optional(),
      },
    },
    guard(
      async ({
        consulta,
        limite,
        sala,
      }: {
        consulta: string;
        limite?: number | undefined;
        sala?: string | undefined;
      }) => {
        const { ctx } = context();
        return json(
          await withMemPalace((m) =>
            m.search({
              query: consulta,
              wing: ctx.config.memory.wing,
              limit: limite ?? 5,
              ...(sala ? { room: sala } : {}),
            }),
          ),
        );
      },
    ),
  );

  server.registerTool(
    "evol_memory_add",
    {
      description:
        "Guarda una decisión, lección o contexto en la memoria del proyecto. Las lecciones también se escriben en lecciones.md. No guardes secretos.",
      inputSchema: {
        tipo: z.enum(["decision", "leccion", "contexto"]),
        texto: z.string().min(1),
        titulo: z.string().optional(),
      },
    },
    guard(
      async ({
        tipo,
        texto,
        titulo,
      }: {
        tipo: Exclude<MemoryKind, "aprobacion" | "pipeline">;
        texto: string;
        titulo?: string | undefined;
      }) => {
        const { root, ctx } = context();
        if (tipo === "leccion") appendLesson(root, titulo?.trim() || texto.slice(0, 60), texto);
        const id = await remember(ctx.config, tipo, titulo ? `${titulo}\n\n${texto}` : texto);
        return json({ guardado: true, id, tipo });
      },
    ),
  );

  return server;
}

export default async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { project: { type: "string" } } });
  const server = createServer(values.project);
  await server.connect(new StdioServerTransport());
  // The transport keeps the process alive until the client disconnects.
  await new Promise<void>((resolve) => {
    process.stdin.on("close", resolve);
    process.stdin.on("end", resolve);
  });
  return 0;
}
