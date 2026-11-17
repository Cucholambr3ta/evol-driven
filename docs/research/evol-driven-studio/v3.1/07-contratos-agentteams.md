# 07 — Contratos AgentTeams ↔ Evol-Driven (v3.1)

**v3.1:** la versión de AgentTeams es la **0.1.30 ratificada** (OD-09) sobre DSH `0.2.1-rc.2`; la prueba de compatibilidad real es C-T1-01/02/09 (doc 27 §6). Un miembro **no lanza otro miembro** (AMD-02, P-34).

Principio: **referencias, no copias.** El estado de ejecución vive en AgentTeams; Evol guarda una referencia con identidad, vigencia y evidencia, y **calcula** lo que AgentTeams no expone. No se inventan estados de AgentTeams.

## 1. `TaskRef` (registro que Evol conserva por trabajo)

| Campo | Fuente | Nota |
|---|---|---|
| `project_id` | Studio | aislamiento |
| `phase`, `ciclo` | Core | |
| `external_task_id` | AgentTeams | id de tarea |
| `run_id`, `attempt` | AgentTeams / Studio | un intento por ejecución |
| `agent_id`, `role` | AgentTeams | miembro y rol |
| `provider`, `model`, `reasoning_effort` | resolución de Model Routing | **efectivos**, sin secretos |
| `commit_sha` | Git al iniciar y al terminar | revisión Git |
| `objective`, `acceptance_refs[]` | plan | CA que el trabajo busca cumplir |
| `depends_on[]` | AgentTeams | ids de tareas |
| `result` | AgentTeams | resumen + artefactos |
| `evidence[]` | Core | `evidence_id` de comandos ejecutados |
| `created_at`, `started_at`, `ended_at` | AgentTeams | |
| `validity` | **Core** | vigente / obsoleta (cambió un artefacto aprobado o el commit base) |
| `errors[]` | AgentTeams/Core | |

## 2. Mapa de estados reales a estados de la UI

| Estado AgentTeams (real, EV-037) | Estado mostrado | Cálculo |
|---|---|---|
| `pending` | Pendiente | directo; **Bloqueada** si hay dependencias sin `completed` (derivado) |
| `claimed` | Asignada | directo |
| `in_progress` | En ejecución | directo |
| `completed` | **Terminada** (no «verificada») | directo |
| `failed` / `cancelled` | Fallida / Cancelada | directo |
| — | **Verificada** | Core: existe evidencia ejecutada y vigente para sus `acceptance_refs` |
| — | **Vigente / Obsoleta** | Core: comparación de hashes de artefactos y `commit_sha` |
| — | Fase aprobada / avanzada | Core (máquina de fases) |

La UI nunca muestra «verificada» o «aprobada» a partir de un estado de AgentTeams.

**Regla v3:** ninguna operación de AgentTeams (tarea, miembro, mensaje, *quality gate*) escribe en `.evol/`, en `gate-log` ni en el estado de fases. El único canal entre ambos es el `TaskRef` que Core mantiene y las evidencias que Core ejecuta. El Work Manager no almacena una segunda base de tareas.

## 3. Eventos y comandos

| Operación | Dirección | Contrato | Permiso | Idempotencia |
|---|---|---|---|---|
| Crear equipo/plan (`staged`) | Studio → AgentTeams | roster + DAG con `acceptance_refs` | Operator | por `plan_id` |
| Iniciar plan | Studio → AgentTeams | confirmación humana en modo supervisado | Operator | por `plan_id` |
| Observar tarea | AgentTeams → Studio | proyección de solo lectura | Reader | — |
| Cancelar tarea/equipo | Studio → AgentTeams | motivo obligatorio | Operator | sí |
| Registrar evidencia | Core → `TaskRef` | solo comandos que Core ejecutó | sistema | por `evidence_id` |
| Reasignar | AgentTeams | revoca el intento anterior (comportamiento declarado por el autor) | Operator | por `attempt` |
| Cerrar tarea para Evol | Core | solo con `verify` + revisor independiente cuando aplique | sistema | sí |

Los *quality gates* opt-in de AgentTeams (requirements → implementation → verification → review → integration) se pueden usar como **plan de trabajo**, pero **no sustituyen** los gates de Evol: su control de alcance es «auditoría al completar», no interceptación de escrituras (EV-022).

## 4. Recuperación (ningún trabajo interrumpido es exitoso por defecto)

| Escenario | Comportamiento |
|---|---|
| Reinicio de Harness | AgentTeams restaura su estado desde el log de sesión; Studio recompone `TaskRef` y marca como **`incierta`** toda tarea `in_progress` sin latido; no se marca `completed` |
| Reinicio de Evol/Core | el estado de fases se reconstruye de `.evol/` y se concilia con el log firmado; mismatch → bloqueo (OD-16) |
| Agente interrumpido | tarea → `failed` o reintento nuevo (`attempt+1`); resultados parciales se conservan como artefactos **sin** valor de evidencia |
| Contexto agotado | `failed` con motivo `context`; el coordinador puede dividir la tarea; el resumen no sustituye el estado |
| Sin tokens/presupuesto | `failed` con motivo `budget` |
| Cambio de proveedor | nueva ejecución con nuevo `run_id`; el original queda como estaba |
| Cambio de rama o de commit | `validity = obsoleta` para tareas cuyo `commit_sha` base ya no es ancestro; requiere revalidación |
| Fallo de indexación | worker falla con error; las consultas devuelven frescura «obsoleta»; **no** se bloquean fases por ello salvo que la fase dependa de símbolos |
| Pérdida de conexión | el cliente muestra `desconocido`; no se infiere éxito |
| Resultado incompleto | `needs_revision` en la revisión o `failed`; nunca `completed` por defecto |

**Reintentos:** idénticos por `idempotency_key = hash(task_id, commit_base, objective)`. Acciones con efectos secundarios (escribir, ejecutar, publicar) **revalidan precondiciones** (commit base, artefactos aprobados, permisos vigentes) antes de repetirse. Tope de reintentos propuesto: 2 por tarea; a la tercera, escalar a la persona (lección de las 4 rondas de QA en Evol OS).

## 5. Pruebas necesarias

Mapeo de estados real↔UI con una tarea de cada estado; reinicio de Harness con tarea `in_progress`; concurrencia de dos escritores sobre `.evol/`; idempotencia de reintento; obsolescencia al cambiar de rama; ninguna tarea `completed` sin `evidence_id` cuando exige verificación.

## 6. Riesgos específicos

AgentTeams depende de costuras privadas de subagentes y su compatibilidad con 0.2.2-rc.3 no está declarada (EV-036); un solo mantenedor; la UI de equipos podría duplicar datos del Control Center → reutilizar su panel en lugar de reconstruirlo.
