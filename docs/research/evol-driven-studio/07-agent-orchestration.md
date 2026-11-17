# 07 — Agentes y orquestación (R4)

Evidencia: EV-008, 020, 022. AgentTeams v0.1.30 (MIT, 14 herramientas, scheduler, panel Web) sobre el sistema de equipos del propio Harness (`packages/team`).

## 1. Matriz de responsabilidades

| Responsabilidad | Evol-Driven hoy | Harness | AgentTeams | Observación |
|---|---|---|---|---|
| Crear subagentes y mensajería | No (adaptadores a IDE externos) | Sí (`packages/subagent`: identidad, mensajes, interrupción) | Sí (miembros duraderos, buzón) | duplicaría si Evol lo construye |
| Tablero de tareas con dependencias | **No** (EV-008) | Sí (`agent-team`: DAG, persistido en el log de sesión) | Sí (scheduler automático, reasignación segura) | candidato a fuente única de *tareas* |
| Máquina de aprobaciones por fase | **Sí** (HMAC, hashes, ciclos) | No | «quality gates» opt-in (requisitos→implementación→verificación→revisión→integración), con auditoría **al completar**, no interceptación de escrituras | no son equivalentes: scheduler ≠ aprobación |
| Requisitos, spec, criterios CA-n | **Sí** | No | No | exclusivo de Evol |
| Evidencia de verificación | **Sí** (`verify`, QA) | Parcial (eventos/entregables) | Contratos entre fases | Evol es la autoridad |
| Permisos por agente | Roles como skills (sin frontera técnica) | sandbox, guard, aprobaciones de herramientas | alcance auditado al final | **sin frontera efectiva** a nivel Evol |
| Recuperación tras interrupción | `checkpoint.md` (dato) | sesión append-only + replay | «cold recovery» de intentos abiertos | Harness/AgentTeams ya resuelven lo operativo |
| Concurrencia | sin locks (EV-007) | sesiones aisladas; tope de concurrencia | scheduler | Evol debe proteger **sus** escrituras |

## 2. Preguntas obligatorias (§11)

1. **¿Qué da Harness?** Subagentes, mensajería, interrupción, tablero de tareas del equipo, jobs, sesiones durables. DOCUMENTED.
2. **¿Qué añade AgentTeams?** Scheduler automático, reutilización de miembros ociosos, recuperación en frío, plan previo con DAG, panel interactivo, contratos de calidad opt-in. DOCUMENTED.
3. **¿Qué tiene Evol?** Adaptadores a IDE, roles como skills y un checkpoint/handoff por documento. VERIFIED.
4. **Duplicación:** tareas (tablero), roles (skills vs. miembros), «quality gates» frente a `verify`. Hay que elegir una fuente por concepto.
5. **Trabajos y dependencias:** hoy solo en AgentTeams/Harness.
6. **Agente que termina sin registrar estado:** en Evol, nada lo detecta (el checkpoint es declarativo). En AgentTeams, el scheduler detecta intentos abiertos y los recupera; el contenido de lo hecho sigue sin verificarse. RF-1/RF-2 de Evol OS lo atacan con secciones calculadas.
7. **Recuperación de una ejecución interrumpida:** AgentTeams (cold recovery) + log de sesión. Evol: ninguna. La invariante §13 exige **revalidar** condiciones antes de reejecutar.
8–9. **Responsabilidades y evidencia:** el responsable lo asigna el scheduler; la *evidencia* debe emitirla un comando de Evol (no un resumen del agente).
10. **Permisos por agente:** sin frontera técnica en Evol; apoyarse en sandbox/guard de Harness y en el gate de autorización del host (doc 09).
11. **Mezcla de proyectos:** no verificado en AgentTeams; el workspace de Harness aísla sesiones, pero no se comprobó con equipos.
12. **Concurrencia:** Evol necesita un lock de proyecto para `.evol/` (no existe).
13. **Reinicio de Harness:** las tareas persisten en el log de sesión (doc de `agent-team`); no se ejecutó una prueba de reinicio.
14. **¿Una fuente única de estado de trabajos?** Sí, si **AgentTeams/Harness** es la fuente de *tareas de ejecución* y Evol la de *requisitos, verificaciones y aprobaciones*. Lo que no debe ocurrir es un segundo tablero en Evol.

## 3. Alternativas

**A — AgentTeams ejecuta y coordina; Evol gobierna requisitos, verificaciones y aprobaciones.**
Pros: reutiliza lo existente; separa scheduler de máquina de aprobación; menos código nuevo. Contras: compatibilidad de AgentTeams con Harness 0.2.2-rc.3 no listada (EV-022); su control de alcance es solo auditoría; dependencia de un plugin comunitario con un solo mantenedor; hay que mapear tareas↔CA.

**B — Evol conserva un orquestador propio; Harness solo ejecuta.**
Pros: independencia total; un único dueño del estado. Contras: reconstruir un scheduler y un tablero que ya existen (viola «reutilización antes que reconstrucción»), mucho trabajo, y sin ventajas demostradas.

**Híbrida recomendada (A+):** AgentTeams (o el `team` de Harness) ejecuta; Evol aporta (i) un *puente de evidencia* que asocia cada tarea con CA-n y con un comando de verificación que Evol ejecuta, (ii) un *gate de cierre*: una tarea de AgentTeams no se considera completada para Evol hasta que `evol verify` y, si corresponde, un revisor independiente den resultado, y (iii) un lock y registro propios para `.evol/`. La aprobación de fase no puede ser delegada a un agente.

**Condición de bloqueo:** si AgentTeams no carga en la versión fijada de Harness, usar el sistema `team` nativo de Harness como base (misma idea, menos funciones) y mantener a AgentTeams como opcional.

## 4. Responsabilidad que no debe confundirse

Un *scheduler* decide quién hace qué y cuándo. Una *máquina de aprobación* decide si algo es aceptable y quién lo firmó. Evol-Driven no tiene el primero (EV-008); AgentTeams no tiene el segundo (EV-022).
