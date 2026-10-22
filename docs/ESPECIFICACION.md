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

## Ampliación 2: informe profesional, UML y mejoras

> **Estado: APROBADA.** Construcción en curso por hitos; el hito 1 (`export`, `risk`, `coverage`) está en la rama
> `docs/ampliacion-2`.

Decisiones ya tomadas: el informe incluye **los 14 diagramas UML**; **no** hay firmas por persona (se mantiene la clave
HMAC actual); la trazabilidad usa la convención `CA-n`; la marca del informe es **neutra** (nombre y color configurables).

### Informe de proyecto (`evol report`)

Genera un dossier **DOCX y PDF**, en español, con esta estructura:

1. Portada (nombre, fase, fecha, estado).
2. Resumen ejecutivo: fase, bloqueos, riesgos principales y aprobaciones.
3. Pipeline y aprobaciones: quién, cuándo y huella de cada aprobación.
4. Disciplinas por módulo y fase.
5. Trazabilidad de criterios de aceptación a pruebas.
6. Modelo UML (los 14 diagramas, ver abajo).
7. Arquitectura del código y mapa de riesgo.
8. Decisiones y lecciones.
9. Anexos: inventario de artefactos con sus hashes.

**Cómo se construye** (probado con los CLIs, que se usan sin abrir ninguna ventana):

- **Diagramas:** `evol` genera cada uno como SVG a partir de datos reales. Para los que son grafos usa **Graphviz** (`dot`)
  solo como motor de disposición; los de secuencia, tiempos y casos de uso los dibuja un generador propio. **VectorCraft**
  convierte el SVG a imagen para incrustarla.
- **Documento:** lo arma **WordCraft** con sus comandos (portada, estilos de título, tablas con sombreado, imágenes,
  encabezado, pie y numeración). No se usa la conversión desde HTML: descarta el CSS y los SVG en línea.
- **PdfCraft** valida el PDF (`info`, `check`) y puede unir anexos.
- ArtCraft y Graphviz son dependencias externas **opcionales** (ArtCraft está en alfa). Si falta alguna, `evol report`
  falla con un mensaje claro y ofrece `--formato md` (Markdown con SVG); nunca cambia de formato en silencio. No van
  dentro de la imagen Docker.

### Los 14 diagramas UML

Cada diagrama dice de dónde salen sus datos. **Si el proyecto no tiene los datos, aparece como «no aplica» con el motivo;
nunca se inventa contenido.**

| #   | Diagrama              | Qué muestra                                                              | Fuente                                  |
| --- | --------------------- | ------------------------------------------------------------------------ | --------------------------------------- |
| 1   | Clases                | Clases e interfaces con su herencia y sus métodos                        | Índice de código (EXTENDS, CONTAINS)    |
| 2   | Objetos               | Instantánea del proyecto: proyecto, fases y aprobaciones con sus valores | Estado de `evol`                        |
| 3   | Componentes           | Módulos y dependencias entre ellos                                       | Índice de código (IMPORTS)              |
| 4   | Estructura compuesta  | Interior de un componente elegido: archivos y puertos (exportaciones)    | Índice de código (CONTAINS, EXPORTS)    |
| 5   | Paquetes              | Directorios y sus dependencias                                           | Índice de código                        |
| 6   | Despliegue            | Contenedores, servicios y pipeline de CI                                 | `Dockerfile`, compose, workflows        |
| 7   | Perfiles              | Estereotipos que aplican las disciplinas activas (`«SDD»`, `«TDD»`…)     | `evol.config.json` y `disciplines/`     |
| 8   | Casos de uso          | Actores y casos de uso                                                   | `.feature` («Como <actor>»), SPEC       |
| 9   | Actividad             | Flujo del pipeline con sus puertas de aprobación                         | Modelo del pipeline y estado            |
| 10  | Máquina de estados    | Estados de una fase: pendiente, actual, aprobada, invalidada             | Reglas del pipeline                     |
| 11  | Secuencia             | Aprobación de una fase y llamadas de un punto de entrada elegido         | Reglas del pipeline y CALLS             |
| 12  | Comunicación          | Mismos mensajes de un punto de entrada, numerados sobre los objetos      | Índice de código (CALLS)                |
| 13  | Tiempos               | Duración de cada fase y de cada espera de aprobación                     | Diario (`.evol/journal`) con sus fechas |
| 14  | Visión de interacción | Flujo del pipeline donde cada nodo remite a su diagrama de secuencia     | Modelo del pipeline                     |

