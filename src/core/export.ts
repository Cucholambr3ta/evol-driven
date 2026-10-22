import { z } from "zod";
import { coverageReport } from "./coverage.js";
import { readKey, readLog, verifyChain } from "./gate.js";
import { packageVersion } from "./paths.js";
import type { PipelineContext } from "./pipeline.js";
import { riskReport } from "./risk.js";
import { statusReport } from "./status.js";

export const EXPORT_SCHEMA = "evol-export/1";

const CriterionSchema = z.object({
  id: z.string(),
  modulo: z.string(),
  texto: z.string(),
  escenarios: z.array(z.object({ archivo: z.string(), nombre: z.string() })),
  pruebas: z.array(z.object({ archivo: z.string(), nombre: z.string() })),
});

export const ExportSchema = z.object({
  schema: z.literal(EXPORT_SCHEMA),
  evol: z.object({ version: z.string() }),
  proyecto: z.object({ nombre: z.string(), codeIntel: z.enum(["native", "gitnexus"]) }),
  pipeline: z.object({
    fase: z.string(),
    completadas: z.array(z.object({ fase: z.string(), en: z.string(), adoptada: z.boolean() })),
    aprobacion: z.object({ estado: z.string(), detalle: z.string().nullable() }),
    disciplinas: z.array(
      z.object({
        modulo: z.string(),
        id: z.string(),
        nombre: z.string(),
        artefactos: z.array(
          z.object({
            patron: z.string(),
            encontrados: z.number(),
            min: z.number(),
            pendientes: z.number(),
          }),
        ),
      }),
    ),
  }),
  modulos: z.array(
    z.object({ nombre: z.string(), raiz: z.string(), disciplinas: z.array(z.string()) }),
  ),
  aprobaciones: z.object({
    /** null when the gate key is not on this machine, so the chain cannot be checked. */
    integra: z.boolean().nullable(),
    entradas: z.array(
      z.object({
        seq: z.number(),
        fase: z.string(),
        aprobador: z.string(),
        en: z.string(),
        artefactos: z.number(),
        huella: z.string(),
      }),
    ),
  }),
  cobertura: z.object({
    criterios: z.array(CriterionSchema),
    sinEscenario: z.array(z.string()),
    sinPrueba: z.array(z.string()),
    huerfanos: z.array(z.string()),
  }),
  riesgo: z.object({
    disponible: z.boolean(),
    motivo: z.string().nullable(),
    archivos: z.array(
      z.object({
        archivo: z.string(),
        alcance: z.number(),
        unidades: z.number(),
        cubiertas: z.number(),
        riesgo: z.number(),
      }),
    ),
  }),
});

export type ExportData = z.infer<typeof ExportSchema>;

/**
 * One versioned data set for reports and UIs. It carries counts, hashes and titles only: never the
 * gate key, signatures, nonces or the content of memories. Deterministic for a given project state.
 */
export function buildExport(ctx: PipelineContext): ExportData {
  const status = statusReport(ctx);
  const log = readLog(ctx.root);
  const key = readKey(ctx.state.projectId);

  let risk: ExportData["riesgo"];
  try {
    risk = { disponible: true, motivo: null, archivos: riskReport(ctx.root, ctx.config) };
  } catch (error) {
    risk = { disponible: false, motivo: (error as Error).message, archivos: [] };
  }

  return {
    schema: EXPORT_SCHEMA,
    evol: { version: packageVersion() },
    proyecto: { nombre: ctx.config.name, codeIntel: ctx.config.codeIntel },
    pipeline: {
      fase: status.phase,
      completadas: ctx.state.completed.map((c) => ({
        fase: c.phase,
        en: c.at,
        adoptada: c.adopted === true,
      })),
      aprobacion: { estado: status.approval.state, detalle: status.approval.detail ?? null },
      disciplinas: status.disciplines.map(({ module, ...rest }) => ({ modulo: module, ...rest })),
    },
    modulos: ctx.config.modules.map((m) => ({
      nombre: m.name,
      raiz: m.root,
      disciplinas: m.disciplinas,
    })),
    aprobaciones: {
      integra: key ? verifyChain(log, key).ok : null,
      entradas: log.map((e) => ({
        seq: e.seq,
        fase: e.phase,
        aprobador: e.approver,
        en: e.timestamp,
        artefactos: Object.keys(e.artifacts).length,
        huella: e.payload_hash,
      })),
    },
    cobertura: coverageReport(ctx),
    riesgo: risk,
  };
}
