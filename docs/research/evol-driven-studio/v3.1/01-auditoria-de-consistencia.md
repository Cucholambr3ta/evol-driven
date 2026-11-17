# 01 — Auditoría de consistencia documental (v3.1)

Alcance: documentos de `docs/research/evol-driven-studio/` (00–17, ADR 001–006, evidencia), `docs/code-memory-research/` (copia de la investigación previa), `docs/specs/`, `docs/features/`, `docs/comparativas/`. Los informes históricos **no se reescriben**: este documento registra cada conflicto, la decisión aplicable y qué documento normativo la absorbe (los v2 prevalecen para el diseño; los anteriores quedan como historia).

## 1. Estado real (obligación previa, §2)

| Punto | Resultado | Evidencia |
|---|---|---|
| HEAD / rama / versión | `47a93c8` / `feat/evol-driven-studio` / 0.5.0 | EV-032 |
| Estado de Git | solo rutas no rastreadas de documentación; sin cambios en código | EV-032 |
| Módulos actuales | `src/{core,commands,codeintel,memory,agents,security,knowledge,skills,docs,diagrams,report,release,setup,improve}` | `ls src` |
| ADR vigentes | ninguno aprobado; 6 propuestos | EV-033 |
| Cambios posteriores a las auditorías | el único cambio de versión es la apertura del ciclo 3 (`47a93c8`); **ninguna brecha EV-003…008 se ha corregido** | git log |
| Implementado vs. solo especificado | todo lo de Studio (plugin, Approval Broker, Control Center, Model Routing, workers) es **solo diseño**; Evol-Driven aporta pipeline, gate, verify, CLI y MCP | docs 01 y EV-001…011 |
| Cambios preexistentes | `docs/code-memory-research/` no se toca | EV-032 |
| Brechas de evidencia | ver §3 | — |

## 2. Contradicciones y su resolución

