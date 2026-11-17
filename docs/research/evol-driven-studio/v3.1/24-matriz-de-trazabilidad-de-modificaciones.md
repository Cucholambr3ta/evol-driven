# 24 — Matriz de trazabilidad de modificaciones (v3 → v3.1)

Cada cambio se liga a la **directiva de cierre v3.1** (secciones §1…§10), a la decisión o hallazgo que lo origina, a la evidencia y a su estado. v2 y v3 **no se modifican** (antecedentes históricos); v3.1 se creó copiando v3 y aplicando los cambios.

## 1. Entregables pedidos (§10) → dónde están

| § | Entregable | Documento | Estado |
|---|---|---|---|
| 1 | Lectura y conciliación normativa integral | 19, evidence-v3.1 (EV-057) | hecho (documental) |
| 2 | Resolución verificable de H-04 / D-07 | 19 §3 y §5, 20 | **cerrados documentalmente**; enmiendas no incorporadas (D-11) |
| 3 | Registro de decisiones hasta OD-27 | 02 | hecho |
| 4 | Reconciliación del modelo de agentes y MCP | 28 (AMD-01, AMD-02), 05, 07, 10 | redactada; no incorporada |
| 5 | Factor de presencia humana y firma asimétrica | 11 | diseñado; **pendiente de validación** |
| 6 | Contratos del Approval Checklist | 21 | diseñado |
| 7 | Especificación del Repository Explorer | 22 | diseñada |
| 8 | Sistema visual (`EVOL-STUDIO-UI-UX-SYSTEM`) | 23 | redactado; sin interfaces |
| 9 | Planes de Tanda 1 y Tanda 2 | 13, 14, 15, 27 | actualizados |
| 10 | Matriz de trazabilidad de modificaciones | este documento | hecho |
| 11 | Condiciones y pruebas pendientes | 25 | hecho |
| 12 | Propuesta exacta de archivos para el commit | 26 | **propuesta; sin ejecutar** |
| 13 | Preparación del ZIP documental | 26 | ver estado en el doc 26 |

## 2. Matriz archivo a archivo

