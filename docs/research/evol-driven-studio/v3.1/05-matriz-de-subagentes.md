# 05 — Matriz de subagentes y workers (v3.1)

**v3.1 (AMD-02):** reglas que se conservan o se añaden a la enmienda de `ESPECIFICACION.md:718`: (1) **profundidad 1**: un subagente no lanza otro y un worker no es un agente (a verificar en AgentTeams, P-34); (2) ningún miembro **aprueba, avanza de fase, abre un ciclo ni escribe `.evol/`**; (3) cada disciplina la sigue aplicando **exactamente un rol de competencia** (criterio 76): los roles de esta matriz especializan la ejecución, no reasignan disciplinas; (4) `verificador` y `seguridad` conservan su contexto limpio y su solo lectura; (5) sin segundo scheduler.

Roles **configurables y activados bajo demanda**; ninguno es permanente. Los permisos son el techo *propuesto*; se aplican por política de herramientas del miembro (`tool_policy` de AgentTeams, EV-038) y por el sandbox de Harness; **no por el texto del prompt**. Lectura (R), escritura de archivos del proyecto (W), ejecución de comandos (X), memoria (M).

## 1. Subagentes de IA

| Rol | Fase | Responsabilidad | Entradas | Salidas | Permisos (techo) | Activador | Tipo de tarea AgentTeams |
|---|---|---|---|---|---|---|---|
| Requirements Analyst | briefing | necesidades, restricciones, preguntas pendientes | pedido, contexto recuperado | `FEATURES.md`, lista de dudas | R, W(docs), M(lectura) | briefing sin `FEATURES.md` o con dudas | `requirements` |
| Research Agent | briefing | investigar con fuentes verificables | tema | informe con evidencia clasificada | R, red solo si política lo permite | brecha de conocimiento declarada | `work` |
| Scope Reviewer | briefing | alcance dentro/fuera | borrador de briefing | veredicto + hallazgos | R | siempre en modo supervisado; opcional en Adaptativo | `review` |
| Specification Architect | spec | spec, requisitos funcionales y no funcionales | briefing aprobado | `SPEC.md`, `DOMAIN.md` | R, W(docs) | spec pendiente | `requirements` |
| Acceptance Criteria Reviewer | spec | CA verificables y escenarios negativos | spec | veredicto sobre CA | R | siempre que cambien los CA | `review` |
| Consistency Auditor | spec | contradicciones entre documentos | spec + ADR | hallazgos | R | cambios en normativos | `review` |
| Technical Planner | plan | tareas, dependencias, pruebas | spec | `PLAN.md` | R, W(docs) | plan pendiente | `requirements` |
| Architecture Reviewer | plan | viabilidad y alternativas | plan | veredicto | R | decisiones estructurales | `review` |
| Risk Analyst | plan | riesgos y mitigaciones | plan | registro de riesgos | R | riesgo alto o dependencias nuevas | `review` |
| Developer Agent | build | implementar tareas | tarea + contexto acotado | código y pruebas | R, W(rutas del proyecto), X(pruebas permitidas) | tarea de implementación con razonamiento | `implementation` |
| Integration Specialist | build | integrar módulos | tareas completadas | integración | R, W, X(pruebas) | varias tareas interdependientes | `integration` |
| Code Reviewer | build | revisión independiente del código | diff + CA | veredicto `pass/needs_revision/reject` | R | siempre que el diff toque código protegido o seguridad | `review` |
| Documentation Agent | build, done | documentación y síntesis | cambios | docs | R, W(docs) | docs pendientes | `work` |
| Test Execution Worker | qa | **no es LLM**: ejecuta pruebas y escaneos | comandos autorizados | salida con hash | X(lista cerrada) | siempre en qa | `verification` |
| Independent QA Reviewer | qa | analiza resultados y evidencia | informe, diff | veredicto + hallazgos | R | **obligatorio en qa** | `review` |
| Security Reviewer | qa | amenazas y secretos | diff, THREATS | hallazgos | R | entradas externas, credenciales, dependencias | `review` |
| Evidence Auditor | qa | cada CA tiene evidencia ejecutada | matriz CA→prueba→resultado | estados de evidencia | R | siempre en qa | `review` |
| Incident Analyst | retro | causas de fallas | historial de rondas | análisis con grados de certeza | R | rondas >1 o BLOCK | `work` |
| Knowledge Curator | retro | lecciones con procedencia y estado | hallazgos | lecciones **propuestas** | R, M(propuesta) | retro | `work` |
| Process Improvement Reviewer | retro | mejoras al proceso | lecciones | propuestas | R | retro | `review` |

Reglas transversales: un revisor no puede ser el autor de lo revisado; QA exige veredicto independiente y evidencia ejecutada; Knowledge Curator **propone**, no escribe memoria sin permiso (política de escritura, doc 08); **ningún rol aprueba fases** (eso es del Approval Broker).

## 2. Workers locales (deterministas, sin modelo)

| Worker | Función | Herramienta base | Activador | Salida | Permiso |
|---|---|---|---|---|---|
| Code Indexer | indexar/actualizar el índice de código | Codebase Memory MCP | proyecto incorporado, índice ausente, revisión Git relevante, solicitud explícita, consulta que exige datos recientes | estado + `commit_sha` + frescura | R código, W índice propio |
| Context Memory Worker | recuperar/guardar contexto | proveedor activo | consulta o guardado autorizado | fragmentos acotados con fuente | M |
| Session History Indexer | indexar sesiones de **directorios autorizados** | dsh-deja | solicitud o evento | frescura | R de la lista cerrada |
| Document Indexer | actualizar documentos del proveedor documental | Project Documents de dsh-mnemon | cambio en `docs/` | frescura | R docs |
| Test Execution Worker | pruebas y escaneos | comandos del proyecto | fase qa/build | salida + hash | X lista cerrada |
| Artifact Verifier | `evol verify` / `coverage` | Core | fin de fase | veredicto | R |

Política común: indexar solo si es necesario; agrupar solicitudes redundantes; sin procesos duplicados; **concurrencia limitada** (valor inicial propuesto: 1 indexación por repositorio y 2 en total; calibrar en el benchmark); cancelación y reintento; errores registrados; resultados compactos; **sin red durante la indexación**.

## 3. Selección bajo demanda

El coordinador consulta este catálogo: no carga el cuerpo completo de cada especialista. Cada rol se materializa como un **perfil de miembro** de AgentTeams (`name, role, provider, model, reasoning_effort, executionPrompt, fallback, tool_policy`) creado al activarse y retirado al terminar; el contenido detallado del rol vive en una skill cargada **solo** cuando el rol se activa (doc 12).