| ID | Fuente A | Fuente B | Conflicto | Decisión aplicable | Modificación |
|---|---|---|---|---|---|
| C-01 | OD-09: baseline `0.2.1-rc.2` | OD-21: skill basada en `dsh-doc` de runtime | `0.2.1-rc.2` **no trae** la skill `dsh-doc` de runtime (EV-035) | **v3 — RESUELTA A NIVEL DE DISEÑO (H-03).** Se mantiene 0.2.1-rc.2 como candidata; la skill propia usa una **jerarquía de fuentes** (inspección en ejecución → documentación de la versión instalada → código y tipos → ejemplos de plugins → skills complementarias con procedencia, incl. las de `dsh-agent-teams/skills`, EV-046 → `dsh-doc` si existe) y no depende de una sola referencia. La falta de `dsh-doc` **no bloquea** la Tanda 1; OD-21 sigue exigiendo skill preparada y validada **antes del primer plugin propio** | doc 12 §2/§10, doc 13 §2, OD-09/OD-21 en doc 02. Verificación práctica pendiente en Tanda 1 |
| C-02 | OD-24 (enrutado por modelo/razonamiento) | EV-039 | La semántica de `reasoning_effort` en delegación cambia en 0.2.2-alpha.2: en la baseline 0.2.1-rc.2 el comportamiento no es el de versiones posteriores | El diseño de Model Routing define un **adaptador por versión**; la UI muestra solo esfuerzos devueltos por `list_subagent_models` y no asume equivalencias | doc 06 |
| C-03 | Tabla de memoria del prompt (`dsh-evidence` opcional) | EV-041 (v2) | v2 afirmó que el proyecto no se encontró | **v3 — CORREGIDA (H-06).** EV-047: el proyecto **existe** (`Cooberped/dsh-evidence`, paquete `@baseland/dsh-evidence`, beta 0.6.0-beta.4, MIT). Existencia pública ≠ compatibilidad ≠ adopción: queda como **plugin documental opcional candidato**, fuera de la baseline; EV-041 se conserva con su limitación (búsqueda compuesta con WebSearch estándar, sin consulta directa a GitHub/npm) | doc 08 §1, doc 16, doc 13 §4, OD-03/OD-18 |
| C-04 | Prompt: `dsh-deja / deja-vu` como historial | EV-040 | Paquete npm `dsh-deja` y repo `deja-vu` coinciden, pero indexa **todos** los agentes y su instalador escribe guías de usuario | Permitido solo con lista cerrada de directorios y sin el paso «wire installed agents» | doc 08 |
| C-05 | Doc 03/ADR-004 anteriores: «decidir memoria tras benchmark; MemPalace oficial hasta entonces» | OD-03: baseline `dsh-mnemon + Mnemon Native` para **nuevas** instalaciones | Dos criterios de entrada distintos | Se concilian: OD-03 fija la **baseline de producto** (instalaciones nuevas); el benchmark del doc 11 sigue siendo la **condición de ratificación**. MemPalace y Engram permanecen para instalaciones existentes. ADR-004 queda «reemplazado parcialmente por OD-03» | registro v2; ADR-004 no se edita |
| C-06 | Doc 05/ADR-005 anteriores: motor nativo para gobernanza + CBM como adaptador | OD-05: CBM para símbolos/búsqueda/grafo/impacto; Evol conserva lo que une código-tareas-pruebas-CA | Coinciden en el fondo; difiere el énfasis | Se adopta OD-05 con la condición de entrada de seguridad de ADR-005 (0 tráfico saliente, no tocar configuración de agentes, aislamiento por proyecto) | registro v2 |
| C-07 | Doc 06 anterior: «aprobar solo con TTY» (OD-04 original) | OD-04 confirmada: botón «Autorizar avance» con autenticación humana real y backend protegido | **Sustituye** la propuesta de «solo TTY» | OD-04 prevalece; el TTY pasa a ser **un** factor posible del Approval Broker, no el mecanismo único (doc 11) | doc 06 anterior queda histórico |
| C-08 | Doc 07 y ADR-003: «AgentTeams o `team` nativo» | OD-07: AgentTeams principal, `team` nativo de contingencia | Coinciden | Sin cambio | — |
| C-09 | Doc 08 anterior: Plugin Edition sobre `dsh web`; Desktop Linux sin soporte | OD-06 | Coinciden; refuerza «Arch Linux DSH Web local» | Sin cambio; Desktop Linux sigue sin objetivo en Harness (EV-018) | — |
| C-10 | Doc 13 anterior: Hito 0…9 | Prompt §18: H0…H10 | Secuencias distintas | El roadmap v2 (doc 15) sustituye al anterior; **conserva** como prerequisitos las correcciones del Hito 1 anterior (brechas EV-003…008) dentro de H0/H1 | doc 15 |
| C-11 | Doc 14 R-18 / benchmark: CBM «no se adopta por popularidad» | OD-05 adopta CBM como baseline | Adopción **antes** de reproducir cifras | La adopción es *condicionada*; ninguna cifra del autor se usa como criterio hasta reproducirla (doc 16 y 17) | registro v2 |
| C-12 | Doc 10 anterior: «sin servicio HTTP» | OD-15 | Coinciden | Sin cambio | — |
| C-13 | Doc 16 anterior OD-01…OD-14 | Prompt OD-01…OD-25 | Numeración de OD anterior (OD-04 = firma; OD-06 = Desktop Linux, etc.) difiere de la nueva | **La numeración normativa pasa a ser la del prompt EVOL-STUDIO-ARCH-UPDATE-002.** Mapa de equivalencias en el registro v2 | doc 02 §3 |
| C-14 | Doc 17 anterior: primer paso vertical = Pipeline Explorer de solo lectura | Prompt H2 | Coinciden | Sin cambio | — |
| C-15 | v2 doc 15 H7: «Rollback: volver a `evol approve` por terminal humano» | OD-04 (sin rutas alternativas de aprobación) | El rollback restablecía una ruta de aprobación sin las garantías del broker | **v3 — RESUELTA (H-01).** Fallo cerrado + recuperación; sin bypass | docs 11 §6, 15 H7, 02 OD-04, 17, 14 |
| C-16 | v2 doc 10: `verify` y `doctor` = Reader | EV-048/049 | `verify` (fin) ejecuta comandos de shell de la configuración; `doctor` lanza procesos y puede consultar red | **v3 — RESUELTA (H-02).** Clasificación por efectos reales | doc 10, doc 11 §4 |
| C-17 | Investigación v1 EV-006: «el estado no se concilia con el log» | `doctor.ts:158-168` (CA-134) | `evol doctor` sí compara; `verify`/`approve`/`next` no. **v1 EV-006 era una inferencia parcialmente incorrecta** | **v3 — CORREGIDA** por EV-045; el original no se edita | evidence-v3, doc 02 OD-16 |
| C-18 | `ESPECIFICACION.md` criterio 22 y ayuda CLI: «MCP de solo lectura… no cambia el estado» | EV-004/048/051 | El MCP escribe (`evol_memory_add`, `evol_checkpoint`, `evol_index`) y ejecuta (`evol_verify`) | Contradicción **spec vs. código**; v3 propone separar lectura/escritura y **enmendar** la spec y la ayuda | doc 19 N-01, doc 10 §4 |
| C-19 | `ESPECIFICACION.md:718`: «solo un agente propio (`/evol`); sin agentes efímeros bajo demanda» | OD-20, OD-25 | Los subagentes bajo demanda requieren «decisión explícita y entrada en la especificación» | **Pendiente de ratificación**; no se declara resuelto hasta enmendar la spec | doc 19 N-07 |
| C-20 | `ESPECIFICACION.md` Ampliación 3 (`evol ui`, borrador) | OD-17/OD-19 (Control Center) | Dos diseños de interfaz | `evol ui` se **absorbe** en el Control Center; mockups reutilizables | doc 19 N-09, OD-17 |
| C-21 | `release/notice.ts`: consulta de red diaria (`actualizaciones.aviso`) | OD-10 (sin descargas silenciosas) | Valor por defecto no verificado | **Pendiente de prueba**; desactivar por política | doc 19 N-12 |

