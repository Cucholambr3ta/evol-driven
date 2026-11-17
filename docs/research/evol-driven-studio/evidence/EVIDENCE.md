# Registro de evidencia — Evol-Driven Studio

Fecha de la evidencia: 2026-11-16. Método por defecto: inspección estática (lectura de código y documentos) y consultas de solo lectura. **No se ejecutó ningún experimento de rendimiento ni ningún componente externo**; los repositorios externos se clonaron superficialmente (`--depth 1`) en una carpeta temporal aislada y no se instaló ni ejecutó nada de ellos.

Clasificación: VERIFIED (código/config comprobado) · DOCUMENTED (lo dice un documento, sin validación funcional) · INFERRED · UNVERIFIED · CONTRADICTORY.

## Versiones inspeccionadas

| Proyecto | Commit | Fecha commit | Versión | Licencia |
|---|---|---|---|---|
| evol-driven (este repo) | `47a93c8` (HEAD de `main` al crear la rama) | 2026-11-16 | package.json 0.5.0 | privado, `UNLICENSED` (según `docs/comparativas/gentle-ai.md`) |
| deepseek-harness | `39163dd3` | 2026-11-13 | 0.2.2-rc.3 (pre-release) | MIT |
| dsh-agent-teams | `4354b0f` | 2026-11-13 | 0.1.30 | MIT |
| dsh-mnemon | `048972f` | 2026-11-16 | 0.5.46 | MIT |
| engram | `8a4ce2d` | 2026-11-14 | publicada v3.7.2 (instalada 3.6.0) | MIT |
| mnemon | `7313b92` | 2026-11-09 | npm 0.1.0 | Apache-2.0 |
| codebase-memory-mcp | `cdfdf26` | 2026-11-14 | README cita v0.11.0 | MIT |
| dsh-codebase-memory-mcp | `533c6ca` | 2026-11-12 | 0.1.10 | MIT |
| deepseek-harness-plugin-from-scratch | `345a41d` | 2026-08-14 | 0.1.0 (comunitario, no oficial) | — |

Las 11 URLs del encargo respondieron HTTP 200 (comprobado con `curl`).

## Evidencias

### Evol-Driven (R0)

**EV-STUDIO-EV-001 — Estado del repositorio.** Fuente: `package.json`, `git log`. Commit `47a93c8`, versión 0.5.0, Node ≥24, dependencias de ejecución: `@modelcontextprotocol/sdk`, `ts-morph`, `yaml`, `zod`. 60 archivos `tests/*.test.ts` y 17 pruebas de aceptación. Método: lectura. VERIFIED. Limitación: no se ejecutó la suite.

**EV-STUDIO-EV-002 — Code Intelligence solo TS/JS.** `src/codeintel/native/indexer.ts:12` (`SOURCE_GLOB`), 441 líneas; `store.ts` 297 líneas. Grafo en `.evol/codegraph.sqlite` (tablas `files`, `nodes`, `edges`; aristas IMPORTS/CALLS/EXTENDS/CONTAINS/EXPORTS/TESTS/MODIFIES). Id de símbolo `ruta#nombre`. VERIFIED. Impacto: no cubre C++/QML/CMake/Python/Rust.

**EV-STUDIO-EV-003 — Las consultas escriben.** `src/codeintel/native/provider.ts:34-42` (`use()` llama a `indexProject`), `store.ts:54-59` (WAL + DDL en el constructor). VERIFIED (lectura). Impacto: la «lectura» del grafo no es de solo lectura; choca con un Control Center que debe poder consultar sin efectos.

**EV-STUDIO-EV-004 — MCP sin anotaciones.** `src/commands/mcp.ts`: 13 herramientas; `grep readOnlyHint|annotations` sin resultados. `evol_index`, `evol_memory_add`, `evol_checkpoint` escriben; el MCP se anuncia como «de solo lectura» en `evol --help`. VERIFIED. Estado: CONTRADICTORY entre ayuda y comportamiento.

