# 04 — Flujo multiagente del pipeline (OD-25)

Las siete fases no cambian. Cambia *cómo se ejecuta el trabajo dentro de cada fase*. **Nada de esto está implementado**: es la especificación contractual.

## 1. Dos máquinas de estados (obligatorio separarlas)

| | Fases | Trabajos |
|---|---|---|
| Dueño | Evol-Driven Core | AgentTeams (o `team` nativo) |
| Estados | `briefing → spec → plan → build → qa → retro → done` (+ ciclo) | `pending, claimed, in_progress, completed, failed, cancelled` (EV-037) |
| Quién transita | Core, con aprobación vigente | scheduler/miembros |
| Qué significa «terminado» | fase aprobada **y** avanzada | tarea con resultado y evidencia declarada |

**Reglas:** (1) tarea `completed` ≠ fase aprobada; (2) fase aprobada no reejecuta tareas; (3) la fase no avanza porque un agente informe que terminó; (4) estados intermedios que pide la UI y AgentTeams no expone (por ejemplo *verificado*, *vigente*, *bloqueado*) los **calcula** Core a partir de evidencia; no se inventan en AgentTeams.

## 2. Flujo por fase (pasos contractuales)

1. **Selección:** el proyecto activo; Core determina fase y ciclo (y comprueba conciliación estado↔log; si falla, **bloquea** operaciones protegidas, OD-16).
2. **Contexto autorizado:** recuperación acotada (memoria contextual, símbolos, documentos del proyecto, historial) con límite de tokens y filtros por `project_id`.
3. **Objetivos y criterios:** Core entrega los CA vigentes y los artefactos esperados por la fase.
4. **Planificación de trabajos:** el coordinador propone tareas con dependencias; en modo supervisado la persona revisa el plan de delegación antes de ejecutar (equivale al estado `staged` de AgentTeams).
5. **Modelos y especialistas:** Model Routing resuelve proveedor/modelo/razonamiento por trabajo (doc 06) y se registra.
6. **Ejecución:** AgentTeams coordina; los workers deterministas resuelven lo que no requiere LLM.
7. **Consolidación:** se reúnen resultados y artefactos con referencias (doc 07).
8. **Verificación determinista:** Core ejecuta `verify`, pruebas, escaneos; **el resultado de un LLM no cuenta como ejecución de pruebas**.
9. **Revisión de evidencia:** un revisor independiente (agente distinto del autor) emite veredicto sobre la evidencia; no aprueba.
10. **Gate de Evol:** reglas de la fase; BLOCK detiene.
11. **Autorización humana** si la fase la exige: solicitud al Approval Broker (doc 11).
12. **Transición controlada:** Core avanza solo con aprobación vigente (hashes vigentes) y verificación PASS/WARN aceptado.
13. **Persistencia y continuidad:** journal, checkpoint **calculado** (no declarativo), referencias de tareas.

## 3. Especificación por fase

| Fase | Especialistas bajo demanda | Entradas | Salidas verificables | Verificación determinista | Gate/humano |
|---|---|---|---|---|---|
| briefing | Requirements Analyst, Research Agent, Scope Reviewer | pedido, contexto, restricciones | `FEATURES.md`, preguntas abiertas, decisiones | existencia y formato de artefactos, escenarios BDD/ATDD enlazados a CA | aprobación humana |
| spec | Specification Architect, Acceptance Criteria Reviewer, Consistency Auditor | briefing aprobado | `SPEC.md`, `DOMAIN.md`, `THREATS.md` con CA numerados | CA únicos y verificables, contradicciones detectables por reglas, cobertura briefing→spec | aprobación humana |
| plan | Technical Planner, Architecture Reviewer, Risk Analyst | spec aprobada | `PLAN.md` interrogado, tareas con dependencias y pruebas | cada CA con tarea y prueba prevista; plan interrogado y vigente (`evol interrogate`) | aprobación humana |
| build | Developer Agent, Integration Specialist, Code Reviewer, Documentation Agent (según lenguajes reales) | plan aprobado | código, pruebas, documentación, commits con `CA:` | suite de pruebas, linters, escaneo de secretos, trailer, cobertura de símbolos modificados | aprobación humana |
| qa | Test Execution Worker, Independent QA Reviewer, Security Reviewer, Evidence Auditor | build aprobado | informe QA, hallazgos, evidencia con comando/hash | pruebas ejecutadas por worker, `security scan`, regresiones, estados de evidencia | **revisor independiente obligatorio** + aprobación humana |
| retro | Incident Analyst, Knowledge Curator, Process Improvement Reviewer | qa aprobado | lecciones, deuda, mejoras con procedencia | lecciones con fuente y estado; sin secretos; sin duplicados | aprobación humana |
| done | ninguno permanente; Documentation Agent solo si hay síntesis | retro aprobado | cierre determinista, resumen opcional | integridad de registros | **no abre ciclos nuevos sin autorización** |

## 4. Modos de ejecución

| Modo | Cuándo | Qué hace | Controles que **no** se reducen |
|---|---|---|---|
| **Simple** | tarea pequeña | un agente + workers deterministas | verificación, permisos, autorización |
| **Adaptativo** (predeterminado) | casi siempre | el coordinador decide especialistas según complejidad, riesgo, disciplina, lenguajes, dependencias, necesidad de auditoría independiente y herramientas; **justifica** cada delegación y evita subagentes si una herramienta local resuelve | ídem |
| **Multiagente supervisado** | alto riesgo / aprendizaje | la persona revisa el plan de delegación y supervisa agentes, modelos, roles, trabajos, dependencias, estados, resultados, errores y revisiones | ídem. **Supervisar tareas no es aprobar la fase** |

Reglas de decisión del modo Adaptativo (propuestas; calibrables): delegar a subagente solo si (a) la tarea requiere razonamiento y (b) no existe operación determinista equivalente y (c) el tamaño de contexto justifica aislar la tarea; exigir revisor independiente en `build` si el cambio toca código protegido, seguridad o contratos; activar `security` ante entradas externas, credenciales o dependencias nuevas.

## 5. Invariantes del flujo

- Un revisor no autoaprueba; el que construye no revisa su propio trabajo.
- Un resultado de LLM nunca sustituye una prueba ejecutada.
- La fase no avanza por informe de agente.
- Toda ejecución registra modelo/proveedor reales, sin credenciales.
- El cambio de modelo no cambia permisos, no omite revisiones, no autoriza avanzar.
- La recuperación revalida condiciones antes de reintentar (doc 07 §3).
