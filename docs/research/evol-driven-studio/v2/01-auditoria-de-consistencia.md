# 01 — Auditoría de consistencia documental

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
| C-01 | OD-09: baseline `0.2.1-rc.2` | OD-21: skill basada en `dsh-doc` de runtime | `0.2.1-rc.2` **no trae** la skill `dsh-doc` de runtime (solo la de mantenimiento del repo) (EV-035) | **Pendiente de decisión humana.** Opciones: (a) fijar 0.2.2-rc.2 (AgentTeams lo soporta como «preview») para Tanda 1; (b) mantener 0.2.1-rc.2 e **incorporar al repositorio de Studio una copia con atribución de las referencias** necesarias (MIT) y apoyarse en la inspección en ejecución; (c) validar si `cordis_inspect_*` existe en 0.2.1-rc.2. Hasta resolverlo, OD-09 sigue como candidata y OD-21 como bloqueada por dependencia | OD-09 y OD-21 actualizadas en el registro v2 |
| C-02 | OD-24 (enrutado por modelo/razonamiento) | EV-039 | La semántica de `reasoning_effort` en delegación cambia en 0.2.2-alpha.2: en la baseline candidata el comportamiento no es el de versiones posteriores | El diseño de Model Routing define un **adaptador por versión**; la UI muestra solo esfuerzos devueltos por `list_subagent_models` y no asume equivalencias | doc 06 |
| C-03 | Tabla de memoria del prompt (`dsh-evidence` opcional) | EV-041 | El proyecto nombrado no se encontró | Se excluye de la baseline; la evidencia documental queda a cargo de Evol-Driven | doc 08 y registro |
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

## 3. Brechas de evidencia que quedan abiertas

1. Contenido normativo de `docs/specs/{SPEC,DOMAIN,THREATS}.md` y de `docs/features/FEATURES.md` **no releído**: puede contener requisitos que choquen con los v2.
2. Comportamiento real de AgentTeams, dsh-mnemon y CBM en un perfil aislado: ninguna combinación probada.
3. Disponibilidad de `cordis_inspect_*` y de la interfaz de aprobación de herramientas en 0.2.1-rc.2.
4. Alcance exacto de los permisos que Harness hace cumplir a nivel de proceso (SAFETY.md dice que no son garantía).
5. Estado y semántica de `evol next/approve` frente a un Approval Broker externo (requiere diseño de integración con `gate.ts`, doc 11).
6. Tabla de OD de la investigación anterior vs. nueva: resuelta en §2 (C-13).

## 4. Trazabilidad del cambio

Cada contradicción tiene un documento normativo v2 destinatario. Los documentos 00–17 y los ADR 001–006 se conservan sin edición; su estado queda: *histórico, con las sustituciones indicadas arriba*. El registro v2 (doc 02) lista, por decisión, qué documento anterior sustituye o completa.
