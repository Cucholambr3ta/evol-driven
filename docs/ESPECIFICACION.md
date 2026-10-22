# evol-driven — Especificación v1

> **Estado: APROBADA y construida.** Los criterios de aceptación tienen su prueba
> automática; ver «Trazabilidad» y «Ajustes de la implementación» al final.

## Qué es

Un framework de línea de comandos (Node.js / TypeScript) para **crear proyectos TypeScript** que
se desarrollan mediante un **pipeline de fases con las 31 disciplinas Driven Development**, con
**memoria persistente** aportada por **MemPalace** y un **indexador de código** propio.

## Alcance de la v1

1. **`evol new <nombre>`** crea un proyecto TypeScript (modo estricto, Vitest, ESLint, Prettier, Git)
   ya conectado al pipeline, a la memoria y al indexador.
2. **Pipeline de 6 fases**: Briefing → Spec → Plan → Build → QA → Retro. Cada fase exige artefactos
   y **la aprobación de una persona** para avanzar.
3. **Las 31 disciplinas** (9 base + 22 extendidas), declaradas como datos en un registro. Cada
   módulo del proyecto elige cuáles aplica en cada fase.
4. **Memoria con MemPalace** (dependencia externa, no se reimplementa): decisiones, lecciones y
   aprobaciones se guardan en el _wing_ del proyecto y se consultan con `evol memory`.
5. **Indexador de código** (ver sección propia): grafo de símbolos, análisis de impacto y trazas.

## Fuera de la v1

TUI, interfaz web, orquestación multi-agente, agentes efímeros y la integración propia con los 7
IDEs. (Los agentes acceden a la memoria por el MCP de MemPalace, que ya funciona con Claude Code y
Hermes.)

## Comandos

| Comando                      | Qué hace                                                               |
| ---------------------------- | ---------------------------------------------------------------------- |
| `evol new <nombre>`          | Crea el proyecto con la plantilla y configura su memoria               |
| `evol status`                | Fase actual, artefactos pendientes y disciplinas activas por módulo    |
| `evol next`                  | Verifica la fase actual; solo avanza si todo se cumple y está aprobada |
| `evol approve <fase>`        | Registra la aprobación humana de la fase                               |
| `evol memory add` / `search` | Guarda y consulta memoria en MemPalace                                 |
| `evol index`                 | Construye o actualiza el grafo de código (incremental)                 |
| `evol impact <símbolo>`      | Qué depende, directa y transitivamente, de un símbolo                  |
| `evol trace <símbolo>`       | Cadena de llamadas desde un punto de entrada                           |
| `evol doctor`                | Comprueba Node, Git, MemPalace y la configuración                      |

## Reglas de diseño (vienen de las lecciones del proyecto anterior)

- **Aprobar es solo humano:** `evol approve` exige una terminal interactiva y que escribas el
  nombre de la fase. No hay opción `--yes`.
- **La clave del gate no vive en el proyecto:** se guarda en la configuración del usuario, nunca en
  el repositorio.
- **La aprobación incluye el hash de los artefactos:** si se edita un artefacto ya aprobado, la
  aprobación deja de ser válida.
- **Una sola fuente de versión** (`package.json`) y **un solo lugar para el código**.
- **El CI no enmascara fallos** (nada de `|| true`) y no hay pruebas de relleno.
- **Todas las dependencias declaradas.** MemPalace consta como dependencia externa.
- **El grafo de código no se guarda en la memoria.** Es derivable del código; la memoria guarda
  decisiones y lecciones.

## Las 31 disciplinas

Cada disciplina es un archivo de datos `disciplines/<id>.json` con su fase, sus artefactos y sus
verificaciones; agregar o cambiar una no requiere tocar el motor. Fases y artefactos salen de las
fichas del proyecto anterior (las rutas de las extendidas, de su tabla "Artefactos de salida").

**Niveles de verificación en la v1**