**EV-STUDIO-EV-005 — Cadena de aprobaciones verificada en `approve` y `next`.** `src/core/pipeline.ts:184` y `:229` llaman a `verifyChain` (HMAC encadenado, `gate.ts`); `findValidApproval` compara hashes de artefactos y ciclo (`:236`). VERIFIED (lectura). Limitación: la cadena no se ejecutó sobre el log real.

**EV-STUDIO-EV-006 — `state.json` no se concilia con el registro firmado.** `pipeline.ts:156-159` toma `currentPhase` de `state.json`; no se encontró una función que compruebe que las fases anteriores a `currentPhase` tienen aprobación vigente en el log. Un actor con escritura en `.evol/state.json` podría colocar una fase posterior y aprobarla (la aprobación sigue exigiendo una persona en TTY). INFERRED por ausencia de código; requiere una prueba en entorno aislado. Impacto: el «estado declarado» y el «estado verificado» (§10.3) no coinciden por diseño.

**EV-STUDIO-EV-007 — Sin bloqueo de archivos.** `grep flock|O_EXCL|lockfile` en `src/` solo devuelve lockfiles de npm. VERIFIED (ausencia). SQLite WAL sin `busy_timeout`. Impacto: concurrencia de varios agentes sin garantías.

**EV-STUDIO-EV-008 — No hay modelo de tareas de ejecución.** Las menciones a «task» en `src/` están en `checkpoint.ts`, `agents/adapters.ts`, `agents/roles.ts` y `docs/sprints.ts` (conteo de tareas de documentación de sprint). No existe scheduler ni DAG de tareas. VERIFIED (ausencia). `docs/comparativas/gentle-ai.md` declara que el tope de concurrencia «no está construido».

**EV-STUDIO-EV-009 — Registro de aprobaciones.** `.evol/gate-log.jsonl`: 14 entradas antes de esta sesión, 2 ciclos completos; ciclo 3 abierto el 2026-11-16 (`seq` 14). VERIFIED. Fuera del registro: no hay entradas de rechazo.

**EV-STUDIO-EV-010 — Configuración.** `evol.config.json`: `codeIntel: "native"`, `memory.wing: "evol_driven"`, `qa.requireTestsForChangedSymbols: false`, `qa.requireCriteriaCoverage: true`. VERIFIED. El control símbolo↔prueba del grafo está apagado.

