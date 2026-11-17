# 17 — Registro de deuda, bloqueos reales y pendientes

Separa **bloqueos reales** (impiden avanzar con seguridad) de **mejoras posteriores**. Estado a 2026-11-17.

## A. Bloqueos reales de implementación

| ID | Bloqueo | Impide | Qué lo resuelve | Dueño |
|---|---|---|---|---|
| B-01 | **C-01:** la skill `dsh-doc` de runtime no existe en 0.2.1-rc.2 (EV-035) | OD-21, Tanda 1 | decidir versión (0.2.2-rc.2) o incorporar referencias atribuidas, o verificar `cordis_inspect_*` | propietario |
| B-02 | Estado no conciliado con el log firmado (EV-006) | H2, H7 | verificación estado↔log + prueba aislada | H0 |
| B-03 | MCP mezcla lectura y escritura sin anotar (EV-004) | exponer Evol a agentes en Studio | separar y anotar | H0 |
| B-04 | Sin lock de concurrencia en `.evol/` (EV-007) | H3 (varios agentes) | lock de proyecto | H0 |
| B-05 | Factor de presencia humana no decidido (OD-04) | H7 | decidir opción B/C del doc 11 y probarla | propietario + seguridad |
| B-06 | Compatibilidad AgentTeams ↔ versión de Harness elegida no probada (EV-036) | H3 | prueba en Tanda 1 | Tanda 1 |
| B-07 | Condiciones de entrada de CBM sin comprobar (red, config de agentes, daemon compartido) | H4 | pruebas del doc 11 anterior | Tanda 1/H4 |

## B. Deuda técnica registrada (no bloquea el inicio, sí la liberación)

| ID | Deuda | Fuente |
|---|---|---|
| D-01 | Consultas del grafo escriben (EV-003) | H0 |
| D-02 | Cobertura de CA por referencia (EV-011) | H6 |
| D-03 | Cola de cascada del grafo en memoria; id de símbolo sin identidad estable | `docs/code-memory-research/` |
| D-04 | Memoria: 3 wings del mismo proyecto; duplicados; sin estado por recuerdo | EV-012 |
| D-05 | Sin registro de rechazos de aprobación | EV-009 |
| D-06 | Inventario CLI→UI sin subcomandos/opciones exactos (doc 10) | H8 |
| D-07 | Specs vigentes (`docs/specs/*`, `FEATURES.md`) no releídas contra los v2 | doc 01 §3 |
| D-08 | Licencias transitivas sin inventariar (OD-08) | doc 02 |
| D-09 | `docs/code-memory-research/` y `docs/research/` sin commit | EV-032 |
| D-10 | Evol-Driven con licencia privada: decisión antes de publicar | OD-08 |

## C. Pendientes de verificación (ninguna ejecutada)

Carga de plugins; extensibilidad de Harness (plugin real); benchmarks de memoria y de código (umbrales fijados antes); pruebas de seguridad (9 del doc 11); coexistencia de plugins; reinicio con tareas; red cero; restauración de copias; calibración de concurrencia y de topes de reintento.

## D. Mejoras posteriores (no bloquean)

Estados de evidencia más finos; interfaz móvil; modo multiusuario; Desktop Linux (OD-06, H10); inclusión de `dsh-session-eval`/`dsh-session-export` como complementos de evidencia (UNVERIFIED); más proveedores de memoria; telemetría **local** de calidad de recuperación.

## E. Incertidumbres declaradas

Todas las puntuaciones de las matrices son juicios cualitativos; las cifras de Codebase Memory MCP y las de otros autores no se reprodujeron; AgentTeams depende de costuras privadas de subagentes (puede romperse con la versión de Harness); la seguridad de Harness no está auditada; algunos hechos de comportamiento (por ejemplo la aplicación real de `reasoning_effort` en 0.2.1-rc.2) se infieren de la documentación.