- **A:** el artefacto existe, no está vacío y su formato es válido (JSON/YAML parsean, un `.feature`
  tiene escenarios, las migraciones tienen su `up` y su `down`, etc.).
- **B:** además se ejecuta algo y debe pasar (las pruebas de la disciplina).

Las disciplinas de experimentos (Chaos, Performance) verifican en la v1 que el plan exista y sea
válido; **ejecutar** los experimentos queda fuera.

### Base (9)

| Disciplina    | Fase           | Artefactos                              | Nivel                               |
| ------------- | -------------- | --------------------------------------- | ----------------------------------- |
| SDD           | todas          | `docs/specs/SPEC.md`                    | A (con criterios de aceptación)     |
| FDD           | Briefing, Plan | `docs/features/FEATURES.md`             | A                                   |
| DDD           | Spec           | `docs/specs/DOMAIN.md`                  | A (entidades y reglas)              |
| Threat-Driven | Spec           | `docs/specs/THREATS.md`                 | A (amenazas y mitigaciones)         |
| BDD           | Briefing, QA   | `tests/features/*.feature`              | A (≥1 escenario por feature)        |
| ATDD          | Briefing, QA   | `tests/acceptance/*.acceptance.test.ts` | B                                   |
| TDD           | Build          | `tests/unit/*.test.ts`                  | B                                   |
| STDD          | Build          | `tests/security/**/*.security.test.ts`  | B                                   |
| SecDD         | QA             | `.evol/qa/QA_REPORT.md`                 | A (sin hallazgos críticos abiertos) |

### Extendidas (22)

| Disciplina             | Fase         | Artefactos                                                                       | Nivel           |
| ---------------------- | ------------ | -------------------------------------------------------------------------------- | --------------- |
| ODD_API (OpenAPI)      | Spec         | `api/openapi.yaml`, `api/fragments/*.json`                                       | A               |
| UXDD                   | Briefing     | `ux/user_journeys/*.json`, `ux/ui_messages/*.md`, `ux/microinteractions/*.yaml`  | A               |
| A11yDD                 | Briefing, QA | `a11y/wcag_criteria.json`, `a11y/screen_reader_tests/*.feature`                  | A               |
| UDD (casos de uso)     | Briefing     | `usecases/*/usecase.json`, `diagram.puml`, `test_scenarios.feature`              | A               |
| ADD (arquitectura)     | Spec         | `docs/adr/NNNN-*.md`, `docs/adr/NNNN-poc/results.json`                           | A               |
| ESDD (event sourcing)  | Spec         | `eventsourcing/event_store_schema.json`, `eventsourcing/aggregates/*.md`         | A               |
| IODD (infraestructura) | Spec         | `infra/main.tf`, `infra/dependencies_graph.json`                                 | A               |
| Compliance             | Spec         | `compliance/control_mappings.json`, `compliance/audit_logs_spec.json`            | A               |
| PrivacyDD              | Spec         | `privacy/pii_inventory.json`, `consent_models/*.json`, `deletion_policies/*.sql` | A               |
| EDA (eventos)          | Spec         | `eda/schemas/*.avsc`, `eda/topics/*.json`, `eda/producers/*.json`                | A               |
| MDD (migraciones)      | Plan         | `migrations/*/up.sql`, `down.sql`, `data_migration.md`                           | A (par up/down) |
| CDCDD                  | Plan         | `cdc/sources/*.json`, `cdc/transformations/*.sql`, `cdc/targets/*.json`          | A               |
| APIVDD                 | Plan         | `api_versions/deprecation_schedule.json`, `breaking_changes/*.md`                | A               |
| DebtBudgetDD           | Plan         | `debt/budget.json`, `debt/ledger.json`, `debt/forecast.md`                       | A               |
| DeprecationDD          | Plan         | `deprecations/*/sunset_policy.json`, `deprecations/logs/usage_metrics.json`      | A               |
| RDD (refactorización)  | Build        | `refactoring/sessions/*.md`, `refactoring/after_metrics.json`                    | A               |
| Pipeline-Driven        | Build        | `pipeline/stages.json`, `pipeline/rollback_triggers.md`                          | A               |
| PDD (performance)      | QA           | `performance/slos/*.json`, `load_test_scenarios/*.md`                            | A               |
| Chaos                  | QA           | `chaos/hypothesis/*.md`, `chaos/experiments/*/fault_injection.json`              | A               |
| CCDD (contratos)       | QA           | `contracts/consumer_*.json`, `contracts/verification_results.json`               | A               |
| ODD_Obs                | QA           | `observability/metrics/*.json`, `observability/logs/*.schema.json`               | A               |
| SLO/SLA                | QA           | `sla/slo_documents/*.json`, `sla/error_budget_policy.md`                         | A               |

