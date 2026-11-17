# ADR-006 — Distribución Plugin/Desktop

**Estado:** Propuesta (no aprobada). Ninguna decisión de este archivo está aprobada por una persona.
**Fecha:** 2026-11-16

## Contexto
El Desktop de Harness solo tiene objetivos mac-arm64, mac-x64 y win-x64 (EV-018); Linux no está soportado en origen.

## Decisión propuesta
Entregar **Plugin Edition** primero sobre `dsh web`; el Desktop Linux se decide en un ADR posterior con formato (AppImage, PKGBUILD o Flatpak); las dos ediciones comparten el mismo plugin y contratos.

## Alternativas descartadas / reglas
No prometer Desktop Linux ni mantener un fork del núcleo de Harness.

## Consecuencias y riesgos
Entrega temprana y reproducible; el trabajo de empaquetado Linux queda explícito y separado. Licencia de Evol-Driven (privada) debe definirse antes de publicar.

## Evidencia
08-distribution-strategy.md