**EV-STUDIO-EV-011 — Cobertura CA-n por referencia.** Notas de la auditoría previa (Engram #81, #85) y lección CA-146 (falso bloqueo por versión del verificador). DOCUMENTED; `coverage.ts` no se releyó en esta sesión.

### Memoria existente

**EV-STUDIO-EV-012 — MemPalace.** Estado: 16 430 cajones al inicio de la sesión (16 676 al cierre), integridad SQLite OK, motor Chroma, v3.11.0 instalado (última publicada 3.12.0). En el wing del proyecto, ≈90 % son transcripciones importadas (3 sesiones de Claude Code) y ≈29 elementos curados. Rutas: `~/.mempalace/palace/chroma.sqlite3`. VERIFIED (consulta `mode=ro`).

**EV-STUDIO-EV-013 — Engram.** v3.6.0 instalado (última 3.7.2), `~/.engram/engram.db`, 108 observaciones (82 «passive»), tablas de versiones y relaciones. VERIFIED. Almacén **distinto** del de MemPalace.

**EV-STUDIO-EV-014 — Historial de Evol OS como evidencia de fallas.** 651 commits en 13 días (332 en 2 días); 8 ciclos de pipeline; QA ronda 1→4; lecciones RF-1…12 en `~/Projects/Evol-OS/investigacion/fallas-agente-constructor/`. VERIFIED (conteos con `git log` y `gate-log`); las causas son INFERRED.

### DeepSeek Harness (R1)

**EV-STUDIO-EV-015 — Versión y estabilidad.** `package.json`: `@deepseek-ai/dsh-root` 0.2.2-rc.3, Node ≥24.9.0, MIT. `AGENTS.md`: «Public APIs are pre-stable; update every consumer». `SAFETY.md`: «experimental developer-preview software… has not undergone a security audit… must not be treated as secure or production-ready». VERIFIED. Impacto: toda dependencia debe fijarse por versión y tener salida.

**EV-STUDIO-EV-016 — Arquitectura todo-plugin.** `docs/architecture.md`: Cordis; un `dsh` en ejecución es un árbol de plugins compuesto por capas (perfil → bundles → `cordis.patch.yml` → parche del home → `--patch`). Perfiles: `web`, `headless`, `sdk`, `sdk-minimal`, `acp`; `desktop` reservado. Un bundle se declara en `package.json` bajo `dsh.bundle.patch`. VERIFIED (doc + `packages/bundle/web-app/package.json:49`).

**EV-STUDIO-EV-017 — Host/Client.** `docs/cookbook/adding-a-remote-api.md`: servicio host que extiende `TypertRemoteService` con `@Remote`; cliente consume. `packages/client/ui-slots`: los plugins de cliente registran componentes en *slots* declarados por el padre; declarar un slot es reclamarlo. VERIFIED (doc). No se ejecutó ningún plugin.

**EV-STUDIO-EV-018 — Desktop sin objetivo Linux.** `apps/desktop/scripts/package-target.ts:51`: `DesktopPackageTargetName = 'mac-arm64' | 'mac-x64' | 'win-x64'`; `package.json` solo define scripts de empaquetado mac y win. El README menciona Linux solo para el entorno de arranque GUI (línea 188). VERIFIED. Impacto: la edición Desktop sobre Arch **no existe en origen**.

**EV-STUDIO-EV-019 — Sandbox.** `docs/subsystems/sandbox.md`: backends con reporte de cumplimiento `full`/`partial`; menciona bwrap, Landlock, Seatbelt y ACL de Windows. DOCUMENTED; el propio SAFETY avisa de que no garantiza aislamiento.

**EV-STUDIO-EV-020 — Equipos de agentes en el núcleo.** `packages/team` (`agent-team`, `tool-agent-team`): tablero de tareas con dependencias, selección guardada por sesión raíz, replay desde el log de sesión. `docs/subsystems/agent-team.md`. DOCUMENTED.

**EV-STUDIO-EV-021 — Telemetría/analítica del Desktop.** `apps/desktop/README.md`: analítica de producto y peticiones a una «Platform API» con cabeceras de cliente; comprobación de actualizaciones. DOCUMENTED. Impacto: «local-first» exige revisar y desactivar estas conexiones en la edición Evol.

### AgentTeams, memorias y code memory (R2/R4)

**EV-STUDIO-EV-022 — dsh-agent-teams.** v0.1.30, MIT. 14 herramientas, scheduler automático de tareas compartidas, estado persistente, panel Web. Host recomendado `0.2.1-rc.2`; la tabla de compatibilidad llega a `0.2.2-rc.2` como «Preview»; el HEAD de Harness es `0.2.2-rc.3` (**no listado**). Los *quality gates* son opt-in y el control de alcance es «una auditoría al completar, no una interceptación de escritura del host». VERIFIED (README).

**EV-STUDIO-EV-023 — Mnemon (motor).** Go, Apache-2.0, `modernc.org/sqlite`, datos en `~/.mnemon` (`MNEMON_DATA_DIR`), almacenes con nombre (`MNEMON_STORE`), cuatro grafos, deduplicación exacta, retención con decaimiento, importación, recibos hash para auditoría, interfaz web local `mnemon web` (127.0.0.1:8484). Embeddings **opcionales**; por defecto apunta a `http://localhost:11434` (Ollama) o a un servidor compatible con OpenAI configurable. «LLM-supervised»: el LLM anfitrión decide qué recordar. VERIFIED (README, `go.mod`, `internal/memory/embed`). Limitación: no se ejecutó.

**EV-STUDIO-EV-024 — Conexiones salientes de Mnemon.** `grep http.NewRequest|http.Client` en `cmd/` e `internal/`: clientes HTTP para embeddings configurados, `/health` local, vigilancia AML y un proveedor de agente de memoria con endpoint configurable. No se encontró telemetría. VERIFIED solo para esos patrones de búsqueda; UNVERIFIED que no exista otra vía.

**EV-STUDIO-EV-025 — dsh-mnemon.** v0.5.46, MIT; tres tipos de memoria (runtime, documentos de proyecto, espacios de memoria con *providers*: Mnemon Native local u ocho de terceros); almacenamiento global, por workspace o en un directorio; copia ZIP; WebUI «Memory System»; `fetch` de versiones al registro npm desde `src/host/version-updates.ts:287` (invocado por «Check versions»; si es automático: UNVERIFIED); compatible con DSH `0.2.2-rc.1` y rangos 0.2.x. VERIFIED (README, `package.json`, código).

**EV-STUDIO-EV-026 — Codebase Memory MCP.** MIT, backend nativo en C, 17 herramientas MCP, 164 gramáticas tree-sitter vendorizadas (incluyen `qml` y `cmake`), **Hybrid LSP** (resolución de tipos) solo para Python, TS/JS, PHP, C#, Go, C/C++, Java, Kotlin, Rust, Perl. Sus propios benchmarks (64 repos, métrica no auditada): C++ «Excelente ≥90 %», TS/Rust «Bueno 75–89 %». Sin pasada semántica para QML ni CMake. Índices persistentes en `~/.cache/codebase-memory-mcp`; vigilante de cambios solo para proyectos git. DOCUMENTED (README) + VERIFIED (manifiesto de gramáticas). Las cifras de rendimiento (Linux kernel en 3 min, Apple M3 Pro) son del autor y no se reprodujeron.

**EV-STUDIO-EV-027 — Instalación y daemon de CBM.** README: el instalador configura agentes y hooks por defecto (`--no-hooks` los quita); un daemon por cuenta se comparte entre clientes; las actualizaciones se hacen con el script de instalación. DOCUMENTED. Impacto: modifica configuración de agentes (conflicto con la invariante de no tocar configuración sin autorización) y comparte estado entre proyectos.

**EV-STUDIO-EV-028 — Sin telemetría en CBM (búsqueda acotada).** `grep telemetry|posthog|sentry|analytics|mixpanel` en `src/` e `internal/`: solo coincidencias con spans de OpenTelemetry (`traces.h`) y estructuras de proceso de Windows. VERIFIED para esa búsqueda; UNVERIFIED la red real en ejecución.

**EV-STUDIO-EV-029 — dsh-codebase-memory-mcp.** 0.1.10, MIT, puente que lanza el binario y registra 6 herramientas en DSH; UI del grafo en `http://localhost:9749/`; las herramientas **no indexan por sí solas**. DOCUMENTED.

**EV-STUDIO-EV-031 — Engram (código fuente, `8a4ce2d`).** Go, MIT, un binario; datos en `~/.engram` (`ENGRAM_DATA_DIR` absoluto lo reemplaza); SQLite local autoritativo; sincronización por Git (chunks comprimidos) y **Engram Cloud opcional** (réplica con token). Conexiones salientes encontradas en `internal/`: comprobación de última versión contra `api.github.com` (`internal/version/check.go`, desactivable con `ENGRAM_NO_UPDATE_CHECK`), y los clientes de Cloud (`internal/cloud/remote`, `tui/cloud.go`) que solo se usan si se configura. VERIFIED por lectura de esos archivos; no se ejecutó. Impacto: la comprobación de versión es una conexión saliente **por defecto** que hay que desactivar para cumplir «sin red».

### Entorno y efectos secundarios

**EV-STUDIO-EV-030 — Hooks y efectos de esta sesión.** (a) Hook `SessionStart` de evol (solo lectura). (b) Auto-minado de transcripciones a MemPalace: el wing `evol_driven` pasó de 2786 (al inicio de la sesión) a 3027 cajones (consulta de cierre), incluida la transcripción de esta sesión (`source_file …/885d2a18-….jsonl`). (c) Las instrucciones del MCP de Engram piden guardar memorias automáticamente; **no** se escribió en Engram. (d) Escrituras en el repositorio: solo `docs/research/evol-driven-studio/` en la rama `feat/evol-driven-studio`, sin commits. (e) Clones superficiales en el scratchpad de la sesión. Por tanto, la ejecución **no fue completamente de solo lectura** respecto de MemPalace.