Los diagramas 2, 6 y 13 reflejan el estado real del momento; los 9, 10 y 14 describen cómo funciona `evol` (el modelo no
cambia entre proyectos, pero se marca el estado actual). Los de código (1, 3, 4, 5, 11, 12) solo cubren TypeScript.

### Mejoras

| Mejora                                            | Qué hace                                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `evol risk`                                       | Ordena los archivos por riesgo = alcance transitivo × falta de pruebas.                                                                                                                          |
| `evol coverage`                                   | Matriz criterio de aceptación → escenario → prueba, con los huecos. Convención: criterios `CA-1`, `CA-2`… en el SPEC; el `.feature` los etiqueta (`@CA-1`) y el nombre de la prueba los incluye. |
| `evol disciplines list\|enable\|disable\|suggest` | Activa y desactiva disciplinas por módulo. Perfiles por tipo de proyecto (`erp`, `api`, `web`, `lib`…) con `--perfil` en `new` e `init`.                                                         |
| `evol lessons check`                              | Busca lecciones parecidas en otros wings de MemPalace y avisa de las repetidas.                                                                                                                  |
| `evol export --json`                              | Un solo conjunto de datos, con esquema versionado, que usan el informe y, después, `evol ui`.                                                                                                    |

### Criterios de aceptación

| #   | Criterio                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | `evol report` genera un `.docx` y un `.pdf` con las 9 secciones; `wordcraft-cli info` y `pdfcraft-cli info/check` los validan.                                                         |
| 26  | El informe contiene los **14 tipos de diagrama UML**, cada uno con título, tipo y fuente de datos. Si faltan datos aparece como «no aplica» con el motivo.                             |
| 27  | Cada diagrama es un SVG válido que VectorCraft rasteriza sin error, y es determinista: los mismos datos dan el mismo SVG. Hay una prueba de instantánea sobre el propio `evol-driven`. |
| 28  | Las cifras, fases y aprobaciones del PDF (texto extraído) coinciden con `evol export --json`.                                                                                          |
| 29  | Sin ArtCraft o sin Graphviz, `evol report` falla con un mensaje claro y `--formato md` produce Markdown con SVG.                                                                       |
| 30  | El informe no contiene secretos, claves ni el contenido de los recuerdos de MemPalace: solo conteos y títulos.                                                                         |
| 31  | La marca es neutra por defecto; el nombre y el color de `evol.config.json` aparecen en portada y encabezado.                                                                           |
| 32  | `evol risk` ordena correctamente un proyecto de ejemplo y admite `--json`.                                                                                                             |
| 33  | `evol coverage` detecta un criterio sin escenario y uno sin prueba; en QA puede exigir cobertura total.                                                                                |
| 34  | `evol disciplines enable/disable` valida el id, registra el cambio en el diario e invalida las aprobaciones de las fases afectadas; `--perfil` aplica el conjunto del perfil.          |
| 35  | `evol lessons check` detecta una lección repetida entre dos proyectos; sin MemPalace falla con un mensaje claro.                                                                       |
| 36  | `evol export --json` cumple un esquema versionado y lo consumen el informe y las pruebas.                                                                                              |
| 37  | CI en verde; las pruebas que necesitan ArtCraft o Graphviz se saltan de forma visible cuando no están instalados.                                                                      |

### Hitos