La fase **Retro** no tiene disciplinas propias: siempre exige al menos una lección registrada.

**Activación por módulo.** `evol.config.json` lista los módulos del proyecto y, para cada uno, las
disciplinas que aplica. Una disciplina no activada no se verifica.

## Indexador de código

**Qué hacía el del proyecto anterior:** Tree-sitter sobre Python y JS/TS, un grafo en LadybugDB
(nodos Archivo, Módulo, Símbolo, Test; relaciones IMPORTS, CALLS, EXTENDS, CONTAINS, EXPORTS,
TESTS, MODIFIES, BLAME), análisis de impacto, trazas y _hooks_ que reindexaban al editar o
comitear. Su propia lección: el grafo va **separado** de la memoria.

**Propuesta para la v1** (cada punto se comprobó con una prueba pequeña en tu máquina):

| Decisión        | Elección                                                                                            | Por qué                                                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Analizador      | **ts-morph** (API del compilador de TypeScript)                                                     | Resuelve tipos, herencia e imports reales. Trae su propio TypeScript (6.0.2), independiente del 7 que tienes global. Hay que resolver el alias del import: en la prueba, `greet` se resolvió al `import` y no a la función de `b.ts` |
| Almacén         | **SQLite** del propio Node (`node:sqlite`, v3.54 en tu Node 26) en `.evol/codegraph.sqlite`         | Cero dependencias nativas. Tablas `nodes` y `edges`; impacto y trazas con consultas recursivas (`WITH RECURSIVE`)                                                                                                                    |
| Actualización   | **Incremental** por hash de archivo; se dispara con _hooks_ post-edición y post-commit              | Solo reprocesa lo que cambió                                                                                                                                                                                                         |
| Relaciones v1   | IMPORTS, CALLS, EXTENDS, CONTAINS, EXPORTS, TESTS, MODIFIES (desde `git diff`)                      | Igual que el anterior, sin BLAME                                                                                                                                                                                                     |
| Lenguajes       | TypeScript y JavaScript                                                                             | Es lo que genera el framework. Tree-sitter solo si más adelante hace falta otro lenguaje                                                                                                                                             |
| Con la memoria  | El grafo **no** se guarda en MemPalace. Sí se guardan decisiones y el impacto de cambios relevantes | Evita meter estado derivado en la memoria                                                                                                                                                                                            |
| Con el pipeline | En QA, `evol next` puede exigir que los símbolos modificados tengan tests (relación TESTS)          | Hace útil el grafo, no un adorno                                                                                                                                                                                                     |
| Con los agentes | Después de la v1: un MCP pequeño (`evol mcp`) con `impact`, `trace` y `find_symbol`                 | Que Claude Code y Hermes lo consulten                                                                                                                                                                                                |

Alternativa descartada por ahora: **LadybugDB** (`@ladybugdb/core`, existe en npm). Tiene sentido si
el grafo crece mucho; hoy es una dependencia pesada que SQLite evita.

### Proveedores de inteligencia de código (opción C)

Los comandos `impact` y `trace` hablan con una interfaz común, `CodeIntelProvider`
(`available()`, `findSymbol()`, `impact()`, `trace()`), con dos implementaciones:

