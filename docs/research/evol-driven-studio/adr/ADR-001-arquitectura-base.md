# ADR-001 — Arquitectura base

**Estado:** Propuesta (no aprobada). Ninguna decisión de este archivo está aprobada por una persona.
**Fecha:** 2026-11-16

## Contexto
Evol-Driven debe seguir siendo independiente; Harness es pre-release y no está auditado (EV-015). La matriz del doc 12 da A 77.6, C 75.0, B 45.0.

## Decisión propuesta
Adoptar **A→C**: núcleo independiente con un adaptador delgado hacia Harness (Plugin Edition), y más adelante una distribución preconfigurada (perfil `evol-studio`).

## Alternativas descartadas / reglas
Descartadas: B (reconstruir como plugins Cordis) y D (sin ventaja verificable).

## Consecuencias y riesgos
Un solo núcleo, un solo contrato; dependencia acotada y reversible de Harness. Costo: mantener empaquetado y matriz de compatibilidad. Se revisa si el prototipo del Hito 3 muestra que un plugin host no puede aislar el log firmado.

## Evidencia
12-architecture-comparison.md, EV-015