1. Conjunto de datos (`export`), `risk` y `coverage`. **Hecho** (criterios 32, 33 y 36; `tests/analysis.test.ts`).
2. Perfiles y `evol disciplines`. **Hecho** (criterio 34; `tests/disciplines-cmd.test.ts`). `enable` y `disable` exigen una persona en una terminal; los perfiles son `base`, `api`, `web`, `erp` y `lib`.
3. `evol lessons check`. **Hecho** (criterio 35; `tests/lessons.test.ts`, con un servidor MemPalace de prueba; el `search` real se cubre en `tests/memory.test.ts`).
4. Generador de diagramas: primero los 7 estructurales y luego los 7 de comportamiento. **Hecho** (criterios 26 y 27;
   `tests/diagrams.test.ts`; comando `evol diagrams`). Ajustes respecto al borrador: el diagrama de clases no dibuja
   composición (el índice solo guarda herencia y miembros, no tipos de campos); el de secuencia sigue las llamadas por
   niveles porque el índice no guarda el orden de ejecución; y la fuente es «Source Sans 3», que trae VectorCraft: el SVG
   la nombra, no la incrusta, y el diseño se calcula con anchos estimados para no depender de las fuentes instaladas.
5. `evol report` (DOCX y PDF con ArtCraft, y Markdown como alternativa). **Hecho** (criterios 25, 26, 28, 29, 30 y 31;
   `tests/report.test.ts`). Ajustes respecto al borrador: las «9 secciones» son la portada y las 8 numeradas (el índice
   es aparte); sin WordCraft el informe falla y ofrece `--formato md`, que solo necesita Graphviz (los diagramas son
   obligatorios en cualquier formato); el índice llega a primer nivel y los diagramas se indexan en la sección 5;
   la marca se configura en `evol.config.json` (`report.brand.name` y `report.brand.color`).
6. Documentación y CI.

### Fuera de esta ampliación

`evol ui` (el panel de los mockups), que consumirá `evol export --json` después. Agentes revisores. Firmas por persona
(descartadas por ahora).

### Límites que conviene conocer

- Los CLIs de ArtCraft están en **alfa**. En la prueba, la fuente Helvetica se sustituyó por Source Sans 3; los
  diagramas usarán una fuente incluida para que se vean igual en cualquier equipo.
- El informe no se puede generar en CI ni en Docker (ArtCraft y Graphviz no están instalados allí).
- Graphviz no es parte de ArtCraft: solo calcula las posiciones; la imagen final la produce VectorCraft.
- Los diagramas de código dependen de lo que el indexador entiende (TypeScript); en otros lenguajes serán «no aplica».

## Ampliación 3: panel `evol ui` y documentación por proyecto

> **Estado: BORRADOR.** Los mockups están hechos (`docs/design/mockups/`, fuentes en `docs/design/mockups-src/`);
> falta que los revises. No se escribe `evol ui` hasta que los apruebes.

Objetivo: ver **por proyecto** toda la documentación asociada (especificaciones, evidencias, mejoras, decisiones,
diagramas e informe) y acceder a ella desde un único lugar, sin salir del panel.

### Pantallas

| Pantalla          | Qué responde                                                    | Estado    |
| ----------------- | --------------------------------------------------------------- | --------- |
| Tablero           | ¿En qué fase está cada proyecto y qué lo bloquea?               | Mockup    |
| Proyecto          | ¿Qué falta en la fase actual y quién aprobó qué?                | Mockup    |
| **Documentación** | ¿Qué documentos tiene, qué evidencia hay y qué hay que mejorar? | **Nuevo** |
| Grafos            | ¿Qué depende de qué? Mapa de calor por alcance                  | Mockup    |
| **Skills**        | ¿Qué sabe hacer evol, qué skills tengo y dónde puedo usarlas?   | **Nuevo** |

### Qué agrupa «Documentación»

| Grupo                 | Contenido                                                                                       | Fuente                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Especificaciones      | SPEC, dominio, features, amenazas, plan, descubrimiento, escenarios `.feature`, OpenAPI         | Archivos del proyecto y artefactos de las disciplinas                                    |
| Evidencias            | Aprobaciones firmadas, verificación por fase, informe de QA, diario, pruebas, trazabilidad CA-n | `.evol/`, `QA_REPORT.md`, `evol coverage`                                                |
| Mejoras               | Propuestas, lecciones, pendientes, mapa de riesgo y huecos de la fase actual                    | `MEJORAS*.md`, `docs/mejoras/`, `proposals/`, `lecciones.md`, `evol risk`, `evol status` |
| Decisiones y memoria  | ADR, constitución y memoria del proyecto                                                        | `docs/adr/`, `docs/constitucion.md`, `memoria.md`                                        |
| Diagramas             | Los 14 diagramas UML con su fuente de datos; los que no aplican explican por qué                | `evol diagrams`                                                                          |
| Informe               | El dossier DOCX/PDF si existe; si no, cómo generarlo                                            | `informe/`, `evol report`                                                                |
| Documentación general | README, guías y archivos para agentes                                                           | `*.md` de la raíz y de `docs/`                                                           |