| Proveedor  | Qué es                                                                    | Estado                 |
| ---------- | ------------------------------------------------------------------------- | ---------------------- |
| `native`   | El indexador propio de arriba (ts-morph + SQLite)                         | Incluido y por defecto |
| `gitnexus` | Cliente MCP por stdio de `gitnexus mcp`, si el usuario lo tiene instalado | Opcional               |

- `evol.config.json` fija el proveedor (`"codeIntel": "native"` por defecto).
- **GitNexus no se incluye, no se copia y no se instala desde `evol-driven`.** Su licencia es
  PolyForm Noncommercial 1.0.0 (solo uso no comercial). `evol doctor` solo detecta si está presente.
  Que su uso sea compatible con el tuyo es decisión de quien lo instala; `DEPENDENCIES.md` lo
  declara como opcional y con esa licencia.
- Si el proveedor elegido no está disponible, el comando falla con un mensaje claro y **no** cambia
  de proveedor en silencio.

## Criterios de aceptación (cada uno se comprueba con una prueba automática)

| #   | Criterio                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `evol new demo` genera un proyecto donde `tsc --noEmit` y `npm test` pasan.                                                                                                                     |
| 2   | `evol approve` sin terminal interactiva falla con código distinto de 0 y no cambia el estado.                                                                                                   |
| 3   | La clave del gate no está dentro del proyecto generado ni en su Git.                                                                                                                            |
| 4   | Editar un artefacto aprobado hace que `evol next` rechace la fase.                                                                                                                              |
| 5   | `evol next` no avanza si faltan artefactos o si fallan las verificaciones de las disciplinas activas del módulo.                                                                                |
| 6   | Las 31 definiciones de `disciplines/` cargan y validan contra su esquema, y cada una declara fase y artefactos.                                                                                 |
| 7   | Cada tipo de verificación (existe, no vacío, JSON/YAML válido, `.feature` con escenarios, par up/down, comando que pasa) tiene una prueba que falla con un artefacto inválido.                  |
| 8   | `evol memory add` seguido de `evol memory search` recupera el dato en el _wing_ del proyecto, con MemPalace real.                                                                               |
| 9   | Sin MemPalace instalado, `evol doctor` lo indica y `evol memory` falla con un mensaje claro.                                                                                                    |
| 10  | `evol index` sobre un proyecto de ejemplo produce los nodos y relaciones IMPORTS, CALLS y EXTENDS esperados, con las llamadas importadas resueltas al símbolo real.                             |
| 11  | `evol impact` devuelve los dependientes transitivos correctos en un proyecto de ejemplo.                                                                                                        |
| 12  | Un segundo `evol index` sin cambios no reprocesa ningún archivo; tras editar uno, reprocesa solo ese.                                                                                           |
| 13  | Borrar `.evol/codegraph.sqlite` y reindexar reproduce el mismo grafo.                                                                                                                           |
| 14  | Las pruebas de contrato de `CodeIntelProvider` pasan tanto para el proveedor `native` como para un proveedor de prueba, de modo que cualquier proveedor nuevo se valida con las mismas pruebas. |
| 15  | Con `"codeIntel": "gitnexus"` y GitNexus ausente, `evol impact` falla con un mensaje claro y sin recurrir al proveedor `native`. El paquete no contiene código de GitNexus.                     |
| 16  | La versión aparece en un solo archivo.                                                                                                                                                          |
| 17  | El CI falla si falla cualquier prueba.                                                                                                                                                          |
| 18  | Existe una imagen Docker construible desde cero con `docker build`, y el comando `evol` funciona dentro.                                                                                        |

## Hitos de construcción

1. Esqueleto del CLI, estado del pipeline y gate (aprobación humana con hash).
2. Fases y registro de las 31 disciplinas con sus verificaciones.
3. Integración con MemPalace por MCP (`mempalace-mcp` por stdio).
4. Indexador de código nativo (`index`, `impact`, `trace`) y la interfaz `CodeIntelProvider`; el proveedor `gitnexus` opcional queda al final del hito.
5. `evol new` con la plantilla TypeScript.
6. Imagen Docker y CI.

