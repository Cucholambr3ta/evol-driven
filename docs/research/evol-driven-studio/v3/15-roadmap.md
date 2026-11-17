# 15 — Roadmap verificable (H0–H10, v3)

Secuencia provisional del encargo, **ajustada por dependencias reales**. Sin horas ni fechas (no hay base técnica). Tamaños relativos S/M/L/XL. Ningún hito está en PASS: ninguno se ha ejecutado. Sustituye al roadmap del doc 13 anterior (C-10); conserva sus correcciones de núcleo dentro de H0.

**Cambios v3:** (a) H7 ya **no** admite «volver a `evol approve` por terminal» como rollback (H-01): el rollback es *fallo cerrado* y recuperación del broker; (b) los prerequisitos se clasifican en inicio de Tanda 1, preparación de la skill, primer plugin propio, primera vista de solo lectura, integración de agentes, operaciones mutantes, aprobaciones y distribución estable (§Hitos de control), de modo que **ninguna condición de una etapa posterior bloquea tareas independientes anteriores**; (c) la ausencia de `dsh-doc` ya no bloquea la Tanda 1 (H-03).

**Ajustes respecto a la secuencia del encargo (v2, vigentes):** (1) las brechas de lectura segura y de estado↔log del núcleo se mueven a **H0**, porque H2 y H7 las necesitan; (2) la skill fundacional se prepara **dentro de la Tanda 1** (no la bloquea) y es prerrequisito del **primer plugin propio**, no del inicio de la tanda (H-03); (3) los **estados de evidencia** (H6) se adelantan a H3 como mínimo viable, ya que el puente de evidencia de AgentTeams los necesita; (4) H7 (aprobación visual) se mantiene tardío por riesgo, pero su **diseño y pruebas negativas** empiezan en H0.

| H | Objetivo | Depende de | Tamaño |
|---|---|---|---|
| H0 | Baseline y contratos del núcleo | decisiones OD-01, 02, 15, 16 | L |
| H1 | Integración mínima Cordis ↔ Evol | Tanda 1 + H0 | M |
| H2 | Project Manager y Pipeline Explorer (solo lectura) | H1 | M |
| H3 | AgentTeams y subagentes | H1, H0 (evidencia mínima) | L |
| H4 | Memoria y Code Intelligence comunitarios | Tanda 1, H0 | L |
| H5 | Model Routing | H3 | M |
| H6 | Quality & Evidence completo | H0, H3 | L |
| H7 | Approval Broker y autorización visual | H0, H2, H6 | XL |
| H8 | Operaciones CLI restantes en UI | H2–H7 | L |
| H9 | Plugin Edition reproducible | H1…H8 | M |
| H10 | Desktop Edition | H9 + decisión OD-06 | XL |

## Detalle por hito

**H0 — Baseline y contratos.** *Entradas:* repo `47a93c8`; suites de caracterización. *Salidas:* paquete `core` con esquemas JSON versionados; CLI `--json` congelado; MCP separado en lectura/escritura con anotaciones; consultas del grafo de solo lectura con `freshness`; verificación estado↔log; lock de `.evol/`; `verifier_version`; sección calculada de checkpoint; trailer `CA:`; registro de rechazos. *Contratos:* `Project, Pipeline, Approval, Evidence, TaskRef, MemoryItem, Symbol`. *Pruebas:* caracterización del comportamiento actual; contratos; salto de fase detectado; consultas sin escritura (hash antes/después); `evol` y `evol-dev`. *Permisos:* ninguna operación nueva de aprobación. *Evidencia:* salidas de pruebas con hash. *Aceptación:* suite verde, `verify` PASS, aprobación humana. *Riesgos:* regresión, falsos bloqueos. *Rollback:* interruptores de configuración y revert por commit.

**H1 — Cordis mínimo.** *Entradas:* informe de Tanda 1. *Salidas:* plugin host `studioBridge` con **una** lectura (`status`) y un panel mínimo. *Pruebas:* carga/descarga 10 veces sin huérfanos; sin red; el cliente no accede a `.evol/`. *Aceptación:* las tres anteriores + revisión independiente. *Bloqueo:* si un plugin host no puede aislar el log firmado, replantear dónde corre el núcleo. *Rollback:* quitar el plugin del perfil.

**H2 — Project Manager y Pipeline Explorer.** *Salidas:* selección de proyecto y vista de fase **declarada vs. verificada**, aprobaciones vigentes, hashes, historial. *Pruebas:* edición de `state.json` mostrada como inconsistencia; proyectos aislados. *Permisos:* Reader. *Aceptación:* ninguna cifra sin fuente; estados vacíos reales.

