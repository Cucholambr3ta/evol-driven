# 14 — Plan de Tanda 2: integración de Evol-Driven

Responsable del plan técnico: Claude Code. **No comienza sin el informe de handoff verificable de Tanda 1** (OD-22). Este documento es el plan; no autoriza implementar.

## 1. Entradas obligatorias (del informe de Tanda 1)

Versión de Harness y plugins fijados; rutas; capacidades verificadas y no verificadas; decisión C-01; resultados de red; procedimiento de restauración; skill `evol-studio-plugin-development` instalada y validada.

## 2. Alcance

| Bloque | Contenido | Hito |
|---|---|---|
| Contratos y núcleo | paquete `core` y CLI `--json` versionados; separación lectura/escritura; verificación estado↔log; lock; `verifier_version`; trailer `CA:` | H0 |
| Adaptador mínimo | plugin Cordis host + puente a Core | H1 |
| Lectura | Project Manager, Pipeline Explorer, Dashboard | H2 |
| Equipos | `agentTeamsAdapter`, Work Manager, Agent Center, `TaskRef` | H3 |
| Memoria y código | adaptadores `ContextMemory`/`CodeIntel`/`SessionHistory`, workers | H4 |
| Modelos | Model Routing por fase/rol | H5 |
| Calidad | Quality & Evidence con estados de evidencia | H6 |
| Autorización | Approval Broker y Approval Center | H7 |
| Resto de CLI | inventario CLI→UI completo | H8 |
| Distribución | Plugin Edition reproducible, luego Desktop | H9, H10 |

## 3. Reglas

1. El núcleo permanece independiente; el plugin usa interfaces versionadas.
2. Una sola autoridad por responsabilidad (doc 03).
3. Cada módulo se entrega con contrato, permisos, pruebas con fixture identificable, diagnóstico y rollback; cada hito es uno o varios ciclos del pipeline de Evol.
4. Ninguna integración se da por buena sin prueba ejecutada; no hay PASS por inferencia.
5. Primero lectura, después escritura; **la operación de aprobar es la última** en habilitarse (H7), con sus pruebas negativas.
6. Cualquier cambio a `gate.ts`, `coverage.ts` o `verify.ts` se prueba con `evol` y con `evol-dev` (verificador auto-hospedado).

## 4. Riesgos propios de la tanda

Deriva de contratos entre repos (`evol-driven` y `evol-driven-studio`); API pre-stable de Harness; compatibilidad de AgentTeams; falsos positivos de gates (WARN dos semanas antes de BLOCK); sobreingeniería (no HTTP, no microservicios).

## 5. Criterios de salida de la tanda

Todos los hitos H0–H9 con sus condiciones de aceptación ejecutadas; plan de pruebas del doc 11 anterior (benchmarks) ejecutado; informe de seguridad con las 9 pruebas del doc 11 v2 en verde; matriz de compatibilidad con combinaciones «probadas»; decisión sobre Desktop (H10) tomada.