## Decisiones que tomé por ti (corrígelas si no te gustan)

- El comando se llama **`evol`**.
- La v1 **no** integra IDEs por su cuenta; depende del MCP de MemPalace.
- Las disciplinas por módulo se declaran en `evol.config.json`.
- Las 22 extendidas verifican en la v1 **artefactos y formato** (nivel A), no ejecutan experimentos.
- El indexador cubre **TypeScript y JavaScript**; el MCP propio del indexador (`evol mcp`) queda para después de la v1.
- **Opción C elegida:** indexador propio por defecto y GitNexus solo como proveedor opcional, sin incluirlo.

## Trazabilidad: criterio → prueba

| #   | Prueba                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `tests/e2e.test.ts` — «genera un proyecto donde tsc --noEmit y npm test pasan» (con `npm install` real)                                                                           |
| 2   | `tests/cli.test.ts` — «evol approve (criterio 2)»; la aprobación positiva se prueba en una terminal real (pty)                                                                    |
| 3   | `tests/cli.test.ts` — «la clave del gate no está dentro del proyecto ni en su Git»; `tests/gate.test.ts`                                                                          |
| 4   | `tests/pipeline.test.ts` — «editar un artefacto aprobado hace que next rechace la fase»; `tests/gate.test.ts`                                                                     |
| 5   | `tests/pipeline.test.ts` — «los fallos de las disciplinas activas bloquean»                                                                                                       |
| 6   | `tests/disciplines.test.ts` — «registro de disciplinas»: las 31 cargan, validan y declaran fase y artefactos                                                                      |
| 7   | `tests/disciplines.test.ts` — «tipos de verificación»: cada tipo falla con un artefacto inválido; además cada una de las 31 pasa con artefactos válidos y falla sin ellos         |
| 8   | `tests/memory.test.ts` — add + search contra un MemPalace real con un palacio temporal (se salta de forma visible si `mempalace-mcp` no está instalado)                           |
| 9   | `tests/cli.test.ts` y `tests/memory.test.ts` — «MemPalace ausente»                                                                                                                |
| 10  | `tests/codeintel.test.ts` — «grafo del indexador nativo»                                                                                                                          |
| 11  | `tests/codeintel.test.ts` — «impact y trace»                                                                                                                                      |
| 12  | `tests/codeintel.test.ts` — «actualización incremental»                                                                                                                           |
| 13  | `tests/codeintel.test.ts` — «el grafo es derivable»                                                                                                                               |
| 14  | `tests/codeintel.test.ts` — «contrato de CodeIntelProvider» para `native` y un proveedor de prueba                                                                                |
| 15  | `tests/gitnexus.test.ts` — falla sin fallback y sin crear el grafo propio; el paquete no contiene ni importa GitNexus                                                             |
| 16  | `tests/repo.test.ts` — «una sola fuente de versión»                                                                                                                               |
| 17  | `tests/repo.test.ts` — «el CI no enmascara fallos»                                                                                                                                |
| 18  | `Dockerfile` (el build ejecuta todo el CI); `tests/repo.test.ts` con `EVOL_TEST_DOCKER=1`; comprobado a mano: `new`, `status`, `index`, `impact` y `doctor` dentro del contenedor |

## Ajustes de la implementación

Lo que la implementación decidió distinto o más concreto que el texto de arriba:

- **SDD** es transversal pero se exige **desde Spec** (la tabla decía «todas»; en Briefing todavía no
  existe `SPEC.md`).
- **Marcador `[[COMPLETAR]]`:** las plantillas lo ponen donde falta escribir, y los verificadores
  rechazan cualquier artefacto que lo conserve. Sin esto, una plantilla vacía pasaría el gate.
- **Artefactos opcionales:** de cada disciplina se exige el primer artefacto; los demás
  (`min: 0`) se validan solo si existen.
- **`approve`** primero ejecuta las verificaciones de la fase y solo acepta la fase actual; además de la
  terminal interactiva exige escribir el nombre de la fase.
