# 18 — Resumen de archivos (v3)

Ejecución EVOL-STUDIO-DOC-CORRECTION-003, 2026-11-17. **Sin commits.** Rama `feat/evol-driven-studio`, HEAD `47a93c8`. Todo bajo `docs/research/evol-driven-studio/v3/`. **La entrega v2 (`../v2/`) y la investigación anterior no se modificaron** (se conservan como historia); v3 se creó copiando v2 y aplicando las correcciones.

## Estado por archivo de v3

| Archivo | Estado | Cambio |
|---|---|---|
| `00-informe-ejecutivo.md` | **reescrito** | resumen v3, resultado de H-01…H-06, dictamen |
| `evidence-v3.md` | **actualizado** | EV-032…044 conservadas; añadidas **EV-045…056** (correcciones y evidencia nueva) |
| `01-auditoria-de-consistencia.md` | actualizado | C-01 resuelta a nivel de diseño, C-03 corregida, nuevas C-15…C-21, brecha 1 remitida al doc 19 |
| `02-registro-de-decisiones.md` | actualizado | notas v3 en OD-03, 04, 09, 11, 16, 17, 18, 19, 21, 22, 24, 25; sin cambiar ratificaciones |
| `03-arquitectura-objetivo.md` | actualizado | §2 bis: permisos por efectos, fallo cerrado, una sola base de tareas |
| `04-flujo-multiagente-del-pipeline.md` | actualizado | invariantes: tareas no modifican estados protegidos; avance por flujo unificado |
| `05-matriz-de-subagentes.md` | sin cambios | — |
| `06-model-routing.md` | actualizado | aclaración de qué se atribuye a la versión candidata |
| `07-contratos-agentteams.md` | actualizado | regla: ninguna operación de AgentTeams escribe en `.evol/` |
| `08-contratos-de-memoria-y-workers.md` | actualizado | `dsh-evidence` como candidato opcional (§11) |
| `09-control-center-modulos.md` | actualizado | Approval Center con flujo unificado y estados; nota del Pipeline Explorer |
| `10-inventario-cli-ui.md` | **reescrito** | permisos por efectos reales (H-02) |
| `11-modelo-de-seguridad-approval-broker.md` | **reescrito** | fallo cerrado, recuperación, flujo unificado, rutas indirectas, 17 pruebas |
| `12-skill-evol-studio-plugin-development.md` | **reescrito** | jerarquía de fuentes, prerequisitos en 3 niveles (H-03) |
| `13-plan-tanda-1.md` | actualizado | prerequisitos A/B/C; sin bloqueo por `dsh-doc` |
| `14-plan-tanda-2.md` | actualizado | correcciones del núcleo y fallo cerrado del broker |
| `15-roadmap.md` | actualizado | H7 sin rollback inseguro; hitos de control |
| `16-matriz-de-compatibilidad.md` | actualizado | `dsh-evidence`, skills comunitarias, pares nuevos |
| `17-deuda-y-pendientes.md` | actualizado | bloqueos por etapa; B-01 reclasificado; D-07 parcial; D-11…D-14 |
| `18-archivos-modificados.md` | **reescrito** | este archivo |
| `19-matriz-de-conciliacion-normativa.md` | **nuevo** | H-04 |
| `20-informe-de-resolucion-de-hallazgos.md` | **nuevo** | matriz de cierre y regresiones |

## Ubicación y estado de Git

`docs/research/` y `docs/code-memory-research/` siguen **sin rastrear**. No se tocó código, `.evol/`, `evol.config.json`, `.gitignore`, specs, `FEATURES.md`, dependencias, memoria, perfiles ni ejecutables.

## Efectos secundarios declarados

Auto-minado de transcripciones de MemPalace durante la sesión (no fue estrictamente de solo lectura); clones superficiales de repositorios de terceros en el directorio temporal de la sesión (`dsh`, `at`, `deja-vu`, `ev`); un intento de recorrer `evol <comando> --help` en bucle fue denegado por el clasificador de permisos y no se reintentó; no se escribió en Engram.