| Archivo v3.1 | Relación con v3 | Cambio | Directiva | Decisión / hallazgo | Evidencia |
|---|---|---|---|---|---|
| `00-informe-ejecutivo.md` | reescrito | resumen v3.1, dictamen, decisiones y límites | §10 | todas | EV-057… |
| `evidence-v3.md` | sin cambios | se conserva | — | — | EV-032…056 |
| `evidence-v3.1.md` | **nuevo** | EV-057…072 | §4, §3 | N-01…, OD-04 | — |
| `01-auditoria-de-consistencia.md` | modificado | §3 punto 1 cerrado; §5 nuevos C-22…24 y estados | §4 | C-18…21 | EV-057…059 |
| `02-registro-de-decisiones.md` | modificado | OD-03 y OD-09 ratificadas; OD-04 concretada; **OD-26 y OD-27**; notas en OD-17, 18, 20, 25 | §1, §2, §3, §5, §6, §7, §8 | OD-03, 04, 09, 17, 18, 20, 25, 26, 27 | EV-060, 068 |
| `03-arquitectura-objetivo.md` | modificado | autoridad de aprobación, checklist y explorador | §3, §6, §7 | OD-04, 26, 27 | — |
| `04-flujo-multiagente-del-pipeline.md` | modificado | checklist y ceremonia previos al avance | §6 | OD-25, 26 | — |
| `05-matriz-de-subagentes.md` | modificado | reglas de AMD-02 (profundidad 1, sin aprobar) | §5 | OD-20, 25; N-07, N-28 | EV-062, 063 |
| `06-model-routing.md` | modificado | encabezado; verificación en Tanda 1 | §1 | OD-24, OD-09 | — |
| `07-contratos-agentteams.md` | modificado | baseline ratificada; sin miembros anidados | §1, §5 | OD-09; P-34 | EV-062 |
| `08-contratos-de-memoria-y-workers.md` | modificado | OD-03 ratificada y `MemoryProvider` | §2 | OD-03; N-10 | EV-067 |
| `09-control-center-modulos.md` | modificado | Centro de revisión con checklist; módulo Repositorio; plugin `ui-repository` | §6, §7, §8 | OD-26, 27 | — |
| `10-inventario-cli-ui.md` | modificado | operaciones `review.*`, `repo.*`, broker | §3, §5, §6, §7 | OD-04, 11, 26, 27 | EV-058 |
| `11-modelo-de-seguridad-approval-broker.md` | **reescrito** | WebAuthn + Ed25519, evidencia, rotación, recuperación, amenazas BA-01…18, P-18…34 | §3 | OD-04 | EV-060…062, 068, 069 |
| `12-skill-evol-studio-plugin-development.md` | modificado | solo encabezado de versión | — | OD-21 | — |
| `13-plan-tanda-1.md` | modificado | baseline y OD-03 ratificadas; manifiesto, perfiles, instaladores | §1, §2, §5 | OD-09, 03, 18 | EV-071 |
| `14-plan-tanda-2.md` | modificado | firma asimétrica, `MemoryProvider`, anotación MCP, checklist, H8b | §3, §5, §6, §7 | OD-04, 26, 27 | EV-061 |
| `15-roadmap.md` | modificado | H7 ampliado, H8b nuevo, hitos de control | §3, §6, §7 | OD-04, 26, 27 | — |
| `16-matriz-de-compatibilidad.md` | modificado | baseline ratificada; «ratificada ≠ probada aquí» | §1 | OD-09 | — |
| `17-deuda-y-pendientes.md` | modificado | B-08→B-10, B-05, B-11; D-07 cerrada; D-11, D-15…18 | §1–§9 | D-07 | — |
| `18-archivos-modificados.md` | **reescrito** | lista de v3.1 | §9, §10 | — | — |
| `19-matriz-de-conciliacion-normativa.md` | **reescrito** | 35 filas; 4 fichas completas; D-07 cerrada | §4 | H-04, N-01…35 | EV-057…067 |
| `20-informe-de-resolucion-de-hallazgos.md` | **reescrito** | cierre de H-04, regresiones y dictamen v3.1 | §4, §9 | H-01…H-06 | — |
| `21-contratos-approval-checklist.md` | **nuevo** | contrato `review-item/1`, reglas, pruebas AC-CL | §6 | OD-26 | EV-063 |
| `22-especificacion-repository-explorer.md` | **nuevo** | pantallas, seguridad, RE-01…12 | §7 | OD-27 | EV-066 |
| `23-EVOL-STUDIO-UI-UX-SYSTEM.md` | **nuevo** | principios, tokens, vistas, pruebas UX | §8 | OD-17, 19 | EV-064 |
| `24-matriz-de-trazabilidad-de-modificaciones.md` | **nuevo** | este documento | §10 | — | — |
| `25-condiciones-y-pruebas-pendientes.md` | **nuevo** | condiciones y pruebas pendientes | §1–§7 | — | — |
| `26-propuesta-de-commit-y-paquete.md` | **nuevo** | alcance exacto y ZIP | §9 | OD-13 | — |
| `27-manifiesto-y-perfiles-dsh.md` | **nuevo** | manifiesto, perfiles, instaladores, cambio de baseline | §1, §5 | OD-09, 18 | EV-071 |
| `28-enmiendas-normativas.md` | **nuevo** | AMD-01…08 | §4, §5 | N-01, 07, 10, 24… | EV-058, 059, 062 |

## 3. Lo que **no** se modificó

`docs/ESPECIFICACION.md`, `docs/specs/*`, `docs/features/FEATURES.md`, `docs/plan/PLAN.md`, `CLAUDE.md`, `evol.config.json`, `.gitignore`, `.evol/`, código fuente, `disciplines/`, `skills/`, memorias (MemPalace, Engram), perfiles y configuraciones personales, `docs/code-memory-research/`, v1, v2 y v3 de la investigación. La incorporación de las enmiendas a esos textos queda para un ciclo y una fase propios (doc 28).
