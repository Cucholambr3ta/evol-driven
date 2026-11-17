# ADR-004 — Proveedor de memoria conversacional

**Estado:** Pendiente de benchmark. Ninguna decisión de este archivo está aprobada por una persona.
**Fecha:** 2026-11-16

## Contexto
MemPalace acumula transcripciones y no tiene estado por recuerdo; Engram tiene buen ciclo de vida pero solo búsqueda léxica; Mnemon Native + dsh-mnemon aportan interfaz en Harness pero su recuerdo depende de la decisión del agente (EV-012, 013, 023, 025).

## Decisión propuesta
**No se decide.** Se ejecuta el benchmark del doc 11 §2 con umbrales fijados antes (≥80 % en los 3 primeros y ≥70 % por tipo; vigencia 100 %; sin respuesta ≤10 % de falsos aciertos; desempate por simplicidad). Hasta entonces, MemPalace es la memoria oficial y no se alimentan otros almacenes.

## Alternativas descartadas / reglas
Un proveedor por ámbito; sin doble escritura.

## Consecuencias y riesgos
Si gana otro proveedor: migración con respaldo, procedencia y verificación (doc 04 §3); se enmienda el CLAUDE.md solo después del ADR aprobado.

## Evidencia
03-memory-landscape.md, 04-local-memory-design.md, 11-validation-benchmarks.md
