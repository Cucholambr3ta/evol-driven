# 18 — Resumen de archivos (v3.1)

Directiva de cierre v3.1, 2026-11-17. **Sin commits.** Rama `feat/evol-driven-studio`, `HEAD` `47a93c8`. Todo bajo `docs/research/evol-driven-studio/v3.1/`. **v2 y v3 no se modificaron**; v3.1 se creó copiando v3 y aplicando los cambios. El detalle archivo por archivo, con directiva, decisión y evidencia, está en `24-matriz-de-trazabilidad-de-modificaciones.md`.

## Estado por archivo de v3.1

| Archivo | Estado |
|---|---|
| `00-informe-ejecutivo.md` | **reescrito** |
| `01-auditoria-de-consistencia.md` | modificado (§3.1 cerrado; §5 nuevo) |
| `02-registro-de-decisiones.md` | modificado (OD-03, 09 ratificadas; OD-04 concretada; **OD-26, OD-27**; notas) |
| `03`, `04`, `05`, `06`, `07`, `08` | modificados (encabezados y reglas v3.1) |
| `09-control-center-modulos.md` | modificado (Centro de revisión con checklist; Repositorio) |
| `10-inventario-cli-ui.md` | modificado (`review.*`, `repo.*`, broker) |
| `11-modelo-de-seguridad-approval-broker.md` | **reescrito** (WebAuthn + Ed25519) |
| `12-skill-evol-studio-plugin-development.md` | modificado (encabezado y versión) |
| `13`, `14`, `15`, `16`, `17` | modificados (planes, roadmap, compatibilidad, deuda) |
| `19-matriz-de-conciliacion-normativa.md` | **reescrito** (35 filas; fichas; D-07 cerrada) |
| `20-informe-de-resolucion-de-hallazgos.md` | **reescrito** |
| `evidence-v3.md` | sin cambios (copiado de v3) |
| `evidence-v3.1.md` | **nuevo** (EV-057…072) |
| `21-contratos-approval-checklist.md` | **nuevo** |
| `22-especificacion-repository-explorer.md` | **nuevo** |
| `23-EVOL-STUDIO-UI-UX-SYSTEM.md` | **nuevo** |
| `24-matriz-de-trazabilidad-de-modificaciones.md` | **nuevo** |
| `25-condiciones-y-pruebas-pendientes.md` | **nuevo** |
| `26-propuesta-de-commit-y-paquete.md` | **nuevo** |
| `27-manifiesto-y-perfiles-dsh.md` | **nuevo** |
| `28-enmiendas-normativas.md` | **nuevo** |
| `18-archivos-modificados.md` | **reescrito** (este archivo) |

## Estado de Git

Solo hay **dos rutas sin rastrear**: `docs/research/` y `docs/code-memory-research/` (esta última, preexistente y ajena). No se tocó código, `.evol/`, `evol.config.json`, `.gitignore`, `CLAUDE.md`, `docs/ESPECIFICACION.md`, `docs/specs/*`, `docs/features/*`, `docs/plan/*`, dependencias, memorias, perfiles ni ejecutables. El ZIP de v3.1 y su archivo de sumas se crean **fuera** del árbol versionable y sin rastrear (doc 26).

## Efectos secundarios declarados

- Auto-minado de transcripciones por el hook de MemPalace durante la sesión (no fue estrictamente de solo lectura); no se escribió en Engram.
- Clones superficiales de repositorios de terceros en el directorio temporal de la sesión (heredados de v3; ninguno dentro del repositorio).
- Se descargó la especificación de WebAuthn Nivel 3 (solo lectura) al directorio temporal de la sesión para comprobar los datos citados; no se instaló nada.
- Se ejecutó localmente un fragmento de `node` para comprobar que `Ed25519` está disponible; no escribió archivos.
- Un intento anterior de recorrer `evol <comando> --help` en bucle fue denegado por el clasificador de permisos y no se reintentó.
