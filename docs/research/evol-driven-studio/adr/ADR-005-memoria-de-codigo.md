# ADR-005 — Motor de memoria de código

**Estado:** Pendiente de benchmark. Ninguna decisión de este archivo está aprobada por una persona.
**Fecha:** 2026-11-16

## Contexto
El motor nativo es TS/JS y escribe al consultar (EV-002/003); CBM cubre más lenguajes, tiene una pasada semántica solo para algunos (no QML ni CMake) y un instalador/daemon invasivo (EV-026/027).

## Decisión propuesta
Opción C+E: motor nativo para gobernanza (`TESTS`, `MODIFIES`, frescura) y CBM detrás de `CodeIntelProvider` solo si cumple las **condiciones de entrada**: 0 tráfico saliente, 0 cambios en configuración de agentes, aislamiento por proyecto, cierre limpio del daemon.

## Alternativas descartadas / reglas
Sustituir el motor actual (B) descartado: se perdería lo que alimenta QA.

## Consecuencias y riesgos
Si CBM no cumple, queda el motor nativo más T0 de git para otros lenguajes. Las cifras del autor no se aceptan sin reproducir.

## Evidencia
05-code-intelligence-assessment.md, 11-validation-benchmarks.md
