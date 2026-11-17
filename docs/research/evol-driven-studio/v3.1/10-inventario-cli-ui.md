# 10 — Inventario CLI → UI con permisos basados en efectos reales (v3.1; corrige H-02)

Sustituye al inventario v2. Base: `evol --help` (36 comandos) y análisis estático de `src/` (EV-042, EV-048, EV-049): búsqueda de escrituras, procesos y red en cada módulo y lectura de los casos dudosos. **No se ejecutó ningún comando**; las clasificaciones marcadas *provisional* se confirman con la prueba de «hash antes/después» (doc 11 §9, prueba P-12).

**v3.1:** (a) la clasificación de las herramientas MCP se **eleva a enmienda normativa** (AMD-01); (b) se añaden las operaciones del checklist (`review.*`, doc 21) y del Repository Explorer (`repo.*`, doc 22) y las del broker (`enroll_credential`, `rotate_key`, `revoke_*`, `reset_approvers`: OP, solo broker); (c) `approve`, `next`, `ciclo nuevo`, `skills approve` y `disciplines enable/disable` usan WebAuthn + Ed25519.

| Operación | Efecto | Permiso |
|---|---|---|
| `review.list`, `review.get`, `review.export` | LP (prov.) | Reader |
| `review.mark`, `review.comment`, `review.reopen` | EP (eventos del checklist) | Approver / Reviewer, **solo sesión humana**; sin equivalente CLI |
| `repo.*` (Git local) | LS | Operator (Reader sobre vista guardada) |
| `repo.*` (GitHub) | LS + red | Operator, con indicador de salida de datos |
| `broker.enroll/rotate/revoke/reset` | OP | solo broker, con ceremonia |

## 1. Reglas de clasificación

**Clases de efecto:** LP lectura pura · LS lectura con efectos secundarios (lanza procesos de solo consulta, consulta red, consume recursos) · ED escritura derivada (cachés, índices, informes regenerables) · EP escritura persistente (registros, estado, memoria, archivos del proyecto) · XP ejecución de procesos externos o de comandos definidos por configuración · MC modificación de configuración · OP operación privilegiada (aprobación, transición, ciclo).

**Reglas de asignación de permiso:**
1. **Reader** solo si la operación es LP, con evidencia estática (módulo y llamadas directas sin escritura, procesos ni red) **y** prueba dinámica pendiente anotada. No se asigna Reader por el mero hecho de no tocar `state.json`.
2. Una operación **no verificada** se restringe a **Operator** (o superior) hasta probarla.
3. **Consultar un resultado registrado** y **ejecutar de nuevo** son operaciones distintas: la primera puede ser Reader; la segunda, Operator o superior.
4. **Operaciones OP** no existen como herramienta de agente: solo las invoca el Approval Broker (doc 11).
5. Una sola tabla de permisos (en `core`) la consumen CLI, MCP y Control Center; una prueba de equivalencia compara las tres.

Permisos: R Reader · O Operator · V Reviewer · P Approver (vía broker) · A Administrator.

## 2. Hallazgos que cambian la clasificación v2

| Comando | v2 | v3 | Evidencia |
|---|---|---|---|
| `verify` (momento «fin») y `handoff` | Reader | **Operator, XP**: ejecuta `spawnSync(command, {shell: true, timeout: 600 s})` con los comandos de `comandos` en `evol.config.json` (p. ej. `npm run ci`) | EV-048 |
| herramienta MCP `evol_verify` | sin anotar | **no es de solo lectura** (ejecuta comandos); se divide en `evol_verify_inicio` (lectura) y `evol_verify_ejecutar` (Operator) | EV-048 |
| `doctor` | Reader | **Operator, LS**: lanza `--version` de herramientas, `git remote get-url` (plazo 20 s) y puede consultar red por el aviso de versión | EV-049, EV-055 |
| `impact`, `trace` | Reader | **Operator, ED**: reindexan antes de consultar (hasta H0) | EV-003 |
| `lessons` | Reader | **Operator, LS**: subproceso MCP de MemPalace y **lectura multiproyecto** por diseño | EV-049 |
| `memory search`, `knowledge search` | Reader | **Operator, LS** (subproceso; endpoint de embeddings configurable) hasta probar su aislamiento por proyecto | EV-049 |
| `interrogate` | Operator | **Reviewer**: registra que el plan se interrogó; no puede hacerlo el autor del plan | diseño |
| `disciplines enable/disable` | Administrator | **Administrator vía broker**: cambia la configuración y **invalida aprobaciones** | `disciplines-change.ts` |
| `status`, `prerequisites`, `coverage`, `risk`, `export` | Reader | **Reader (provisional)**: módulos sin escrituras ni procesos en la búsqueda; prueba dinámica pendiente. Nota: `status` verifica la cadena del registro leyendo la clave; esa lectura la hace Core, nunca un agente | EV-049 |