- **El gate también firma `evol.config.json`:** cambiar qué disciplinas están activas invalida la
  aprobación.
- **`MODIFIES`** se calcula con `git diff` del árbol de trabajo contra `HEAD` (cambios sin comitear),
  no por commit. En un repositorio sin commits, todo cuenta como modificado.
- **`implements` e `interface extends`** se guardan como relación `EXTENDS`.
- **Incremental:** si solo cambia el cuerpo de una función, los archivos que la llaman no se
  reprocesan; si cambia el conjunto de símbolos de un archivo, sí se reprocesan los que lo importan.
- **GitNexus:** el cliente se probó con un servidor MCP de prueba, **no con GitNexus real**. Su
  respuesta se devuelve como texto (`raw`).
- **La clave del gate es por equipo:** para verificar las aprobaciones en otra máquina hay que copiar
  `~/.config/evol/keys/<id>.key`. Con Docker hay que montar un volumen en `/data`.
- **MemPalace no va dentro de la imagen Docker.**

## Ampliación: adopción de proyectos y capa para agentes

Se añadió después de la v1, a pedido: poder usar el framework en proyectos que ya existen, y que los
agentes lo sigan.

| Comando                        | Qué hace                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `evol init [carpeta]`          | Adopta un proyecto existente sin modificar sus archivos; detecta documentos en otra ruta y comando de pruebas |
| `evol agents`                  | Crea o refresca comandos `/evol-*`, bloque en `CLAUDE.md`, _hook_ y `.mcp.json`                               |
| `evol hook session-start`      | Texto que Claude Code añade al contexto al empezar: estado del pipeline y memoria relevante                   |
| `evol mcp [--project carpeta]` | Servidor MCP de solo lectura                                                                                  |

Cada módulo de `evol.config.json` admite `rutas` (reasignar un artefacto a la ruta real del proyecto) y
`comandos` (cambiar el comando que ejecuta una disciplina).

| #   | Criterio de aceptación                                                                                                                                                                      | Prueba                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 19  | `evol init` sobre un proyecto existente no modifica ningún archivo suyo; solo añade los propios y extiende `.gitignore`, `CLAUDE.md`, `settings.json`, `.mcp.json` sin perder su contenido. | `tests/init.test.ts` — «evol init sobre un proyecto existente»                |
| 20  | `evol init` detecta documentos en otra ruta y un comando de pruebas distinto, y la verificación los usa.                                                                                    | `tests/init.test.ts` — «la verificación usa las rutas y comandos reasignados» |
| 21  | Adoptar en una fase distinta de briefing exige una terminal interactiva; sin ella no se crea nada.                                                                                          | `tests/init.test.ts` — «adoptar en una fase avanzada exige a una persona»     |
| 22  | `evol mcp` ofrece exactamente sus herramientas de lectura; ninguna aprueba, avanza ni inicializa, y usarlas no cambia el estado del pipeline.                                               | `tests/mcp.test.ts` — «solo lectura»                                          |
| 23  | Los archivos para agentes se generan de forma idempotente y sin pisar los del usuario.                                                                                                      | `tests/agents.test.ts` — «archivos para agentes»                              |
| 24  | `evol hook session-start` imprime el estado y nunca rompe la sesión (sin proyecto, sin MemPalace o con configuración rota).                                                                 | `tests/agents.test.ts` — «evol hook session-start»                            |

Decisiones de esta ampliación:

- Las fases anteriores a la de adopción quedan marcadas `adopted` en el estado: no hay aprobación
  registrada para ellas, y `evol status` las muestra con `~`.
- `evol init` rechaza una carpeta que ya es un proyecto evol o que está dentro de uno.
- El MCP no incluye `approve`, `next` ni `init` a propósito; las pruebas lo comprueban.
- Las herramientas `evol_verify` y los comandos de las disciplinas se ejecutan con la misma confianza
  que `evol next`: corren los comandos que el proyecto declara.