## 3. Brechas de evidencia que quedan abiertas (v3: la n.º 1 se trata en el doc 19)

1. **Conciliación normativa (H-04):** **cerrada en v3.1** (`19-matriz-de-conciliacion-normativa.md`): lectura íntegra de 2 931 líneas de normativa (EV-057); N-01, N-07, N-10 y N-24 resueltas por enmienda redactada (doc 28); N-06 es una **no conformidad del código** (NC-01), no de la norma. Las enmiendas no están incorporadas al texto normativo (D-11).
2. Comportamiento real de AgentTeams, dsh-mnemon y CBM en un perfil aislado: ninguna combinación probada.
3. Disponibilidad de `cordis_inspect_*` y de la interfaz de aprobación de herramientas en 0.2.1-rc.2.
4. Alcance exacto de los permisos que Harness hace cumplir a nivel de proceso (SAFETY.md dice que no son garantía).
5. Estado y semántica de `evol next/approve` frente a un Approval Broker externo (requiere diseño de integración con `gate.ts`, doc 11).
6. Tabla de OD de la investigación anterior vs. nueva: resuelta en §2 (C-13).

## 4. Trazabilidad del cambio

Cada contradicción tiene un documento normativo v2 destinatario. Los documentos 00–17 y los ADR 001–006 se conservan sin edición; su estado queda: *histórico, con las sustituciones indicadas arriba*. El registro v2 (doc 02) lista, por decisión, qué documento anterior sustituye o completa.

## 5. Cambios de v3.1 sobre las contradicciones

| ID | Estado v3.1 |
|---|---|
| C-18 (MCP) | resuelta documentalmente por AMD-01; la spec se contradecía a sí misma (EV-058) |
| C-19 (agentes) | resuelta documentalmente por AMD-02 (enmienda autorizada por el propietario) |
| C-20 (`evol ui`) | resuelta por AMD-05 |
| C-21 (aviso de versión) | pendiente de prueba (N-12) |
| C-05 (benchmark de memoria como condición de ratificación) | OD-03 ratificada; el benchmark pasa a condición de **aceptación de la integración** |
| **C-22 (nueva)** | Firmas: la Ampliación 2 decía «no hay firmas por persona; HMAC» y OD-04 pide WebAuthn + Ed25519 → **sustituida** por AMD-03 en el perfil `broker` |
| **C-23 (nueva)** | Criterio 62 (Documentación abre en Constelación) frente a la directiva de lista primero → **sustituido** por AMD-05 |
| **C-24 (nueva)** | Cifras de disciplinas «31» frente a «35» en la propia spec → observación O-01, ajena a Studio |