## 3. Matriz CLI → operación → efecto → recursos → permiso → acción visual → prueba

Columnas de recursos: **L** archivos leídos · **E** archivos escritos · **P** procesos externos · **N** red · **C** configuración afectada · **Ev** evidencia producida · **R/C** reintento / concurrencia. «—» = no encontrado en el análisis estático (no equivale a probado).

| CLI | Operación backend | Efecto | L | E | P | N | C | Ev | R/C | Permiso | Acción visual | Prueba de autorización |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `status` | `pipeline.status` | LP (prov.) | `.evol/state.json`, registro, config, artefactos | — | — | — | — | — | reintento libre; sin riesgo | R | panel de pipeline | P-01 |
| `prerequisites` | `pipeline.prerequisites` | LP (prov.) | artefactos | — | — | — | — | — | libre | R | lista | P-01 |
| `verify --inicio` | `pipeline.verify.static` | LP con cómputo (prov.) | artefactos, árbol del módulo | — | — | — | — | veredicto (no se persiste) | libre | **O** hasta probar no-escritura; reclasificable a R | botón «Verificar estructura» | P-12 |
| `verify` (fin) | `pipeline.verify.run` | **XP** | artefactos, código | lo que escriban las pruebas del proyecto | comandos de `comandos` (shell) | las pruebas pueden usar red | no | veredicto + salida (últimas 15 líneas) | **no idempotente**; concurrencia: dos ejecuciones comparten el árbol | **O** | botón «Ejecutar verificación» con aviso de qué comandos correrá | P-02 |
| (nuevo) | `pipeline.verify.result` | LP | último resultado **registrado por Studio** | — | — | — | — | — | libre | **R** | tarjeta «último resultado» | P-01 |
| `approve` | `approval.authorize` | **OP** | artefactos, registro | `gate-log.jsonl` | — | — | — | entrada firmada | idempotencia por `nonce` | **P** (broker) | **Autorizar avance** (doc 11) | P-03…P-09 |
| `next` | `pipeline.advance` | **OP** | registro, estado | `state.json`, journal | — | — | — | evento | solo tras aprobación vigente | **P** (broker; no accesible a agentes) | parte del flujo unificado | P-03 |
| `ciclo nuevo` | `pipeline.cycle.open` | **OP** | estado | `state.json`, registro | — | — | — | entrada | una vez | **P** (broker) | asistente con confirmación | P-03 |
| `interrogate` | `plan.interrogate.record` | EP | plan | `plan-interrogado.json`, journal | — | — | — | registro | reintento seguro | **V** | formulario en el plan | P-10 |
| `new` | `project.create` | EP+XP | — | árbol nuevo | `git`, `npm` | **sí** (instalación) | — | — | no idempotente | **O** (raíces autorizadas) | asistente | P-11 |
| `init` | `project.adopt` | EP | proyecto | `.evol/`, config, archivos de agentes | `git` | — | **sí** (crea config) | — | no idempotente | **O** | asistente | P-11 |
| `memory add` | `memory.propose` | EP | — | MemPalace (subproceso MCP) | MemPalace | — | — | recuerdo con fuente | duplicados | **O** | formulario | P-02 |
| `memory search` | `memory.search` | LS | MemPalace | — | subproceso | embeddings locales | — | — | libre | **O** (prov.) | buscador | P-13 |
| `lessons` | `memory.lessons.search` | LS | MemPalace (multiproyecto) | — | subproceso | — | — | — | libre | **O** con filtro de proyecto | buscador | P-13 |
| `index` | `code.index` | EP/ED | código fuente | `.evol/codegraph.sqlite*` | — | — | — | frescura | lock necesario (hoy no existe) | **O** | «Actualizar índice» | P-02 |
| `impact`, `trace` | `code.query` | **ED** hoy; LP tras H0 | código | índice (hoy) | — | — | — | — | idem | **O** hoy; **R** tras H0 y su prueba | explorador | P-12 |
| `coverage` | `quality.coverage` | LP (prov.) | specs, pruebas | — | — | — | — | matriz | libre | R | matriz | P-01 |
| `risk` | `quality.risk` | LP (prov.) | árbol | — | — | — | — | — | libre | R | tabla | P-01 |
| `export` | `project.export` | LP (prov.) | proyecto | stdout | — | — | — | JSON | libre | R | «Exportar» (descarga) | P-01 |
| `report` | `report.build` | **ED** | proyecto | DOCX/PDF/MD en disco | conversores | — | — | informe | regenerable | **O** | formulario + descarga | P-02 |
| `diagrams` | `diagrams.build` | ED | proyecto | SVG (PNG con herramienta) | conversores | — | — | diagramas | regenerable | **O** | botón + visor | P-02 |
| `disciplines list/profiles/suggest` | `disciplines.read` | LP (prov.) | config | — | — | — | — | — | libre | R | tabla | P-01 |
| `disciplines enable/disable` | `disciplines.change` | **MC** + invalidación | config | `evol.config.json`, journal | — | — | **sí** | evento | invalida aprobaciones | **A** (vía broker) | interruptor con aviso de invalidación | P-03 |
| `skills list/export` | `skills.read` | LP/LS (prov.) | biblioteca | — | — | — | — | — | libre | O (prov.) | tabla | P-13 |
| `skills check`, `audit` | `skills.audit` | **XP** | skill | informes | semgrep, gitleaks | — | — | informe de auditoría | regenerable | **O** | botón «Auditar» | P-02 |
| `skills approve` | `skills.approve` | **OP** | skill | cuarentena/aprobación | — | — | — | aprobación | idempotente | **P** (broker) | diálogo de aprobación | P-03 |
| `skills install/uninstall` | `skills.install` | EP+MC | origen | biblioteca | `git` | **sí** (origen remoto) | **sí** | — | no idempotente | **A** | asistente con vista previa | P-11 |
| `security scan` | `security.scan` | **XP+EP** | árbol | `.evol/qa/security/ultimo.json`, informe | escáneres | según herramienta | — | informe | regenerable | **O** | botón + lista (sin valores de secretos) | P-02 |
| `knowledge source/review` | `knowledge.write` | EP | fuentes | índice/registro del conocimiento | — | posible (descarga de fuente) | **sí** | — | — | **A** | formulario | P-11 |
| `knowledge search` | `knowledge.search` | LS | índice | — | — | endpoint de embeddings configurable | — | — | libre | **O** (prov.) | buscador | P-13 |
| `docs check/evidencia` | `docs.check` | LP (prov.) | `docs/` | — | — | — | — | hallazgos | libre | R (prov.) | botón + tabla | P-12 |
| `sprint check/estado` | `sprint.read` | LP (prov.) | `docs/` | — | — | — | — | — | libre | R (prov.) | tablero | P-12 |
| `agents` | `agents.refresh` | **MC** | proyecto | archivos de IDE **del proyecto** y respaldos; los archivos de usuario **se imprimen, no se escriben** (spec Amp. 4, documentado) | — | — | **sí** (archivos de agentes del proyecto) | respaldo | reversible (`--deshacer`) | **A** | asistente con diff previo | P-11 |
| `checkpoint` | `checkpoint.save` | EP | git, estado | `.evol/checkpoint.*` | `git` | — | — | punto de control | reintento seguro | **O** | botón | P-02 |
| `handoff` | `handoff.create` | **XP+EP** | idem + verify | checkpoint + resultado | `git`, comandos de verify | — | — | traspaso | no idempotente | **O** | diálogo | P-02 |
| `mejora` | `improve.*` | EP (fuera del proyecto) | buzón del usuario | `~/.config/evol/mejoras/buzon.jsonl` | — | — | — | — | — | **O** | lista + formulario | P-11 |
| `update` | `framework.update` | **XP+EP+N** | repo | versiones instaladas | `git`, `npm` | **sí** | — | verificación de firma y sumas | no idempotente; reversible (`--volver`) | **A** | asistente | P-11 |
| `release` | `framework.release` | **XP+EP** | repo | commit y etiqueta firmada (no sube) | `git`, CI | — | — | etiqueta | no idempotente | **A** | acción avanzada | P-11 |
| `version` | `framework.version` | LS | instalación | — | `git` | — | — | — | libre | R sobre valor guardado; recalcular = O | tarjeta | P-13 |
| `setup` | `setup.run` | **XP+EP+N** | sistema | biblioteca/herramientas | instaladores | **sí** | **sí** | — | no idempotente | **A** | asistente | P-11 |
| `doctor` | `diagnostics.run` | **LS** | claves, registro, config | — | `--version` y `git` | aviso de versión (1 vez al día) | — | hallazgos | libre | **O** | «Diagnosticar» | P-02 |
| `mcp` | `mcp.status` | LP (estado) | — | — | servidor stdio | — | — | tabla de herramientas con anotación | — | R (estado); iniciar/parar = A | panel | P-01 |
| `hook` | interno | LP | estado, checkpoint | — | — | — | — | — | — | no se expone | — | — |

