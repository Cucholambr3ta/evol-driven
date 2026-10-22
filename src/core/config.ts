import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { z } from "zod";
import { CONFIG_FILE } from "./paths.js";
import { UserError } from "./errors.js";

const ModuleSchema = z.object({
  name: z.string().min(1),
  root: z.string().default("."),
  disciplinas: z.array(z.string().min(1)),
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
    })
    .default({ requireTestsForChangedSymbols: false }),
  modules: z.array(ModuleSchema).min(1),
});

export type EvolConfig = z.infer<typeof ConfigSchema>;
export type ModuleConfig = z.infer<typeof ModuleSchema>;

export function parseConfig(raw: unknown, knownDisciplines?: ReadonlySet<string>): EvolConfig {
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
    if (knownDisciplines) {
      for (const id of mod.disciplinas) {
        if (!knownDisciplines.has(id)) {
          throw new UserError(
            `${CONFIG_FILE}: el módulo "${mod.name}" usa la disciplina desconocida "${id}"`,
          );
        }
      }
    }
  }
  return config;
}

export function loadConfig(root: string, knownDisciplines?: ReadonlySet<string>): EvolConfig {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) throw new UserError(`No existe ${CONFIG_FILE} en ${root}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new UserError(`${CONFIG_FILE} no es JSON válido: ${(error as Error).message}`);
  }
  return parseConfig(raw, knownDisciplines);
}

export function saveConfig(root: string, config: EvolConfig): void {
  writeFileSync(join(root, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}
