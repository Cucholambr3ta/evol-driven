# 18 — Resumen de archivos creados, actualizados y reconciliados

Ejecución EVOL-STUDIO-ARCH-UPDATE-002, 2026-11-17. **Sin commits.** Rama `feat/evol-driven-studio`, base `47a93c8`.

## Creados (todos bajo `docs/research/evol-driven-studio/v2/`)

| Archivo | Entregable |
|---|---|
| `00-informe-ejecutivo.md` | A, resumen, dictamen y respuesta final |
| `evidence-v2.md` | evidencia EV-032…044 |
| `01-auditoria-de-consistencia.md` | auditoría y contradicciones C-01…C-14 |
| `02-registro-de-decisiones.md` | B — OD-01…OD-25 |
| `03-arquitectura-objetivo.md` | C |
| `04-flujo-multiagente-del-pipeline.md` | D |
| `05-matriz-de-subagentes.md` | E |
| `06-model-routing.md` | F |
| `07-contratos-agentteams.md` | G |
| `08-contratos-de-memoria-y-workers.md` | H |
| `09-control-center-modulos.md` | I |
| `10-inventario-cli-ui.md` | J |
| `11-modelo-de-seguridad-approval-broker.md` | K |
| `12-skill-evol-studio-plugin-development.md` | L |
| `13-plan-tanda-1.md` | M |
| `14-plan-tanda-2.md` | N |
| `15-roadmap.md` | O |
| `16-matriz-de-compatibilidad.md` | P |
| `17-deuda-y-pendientes.md` | Q |
| `18-archivos-modificados.md` | R (este) |

## Actualizados

**Ninguno.** Para cumplir «no alterar retroactivamente informes de auditorías anteriores» (OD-13), los documentos 00–17, los 6 ADR y `evidence/EVIDENCE.md` de la investigación anterior **no se editaron**. Su relación con v2 queda registrada en `01-auditoria-de-consistencia.md` (sustituciones y absorciones) y en el mapa de equivalencias de `02-registro-de-decisiones.md`.

## Reconciliados (solo en el registro, sin modificar el original)

| Documento anterior | Relación con v2 |
|---|---|
| `../12-architecture-comparison.md`, ADR-001 | OD-01 (coinciden) |
| `../16-open-decisions.md` | numeración sustituida por la de v2 (C-13); el antiguo OD-04 «solo TTY» **sustituido** por OD-04 confirmada (C-07) |
| ADR-004 (memoria) | **reemplazado parcialmente** por OD-03 (C-05); el benchmark sigue como condición de ratificación |
| ADR-005 (código) | absorbido por OD-05 (C-06) |
| ADR-003 (orquestación) | absorbido por OD-07 (C-08) |
| ADR-006 (distribución) | absorbido por OD-06 (C-09) |
| `../13-renewal-roadmap.md` | sustituido por `15-roadmap.md` (C-10) |
| `../17-final-recommendation.md` | histórico; las recomendaciones vigentes están en v2 |
| `docs/code-memory-research/*` | preexistente, **no tocado**; integrado conceptualmente (OD-14) |

## No tocados

Código fuente, `evol.config.json`, `.evol/`, `docs/specs/`, `docs/features/`, pruebas, dependencias, perfiles, memoria (MemPalace, Engram), `.gitignore`, ejecutables, `docs/research/evol-driven-studio.zip` (anterior a esta ejecución; no incluye v2).

## Efectos secundarios declarados

Auto-minado de transcripciones de la sesión en MemPalace (la sesión **no** es estrictamente de solo lectura); clones de repositorios externos en un directorio temporal aislado; un clon de `deja-vu` creado por error dentro del repositorio fue detectado y movido (EV-043); un intento de recorrer `--help` de todos los comandos fue denegado y no se reintentó (EV-042).
