import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROFILES } from "./profiles.js";
import { matchFiles } from "./verify.js";

export interface Suggestion {
  id: string;
  motivo: string;
}

interface Rule {
  ids: string[];
  motivo: string;
  deps?: RegExp;
  files?: string[];
}

const RULES: Rule[] = [
  {
    ids: ["ODD_API", "APIVDD"],
    motivo: "expone una API (dependencia de servidor HTTP o un openapi/swagger)",
    deps: /^(express|fastify|koa|hono|@nestjs\/core|@hapi\/hapi)$/,
    files: ["**/openapi.{json,yaml,yml}", "**/swagger.{json,yaml,yml}"],
  },
  {
    ids: ["UXDD", "A11yDD"],
    motivo: "tiene interfaz web (react, vue, svelte, next, nuxt o angular)",
    deps: /^(react|react-dom|vue|svelte|next|nuxt|@angular\/core)$/,
  },
  {
    ids: ["MDD"],
    motivo: "usa base de datos con migraciones (ORM, cliente SQL o carpeta migrations)",
    deps: /^(pg|mysql2|better-sqlite3|prisma|@prisma\/client|typeorm|knex|drizzle-orm|sequelize)$/,
    files: ["**/migrations/**/*.sql"],
  },
  {
    ids: ["EDA"],
    motivo: "publica o consume eventos (kafka, rabbitmq, nats o colas)",
    deps: /^(kafkajs|amqplib|nats|bullmq)$/,
  },
  {
    ids: ["ODD_OBS"],
    motivo: "ya emite telemetría (OpenTelemetry, pino o winston)",
    deps: /^(@opentelemetry\/.+|pino|winston)$/,
  },
  {
    ids: ["PIPELINE"],
    motivo: "tiene integración continua o Docker (.github/workflows, .gitlab-ci.yml, Dockerfile)",
    files: [".github/workflows/*.{yml,yaml}", ".gitlab-ci.yml", "Dockerfile"],
  },
  {
    ids: ["IODD"],
    motivo: "declara infraestructura como código (Terraform)",
    files: ["**/*.tf"],
  },
];

function dependencies(root: string): string[] {
  const file = join(root, "package.json");
  if (!existsSync(file)) return [];
  try {
    const pkg = JSON.parse(readFileSync(file, "utf8")) as {
      dependencies?: object;
      devDependencies?: object;
    };
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  } catch {
    return [];
  }
}

/** Disciplines the project's own files and dependencies point to, minus the ones already enabled. */
export function suggestDisciplines(root: string, enabled: ReadonlySet<string>): Suggestion[] {
  const deps = dependencies(root);
  const suggestions = new Map<string, string>();
  for (const rule of RULES) {
    const byDep = rule.deps ? deps.find((d) => rule.deps?.test(d)) : undefined;
    const byFile = rule.files?.flatMap((p) => matchFiles(p, root))[0];
    const evidence = byDep ? `dependencia ${byDep}` : byFile ? `archivo ${byFile}` : null;
    if (!evidence) continue;
    for (const id of rule.ids) {
      if (!enabled.has(id) && !suggestions.has(id)) {
        suggestions.set(id, `${rule.motivo} — ${evidence}`);
      }
    }
  }
  return [...suggestions].map(([id, motivo]) => ({ id, motivo }));
}

/** The profile whose disciplines overlap the most with the enabled ones (ties: first declared). */
export function closestProfile(enabled: ReadonlySet<string>): string {
  let best = "base";
  let bestScore = -1;
  for (const [name, profile] of Object.entries(PROFILES)) {
    const score = profile.disciplinas.filter((d) => enabled.has(d)).length;
    const missing = profile.disciplinas.length - score;
    const extra = [...enabled].filter((d) => !profile.disciplinas.includes(d)).length;
    const closeness = score - missing - extra;
    if (closeness > bestScore) {
      best = name;
      bestScore = closeness;
    }
  }
  return best;
}