**H3 — AgentTeams y subagentes.** *Salidas:* `agentTeamsAdapter`, `TaskRef`, Work Manager y Agent Center de lectura, creación/cancelación con permiso, catálogo de roles bajo demanda. *Pruebas:* mapeo de estados real↔UI; reinicio con tarea `in_progress` queda `incierta`; reintento idempotente; sin segundo scheduler. *Bloqueo:* AgentTeams no carga en la versión fijada → usar `team` nativo. *Rollback:* desactivar adaptador.

**H4 — Memoria y código.** *Salidas:* adaptadores y workers (doc 08); frescura visible. *Pruebas:* aislamiento por proyecto, red cero, restauración, vigencia, comparación del motor nativo con CBM sobre los repositorios de prueba. *Aceptación:* condiciones de entrada de seguridad de CBM y umbrales del benchmark aprobados **antes** de ejecutar. *Rollback:* `codeIntel: native` y proveedor de memoria anterior.

**H5 — Model Routing.** *Salidas:* política por fase/rol/subagente, adaptador por versión de Harness, registro del modelo efectivo. *Pruebas:* precedencia, no alteración del modelo global, esfuerzo incompatible rechazado, contingencia remota bloqueada, presupuesto agotado → `failed`.

**H6 — Quality & Evidence.** *Salidas:* matriz CA→prueba→resultado→commit con 5 estados de evidencia; hallazgos de revisores; cobertura de símbolos modificados (activar `requireTestsForChangedSymbols` como aviso). *Pruebas:* una prueba que no ejerce el fixture queda en «referencia encontrada»; un LLM no cuenta como ejecución.

**H7 — Approval Broker.** *Salidas:* broker, Approval Center con el flujo unificado «Autorizar avance» (aprobación y transición como operaciones y registros separados, H-05), política de fallo cerrado y procedimiento de recuperación (doc 11 §5–6). *Pruebas:* P-03…P-09, P-15, P-16, P-17 del doc 11; revisión de seguridad independiente. *Aceptación:* **ninguna** vía documentada ni probada por la que un agente apruebe o avance eludiendo el broker; decisión del factor de presencia humana aprobada. *Rollback:* **no se vuelve a `evol approve` por terminal ni a ningún comando histórico sin las mismas garantías.** Si el broker falla: las operaciones protegidas permanecen **bloqueadas**; se permiten consulta, diagnóstico, logs, recuperación de servicios y restauración de configuración validada; el servicio se restablece con el procedimiento del doc 11 §6. Una vía de emergencia solo con garantías equivalentes, aislada del agente y con autorización explícita registrada; no existe bypass genérico.

**H8 — CLI restante.** *Salidas:* filas pendientes del inventario (doc 10) con prueba de equivalencia UI↔CLI↔MCP. *Aceptación:* misma lógica y mismo registro.

**H9 — Plugin Edition.** *Salidas:* bundle y perfil `evol-studio` con versiones y hashes fijados, asistente de instalación con `--solo-comprobar`, reversión. *Pruebas:* instalación y retirada en `DSH_HOME` limpio; sin sobrescribir perfiles; escaneo de secretos del paquete; red cero.

**H10 — Desktop.** *Prerrequisito:* decisión OD-06 y formato Linux (Harness no tiene objetivo Linux, EV-018). *Aceptación:* los mismos componentes; sin fork salvo ADR justificado.

## Hitos de control (qué gatilla cada etapa)

| Etapa | Qué se necesita | Qué **no** se necesita |
|---|---|---|
| Inicio de la Tanda 1 | versión candidata fijada, `DSH_HOME` aislado, política de red | skill fundacional, `dsh-doc`, broker |
| Preparación de la skill (OD-21) | entorno de Tanda 1 y fuentes 1–3 del doc 12 comprobadas | primer plugin, Evol-Core corregido |
| Primer plugin propio | skill **validada** | broker, memoria |
| Primera vista de solo lectura (H2) | H0 (lectura segura, estado↔log) y H1 | AgentTeams, aprobación |
| Integración de agentes (H3) | H1, evidencia mínima de H0, AgentTeams probado | broker |
| Activación de operaciones mutantes | tabla de permisos (doc 10) y pruebas P-01/P-02/P-14 | broker (las operaciones OP siguen bloqueadas) |
| Activación de aprobaciones (H7) | broker, P-03…P-17 | — |
| Publicación estable (H9/H10) | matriz de compatibilidad «probada», licencias, red cero | — |

## Condiciones de bloqueo generales

AgentTeams incompatible (H3); un componente comunitario falla la prueba de red o modifica configuración ajena (H4); no hay mecanismo de presencia humana robusto (H7).
