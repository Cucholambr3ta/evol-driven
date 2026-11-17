# ADR-002 — Vía de integración con el núcleo

**Estado:** Propuesta (no aprobada). Ninguna decisión de este archivo está aprobada por una persona.
**Fecha:** 2026-11-16

## Contexto
Evol hoy solo ofrece CLI y MCP; el MCP mezcla lectura y escritura sin anotar (EV-004); el grafo escribe al consultar (EV-003).

## Decisión propuesta
Orden: **CLI `--json` versionado → paquete TypeScript `core` → MCP separado en lectura y escritura**. Sin servicio HTTP.

## Alternativas descartadas / reglas
HTTP local descartado por superficie de ataque; microservicios descartados.

## Consecuencias y riesgos
El plugin host usa `core`; los agentes externos usan MCP; todo con contratos versionados y pruebas de contrato. Riesgo: congelar demasiado pronto un contrato.

## Evidencia
10-migration-plan.md §3
