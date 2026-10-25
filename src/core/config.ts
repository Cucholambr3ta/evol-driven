import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { z } from "zod";
import type { DisciplineRegistry } from "./disciplines.js";
import { validateModuleOverrides } from "./disciplines.js";
import { CONFIG_FILE } from "./paths.js";
import { UserError } from "./errors.js";

const ModuleSchema = z.object({
  name: z.string().min(1),
  root: z.string().default("."),
  disciplinas: z.array(z.string().min(1)),
  /** Moves an artifact: default path/pattern -> the path this project really uses (inside the module). */
  rutas: z.record(z.string(), z.string().min(1)).optional(),
  /** Replaces the command a discipline runs: discipline id -> command. */
  comandos: z.record(z.string(), z.string().min(1)).optional(),
});

export const ConfigSchema = z.object({
  name: z.string().min(1),
  version: z.literal(1),
  codeIntel: z.enum(["native", "gitnexus"]).default("native"),
  memory: z.object({
    wing: z.string().min(1),
    enabled: z.boolean().default(true),
  }),
  qa: z
    .object({
      requireTestsForChangedSymbols: z.boolean().default(false),
      /** Every CA-n criterion needs a scenario and a test that names it. */
      requireCriteriaCoverage: z.boolean().default(false),
    })
    .default({ requireTestsForChangedSymbols: false, requireCriteriaCoverage: false }),
  modules: z.array(ModuleSchema).min(1),
  /**
   * The reference documentation the agents of this project may query (`evol knowledge`). Off unless
   * the project turns it on; `fuentes` narrows it to the sources the project really uses.
   */
  knowledge: z
    .object({
      activo: z.boolean().default(false),
      fuentes: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  /**
   * Security tests that talk to a running service. Only what is declared here counts as the project's
   * own: a test never runs against anything else.
   */
  security: z
    .object({
      objetivos: z
        .array(
          z.object({
            nombre: z.string().min(1),
            /** The base URL of the service (a local one, or the project's own staging). */
            url: z.url(),
            /** The OpenAPI document of that service, relative to the project: enables the `api` area. */
            openapi: z.string().min(1).optional(),
            /** The API tests send only reads (GET and HEAD) unless the project says writes are fine here. */
            escritura: z.boolean().default(false),
          }),
        )
        .default([]),
    })
    .optional(),
  /** How `evol report` looks. Without a brand the report is neutral. */
  report: z
    .object({
      brand: z
        .object({
          name: z.string().min(1).optional(),
          color: z
            .string()
            .regex(/^#?[0-9a-fA-F]{6}$/, "debe ser un color #RRGGBB")
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export type EvolConfig = z.infer<typeof ConfigSchema>;
export type ModuleConfig = z.infer<typeof ModuleSchema>;

export function parseConfig(raw: unknown, registry?: DisciplineRegistry): EvolConfig {
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(raíz)"}: ${i.message}`)
      .join("\n");
    throw new UserError(`${CONFIG_FILE} no es válido:\n${detail}`);
  }
  const config = parsed.data;
  const names = new Set<string>();
  for (const mod of config.modules) {
    if (names.has(mod.name)) throw new UserError(`${CONFIG_FILE}: módulo duplicado "${mod.name}"`);
    names.add(mod.name);
    const root = normalize(mod.root);
    if (isAbsolute(root) || root.startsWith("..")) {
      throw new UserError(
        `${CONFIG_FILE}: la raíz del módulo "${mod.name}" debe estar dentro del proyecto`,
      );
    }
    if (registry) {
      const known = registry.ids();
      for (const id of mod.disciplinas) {
        if (!known.has(id)) {
          throw new UserError(
            `${CONFIG_FILE}: el módulo "${mod.name}" usa la disciplina desconocida "${id}"`,
          );
        }
      }
      const problems = validateModuleOverrides(registry, mod);
      if (problems.length > 0) {
        throw new UserError(
          `${CONFIG_FILE}: módulo "${mod.name}":\n  - ${problems.join("\n  - ")}`,
        );
      }
    }
  }
  return config;
}

export function loadConfig(root: string, registry?: DisciplineRegistry): EvolConfig {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) throw new UserError(`No existe ${CONFIG_FILE} en ${root}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new UserError(`${CONFIG_FILE} no es JSON válido: ${(error as Error).message}`);
  }
  return parseConfig(raw, registry);
}

export function saveConfig(root: string, config: EvolConfig): void {
  writeFileSync(join(root, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}