Reglas de diseño:

- **Solo lectura y sin inventar.** Un documento que el pipeline espera y no existe aparece como «No existe», con la
  disciplina y la fase que lo exigen; un diagrama sin datos conserva su motivo.
- **Una sola búsqueda** sobre títulos, rutas y texto de todos los documentos del proyecto; «Solo lo que falta» filtra lo
  incompleto.
- **Enlaces internos**: un enlace relativo dentro de un `.md` abre el documento en el panel si existe.
- **Mejoras con progreso**: en las propuestas, las casillas `- [ ]` / `- [x]` dan el avance («3 de 8 tareas hechas»).
- **Seguridad**: no muestra la clave del gate ni el contenido de MemPalace; el SVG se sanea antes de insertarlo.

### Criterios de aceptación (preliminares)

| #   | Criterio                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------ |
| 38  | `evol ui` sirve el panel en `127.0.0.1` sin dependencias nuevas y sin escribir en el proyecto.                           |
| 39  | La pantalla Documentación lista, por proyecto, los 7 grupos con su conteo y los huecos, a partir de los archivos reales. |
| 40  | Cada documento se abre en el lector: Markdown renderizado y texto original, metadatos (ruta, tamaño, huella, fase).      |
| 41  | Los datos calculados (trazabilidad, riesgo, diagramas) coinciden con `evol export --json` y `evol diagrams`.             |
| 42  | La búsqueda encuentra texto dentro de los documentos y «Solo lo que falta» deja únicamente lo incompleto.                |
| 43  | Un archivo con `[[COMPLETAR]]` figura como «Por completar»; uno esperado y ausente, como «No existe».                    |
| 44  | Ningún dato sensible (clave del gate, firmas, memoria de MemPalace) llega al HTML que sirve `evol ui`.                   |

### Aplicación de escritorio

`evol ui` se abre en el navegador, pero se comporta como una aplicación:

- `evol ui --app` arranca el servidor local (solo `127.0.0.1`) si no está corriendo y abre una ventana propia, sin
  pestañas ni barra de direcciones (Chromium en modo `--app`, lo mismo que hace `omarchy-launch-webapp`).
- `evol ui install` crea `~/.local/share/applications/evol.desktop` con su icono para que aparezca en el lanzador del
  menú; `evol ui uninstall` lo quita.
- Al cerrar la ventana, el servidor se apaga solo tras unos minutos de inactividad.
- No usa Electron ni Tauri: cero dependencias nuevas.

### Skills de evol

Una **skill** es una carpeta con un `SKILL.md` (frontmatter con `name` y `description`, más instrucciones) y, a veces,
scripts y referencias. Son las capacidades que se irán sumando a evol.

**Biblioteca.** Las skills de evol viven en `~/.config/evol/skills/<nombre>/`: una sola fuente para cualquier proyecto o
tarea. El panel **vigila esa carpeta**: una skill creada, importada o copiada a mano aparece en la pantalla sin hacer
nada más. Las que ya tienen instaladas otros agentes (Claude Code, Codex, Hermes, Omarchy) se muestran aparte, solo de
lectura, y se pueden añadir a la biblioteca.

**Organización.** El legado (`evol-system/skills`, 74 skills) tenía 18 categorías sueltas y 7 skills sin categoría. En la
biblioteca cada skill pertenece a **un grupo** de 11: Disciplinas, Calidad y revisión, Contexto y memoria, Descubrimiento y
producto, Equipo y gobierno, Código y plataforma, Dominio, Documentación y comunicación, Operación del sistema, Creación y
ciclo de vida, y Diseño y medios. Las **31 skills de disciplina** se enlazan con las 31 disciplinas de evol (9 base y 22
extendidas): cada disciplina sabe qué skill la aplica y en qué fases. Se conserva la categoría anterior para trazar el cambio.