## 4. Herramientas MCP: anotación real

| Herramienta | Efecto real | Anotación v3 |
|---|---|---|
| `evol_status`, `evol_prerequisites`, `evol_disciplines` | LP (prov.) | solo lectura *(tras P-12)* |
| `evol_verify` | **XP** si «fin» | **retirar el modo «fin»**; `evol_verify_inicio` = lectura; `evol_verify_ejecutar` = escritura/ejecución, Operator |
| `evol_find_symbol`, `evol_impact`, `evol_trace` | ED hoy | **escritura** hasta H0; luego solo lectura |
| `evol_index` | EP | escritura |
| `evol_lessons`, `evol_memory_search`, `evol_knowledge_search` | LS | escritura/efectos (no «solo lectura») hasta probar |
| `evol_memory_add`, `evol_checkpoint` | EP | escritura |
| `approve`, `next`, `ciclo nuevo` | OP | **no existen como herramientas MCP** (se mantiene) |

Se corrigen también la ayuda de la CLI («Servidor MCP de solo lectura») y el criterio 22 de la especificación (EV-051), que hoy afirman lo que el código no cumple.

## 5. Observaciones

1. **Una sola tabla de permisos** en `core`; CLI, MCP y UI la importan. Prueba de equivalencia: el mismo actor con el mismo rol recibe la misma respuesta en las tres vías (P-14).
2. **Frecuentes que pasan a visual primero:** status, verificación (resultado), autorizar avance (flujo unificado), impacto, cobertura, checkpoint, diagnóstico, índice, escaneo de seguridad, memoria.
3. **Ejecutar comandos de la configuración** (`verify`, `handoff`, `evol_verify`) obliga a mostrar al operador **qué comandos** va a correr y desde qué configuración (cuyo hash está en la aprobación vigente; si cambia, la aprobación se invalida).
4. **Pendiente (H8):** recorrer subcomandos y opciones exactos en el código y completar `--json`; convertir las clasificaciones *provisional* en definitivas con las pruebas P-12/P-13.
