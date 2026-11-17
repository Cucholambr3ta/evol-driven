# ADR-003 — Quién coordina las tareas

**Estado:** Propuesta (no aprobada). Ninguna decisión de este archivo está aprobada por una persona.
**Fecha:** 2026-11-16

## Contexto
Evol no tiene scheduler ni modelo de tareas (EV-008); Harness trae `team` y AgentTeams añade scheduler, recuperación en frío y panel (EV-020/022).

## Decisión propuesta
AgentTeams (o `team` nativo si no es compatible) ejecuta y coordina; Evol gobierna requisitos, verificación y aprobaciones, con un **puente de evidencia** (tarea↔CA↔comando de verificación) y un **gate de cierre**.

## Alternativas descartadas / reglas
No construir un tablero de tareas propio. Alternativa B (orquestador propio) descartada.

## Consecuencias y riesgos
Una sola fuente de estado de ejecución. Riesgos: compatibilidad con Harness 0.2.2-rc.3 no listada, un solo mantenedor. Condición de bloqueo: si no carga en la versión fijada, usar `team` nativo.

## Evidencia
07-agent-orchestration.md