**Qué se puede hacer con una skill**

| Acción                | Comando                                      | Qué hace                                                                                        |
| --------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Revisar               | `evol skills check [nombre]`                 | Frontmatter válido, `name` = carpeta, `description` útil, sin claves; avisa de scripts y de red |
| Importar              | `evol skills import <ruta> [--grupo]`        | La copia a la biblioteca; con el legado reparte los grupos y ata las disciplinas (admite .zip)  |
| Crear                 | `evol skills new <nombre> [--grupo]`         | Crea la carpeta con una plantilla                                                               |
| Usar en un proyecto   | `evol skills add <nombre> --proyecto <id>`   | La copia al proyecto, visible para los agentes que use                                          |
| Instalar en un agente | `evol skills install <nombre> --agente <id>` | La enlaza (symlink) en la carpeta del agente: se actualiza sola                                 |
| Descargar             | `evol skills export <nombre>`                | Un `.zip` con toda la carpeta (una skill no es un solo archivo)                                 |
| Quitar                | `evol skills remove <nombre>`                | La quita de la biblioteca; no toca los proyectos que ya la usan                                 |

**Seguridad.** Una skill son instrucciones y, a veces, scripts que un agente ejecuta: por eso se revisa antes de usarla.
Las acciones que escriben (importar, instalar, usar en un proyecto, quitar) piden confirmación, solo escriben en la
biblioteca, en las carpetas de los agentes o en el proyecto elegido, y el servidor rechaza peticiones que no vengan de la
propia página (token por sesión y comprobación de origen). La pantalla Documentación sigue siendo de solo lectura.

### Criterios de aceptación adicionales (preliminares)

| #   | Criterio                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 45  | `evol ui --app` abre una ventana sin barra de direcciones y no arranca un segundo servidor si ya hay uno.                                     |
| 46  | `evol ui install` crea el `.desktop` con icono y `uninstall` lo borra; el servidor se apaga tras el tiempo de inactividad.                    |
| 47  | `evol ui` no añade ninguna dependencia a `package.json`.                                                                                      |
| 48  | La pantalla Skills lista la biblioteca y, aparte, las de los agentes; una skill con `SKILL.md` copiada a la biblioteca aparece sin reiniciar. |
| 49  | Cada skill se revisa: frontmatter válido, `name` = carpeta, `description`, claves en claro, scripts y acceso a red.                           |
| 50  | Un frontmatter roto no oculta la skill: se muestra con nombre y descripción recuperados y el error de YAML.                                   |
| 51  | `evol skills import` del legado reparte las 74 skills en los 11 grupos, ata las 31 a su disciplina y no deja ninguna sin grupo.               |
| 52  | Cada una de las 31 disciplinas indica la skill que la aplica; una disciplina sin skill se marca.                                              |
| 53  | `evol skills export` genera un `.zip` con toda la carpeta de la skill y su huella; `import` lo lee y reproduce la misma huella.               |
| 54  | `evol skills add` y `install` no sobrescriben una skill distinta con el mismo nombre sin confirmar.                                           |
| 55  | Las acciones que escriben rechazan peticiones sin el token de sesión o con un origen ajeno.                                                   |
| 56  | El texto de las skills de terceros no se copia a ningún archivo del repositorio ni del informe.                                               |

### Para revisar en los mockups

- ¿Falta algún grupo o algún documento que quieras ver por proyecto?
- Las **mejoras** salen de `MEJORAS*.md`, `docs/mejoras/` y `proposals/`: ¿es esa la convención que quieres fijar?
- ¿Los 11 grupos de skills te parecen bien, o mueves alguna skill de grupo? (la lista está en `docs/design/mockups-src/collect-skills.mjs`)
- La fecha de modificación de cada archivo se mostrará en `evol ui` (los mockups usan copias, sin fecha real).
