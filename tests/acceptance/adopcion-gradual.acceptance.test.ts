import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approvePhase, loadContext } from "../../src/core/pipeline.js";
import type { Confirm } from "../../src/core/pipeline.js";
import { PROFILES } from "../../src/core/profiles.js";
import {
  cli,
  legacyProject,
  makeProject,
  makeProjectAt,
  write,
  writeValidArtifacts,
} from "../helpers.js";
import { DISC, conSpec, doc, env, existe, indice, lineaDe, salida } from "./docs-fixtures.js";

const yes: Confirm = () => Promise.resolve({ approver: "ana" });
const passing = () => ({ ok: true, output: "" });
const NUEVAS = ["ADD", "GRANULAR", "INVESTIGACION", "REQDD", "SPRINTDD"];

describe("adoptar la exigencia poco a poco", () => {
  it("CA-154: un documento muy corto avisa y con --estricto falla", () => {
    const root = makeProject(DISC);
    conSpec(root);
    write(
      root,
      "docs/proyecto/db/esquemas.md",
      "# Esquemas\n\nOrigen: docs/specs/SPEC.md\n\nPoco.\n",
    );
    write(root, "docs/proyecto/db/relaciones.md", doc("Relaciones"));
    write(root, "docs/proyecto/INDEX.md", indice("db/esquemas.md", "db/relaciones.md"));

    const suave = cli(["docs", "check"], { cwd: root, env: env() });
    const estricto = cli(["docs", "check", "--estricto"], { cwd: root, env: env() });

    expect(existe(suave), salida(suave)).toBe(true);
    expect(suave.status, salida(suave)).toBe(0);
    expect(lineaDe(suave, "db/esquemas.md")).toMatch(/aviso/i);
    expect(salida(suave)).not.toContain("db/relaciones.md");
    expect(existe(estricto), salida(estricto)).toBe(true);
    expect(estricto.status).not.toBe(0);
    expect(salida(estricto)).toContain("db/esquemas.md");
  });

  it("CA-155: con solo avisos pendientes la fase se puede aprobar", async () => {
    const root = makeProjectAt("spec", ["SDD", "ADD"]);
    writeValidArtifacts(root, "SDD");
    write(
      root,
      "docs/adr/0001-uno.md",
      "# ADR 1\n\nEstado: aceptada\n\n## Contexto\n\nx\n\n## Opciones\n\nA y B\n\n## Decisión\n\nA\n\n## Consecuencias\n\nx\n",
    );

    const verify = cli(["verify"], { cwd: root, env: env() });
    const ctx = loadContext(root, { run: passing, securityScan: () => [] });
    const aprobada = await approvePhase(ctx, "spec", yes);

    expect(verify.stdout).toMatch(/^WARN/m);
    expect(aprobada.seq).toBeGreaterThanOrEqual(0);
  });

  it("CA-156: un proyecto nuevo con el perfil base trae las disciplinas nuevas", () => {
    const root = legacyProject();

    const r = cli(["init", root, "--no-memory", "--perfil", "base"], { cwd: root, env: env() });

    expect(r.status, salida(r)).toBe(0);
    const config = JSON.parse(readFileSync(join(root, "evol.config.json"), "utf8")) as {
      modules: { disciplinas: string[] }[];
    };
    const disciplinas = config.modules[0]?.disciplinas ?? [];
    for (const id of NUEVAS) expect(disciplinas, id).toContain(id);
    expect(disciplinas).toHaveLength(14);
  });

  it("CA-156: los perfiles lib y script y un proyecto creado antes no cambian", () => {
    expect(PROFILES["lib"]?.disciplinas).toEqual([
      "SDD",
      "DDD",
      "THREAT",
      "BDD",
      "TDD",
      "STDD",
      "SecDD",
      "APIVDD",
      "DeprecationDD",
    ]);
    expect(PROFILES["script"]?.disciplinas).toEqual(["SDD", "BDD", "TDD", "SecDD", "THREAT"]);

    const root = makeProject(DISC);
    const lista = cli(["disciplines", "list", "--json"], { cwd: root, env: env() });

    const filas = JSON.parse(lista.stdout) as { id: string; modulos: string[] }[];
    expect(filas.find((d) => d.id === "SDD")?.modulos).toEqual(["app"]);
    expect(filas.find((d) => d.id === "GRANULAR")?.modulos).toEqual([]);
  });
});
