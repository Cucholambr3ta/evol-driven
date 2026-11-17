# 17 — Registro de deuda, bloqueos reales y pendientes (v3)

Separa **bloqueos reales** (impiden avanzar con seguridad) de **mejoras posteriores**. Estado a 2026-11-17.

## A. Bloqueos reales, separados por etapa

**v3 (H-03): B-01 ya no es un bloqueo real de la Tanda 1.** Se reclasifica abajo.

### A.1 Tanda 1 (preparación de DSH)

| ID | Bloqueo | Estado |
|---|---|---|
| B-06 | Compatibilidad AgentTeams ↔ versión de Harness elegida no probada | prueba de Tanda 1 |
| B-07 | Condiciones de entrada de CBM sin comprobar (red, config de agentes, daemon compartido) | prueba de Tanda 1 |
| B-08 | Ratificación del propietario de OD-09 (versión candidata) y OD-03 | decisión pendiente (no técnica) |

### A.2 Tanda 2 (integración)

| ID | Bloqueo | Impide |
|---|---|---|
| B-02 | Estado no bloqueante ante discrepancia: `doctor` detecta, `verify`/`approve`/`next` no (EV-045) | H2, H7 |
| B-03 | MCP mezcla lectura, escritura y ejecución sin anotar (EV-004, 048) | exponer Evol a agentes |
| B-04 | Sin lock de concurrencia en `.evol/` (EV-007) | H3 |
| B-05 | Factor de presencia humana y custodia de la clave sin decidir (OD-04) | H7 |
| B-09 | Tabla única de permisos por efectos (doc 10) sin implementar ni probar | operaciones mutantes |

### A.3 Publicación estable

Matriz de compatibilidad con combinaciones «probadas», licencias transitivas inventariadas, red cero demostrada, pruebas P-01…P-17 ejecutadas.

### A.4 Reclasificados en v3

| ID | Antes | Ahora |
|---|---|---|
| B-01 (C-01) | **bloqueo real** de la Tanda 1 | **resuelto a nivel de diseño**; verificación práctica = tarea de Tanda 1; sigue siendo prerequisito del **primer plugin propio** (la skill debe estar validada) |

### A.5 Tabla de v2 conservada (referencia histórica; **B-01 sustituido por A.4; B-02…B-04 reformulados en A.2**)

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
| D-07 | **PARCIALMENTE CERRADA (v3):** normativa efectiva contrastada en `19-matriz-de-conciliacion-normativa.md`; 4 contradicciones abiertas con corrección definida (N-01, 06, 07, 10). **Falta** leer íntegra `ESPECIFICACION.md` (Amp. 2, 5, 6) para cerrarla del todo | doc 19 |
| D-08 | Licencias transitivas sin inventariar (OD-08) | doc 02 |
| D-09 | `docs/code-memory-research/` y `docs/research/` sin commit | EV-032 |
| D-10 | Evol-Driven con licencia privada: decisión antes de publicar | OD-08 |
| D-11 | Enmiendas pendientes a la normativa (doc 19 §5) | H4 |
| D-12 | `verify` ejecuta comandos de la configuración vía MCP/CLI: política de revisión de `comandos` y aviso previo (EV-048) | doc 10 |
| D-13 | Lectura/escritura de la clave del gate por el mismo usuario (T-1) y HMAC simétrico: sub-decisión de firma | doc 11 §2 |
| D-14 | `dsh-evidence`: evaluación completa pendiente (opcional) | doc 08 §11 |

## C. Pendientes de verificación (ninguna ejecutada)

Carga de plugins; extensibilidad de Harness (plugin real); benchmarks de memoria y de código (umbrales fijados antes); pruebas de seguridad (9 del doc 11); coexistencia de plugins; reinicio con tareas; red cero; restauración de copias; calibración de concurrencia y de topes de reintento.

## D. Mejoras posteriores (no bloquean)

Estados de evidencia más finos; interfaz móvil; modo multiusuario; Desktop Linux (OD-06, H10); inclusión de `dsh-session-eval`/`dsh-session-export` como complementos de evidencia (UNVERIFIED); más proveedores de memoria; telemetría **local** de calidad de recuperación.

## E. Incertidumbres declaradas

Todas las puntuaciones de las matrices son juicios cualitativos; las cifras de Codebase Memory MCP y las de otros autores no se reprodujeron; AgentTeams depende de costuras privadas de subagentes (puede romperse con la versión de Harness); la seguridad de Harness no está auditada; algunos hechos de comportamiento (por ejemplo la aplicación real de `reasoning_effort` en 0.2.1-rc.2) se infieren de la documentación.
