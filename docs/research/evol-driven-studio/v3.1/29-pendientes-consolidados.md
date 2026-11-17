# 29 — Pendientes consolidados: plan de cierre (EVOL-STUDIO-PENDING-CLOSURE-001)

Baseline v3.1 · actualizado 2026-11-17 · **solo documental**: no se instaló nada, no se tocó código del framework, no se ejecutó ninguna prueba, no se hizo `push`. Fuentes: docs 17, 25 y 28, ADR y normativa. La numeración 1–50 y los identificadores originales (S-, D-, NC-, C-T1…) se **conservan**; el texto original de esta lista está al final como anexo.

## 1. Estados (vocabulario obligatorio)

`DECIDED` decisión ratificada, sin implicar implementación · `SPECIFIED` contrato o procedimiento documentado · `READY` preparado para ejecutarse · `IN_PROGRESS` ejecución iniciada · `VERIFIED` resultado demostrado por evidencia · `BLOCKED` falta una condición obligatoria · `DEFERRED` explícitamente fuera de la edición actual · `CLOSED` criterio de cierre cumplido por completo.

**Reglas:** (1) ningún asunto pasa a `DECIDED` sin confirmación expresa del propietario: las propuestas S-*, D-10 y el paquete de OD quedan `SPECIFIED` con su **ratificación pendiente**; (2) `SPECIFIED` no es `VERIFIED`: ningún trabajo de las Tandas 1 y 2 está ejecutado; (3) `CLOSED` solo cuando se cumple el criterio completo del asunto; (4) el estado anterior de todo asunto es «pendiente» (doc 29 original), salvo indicación.

## 2. Tabla única de los 50 asuntos

Responsables: **P** = propietario · **CC** = Claude Code (documental) · **P+CC** = ejecución conjunta (la persona ejecuta en cada equipo; CC prepara y revisa) · **T2** = Tanda 2 (implementación bajo el pipeline de `evol`).

| # | ID | Responsable | Decisión que lo gobierna | Etapa | Anterior | **Nuevo** | Evidencia | Dependencia | Siguiente acción |
|---|---|---|---|---|---|---|---|---|---|
| 1 | commits `f8490ab`, `20ed7b8` | P | D-09 | Decisión | pendiente | **READY** | EV-074: la rama no está en el remoto `origin` | autorización de `push` | P autoriza o ejecuta `git push -u origin feat/evol-driven-studio`; verificar con `git ls-remote` antes de cerrar |
| 2 | preflight de equipo | P+CC | OD-09 | Tanda 1 | pendiente | **SPECIFIED** | doc 30 Fase −1; EV-073/074 (Evol exige Node ≥ 24; DSH `^22.19 \|\| >=24`) | — | ejecutar el preflight en cada equipo y adjuntar `preflight.txt` |
| 3 | S-26-1 | P | OD-26 | Decisión | pendiente | **SPECIFIED** | doc 21 §6; doc 02 paquete | confirmación formal | P confirma o ajusta la lista de operaciones excepcionales |
| 4 | S-04-1 | P | OD-04 | Decisión | pendiente | **SPECIFIED** | doc 11 §6.1 | confirmación formal; autenticador (D-16) | P confirma; comprobar hardware en destino |
| 5 | S-04-2 | P | OD-04 | Decisión | pendiente | **SPECIFIED** | doc 11 §3.2, §6.2 | confirmación formal | P confirma 12 meses y 5 min |
| 6 | S-27-1 | P | OD-27 | Decisión | pendiente | **SPECIFIED** | doc 22 §5 | confirmación formal; viabilidad del servicio protegido | P confirma |
| 7 | S-12 | P | OD-12 | Decisión | pendiente | **SPECIFIED** | doc 02 OD-12 | confirmación; gancho `commit-msg` en H0 | P confirma; implementar el gancho en H0 |
| 8 | S-23-1 / D-15 | P | OD-17 | Decisión | pendiente | **SPECIFIED** | doc 23 §2; UX-03 pendiente | confirmación; contraste real sin medir | P confirma; medir contrastes al construir |
| 9 | AMD-01…08 / D-11 | CC | OD-20, OD-25… | Decisión | pendiente | **SPECIFIED** | doc 28 «Calendario»; `ESPECIFICACION.md` sin modificar (EV-074) | fase *spec* del ciclo 3 con aprobación humana | **Discrepancia resuelta:** ninguna enmienda está incorporada; «AMD-01 y 02 ya» era calendario. Incorporarlas en el orden de doc 28 |
| 10 | D-10 | P | OD-08 | Decisión | pendiente | **SPECIFIED** | doc 02 OD-08; doc 25 §6 | confirmación | P confirma; la licencia de publicación se decide antes de distribuir |
| 11 | paquete OD | P | OD-01…23 | Decisión | pendiente | **SPECIFIED** | doc 02 «Paquete de ratificación» | confirmación expresa | P ratifica el conjunto o por partes; no se cambia ningún estado antes |
| 12 | `studio.lock.json` | P+CC | OD-09 | Tanda 1 | pendiente | **READY** | doc 27 §2; hash de DSH completo (EV-073) | preflight PASS; autorización de ejecución | generar tras la Fase 3 y 6 del runbook |
| 13 | instalación DSH | P+CC | OD-09 | Tanda 1 | pendiente | **READY** | doc 30 Fase 3 (versión exacta, integridad) | preflight PASS; autorización | instalar `@deepseek-ai/dsh@0.2.1-rc.2` en prefijo aislado |
| 14 | instaladores (B-07) | P+CC | OD-05, OD-18 | Tanda 1 | pendiente | **READY** | doc 27 §4; doc 30 Fase 5 | preflight (`bwrap`, `strace`); autorización | probar en `HOME` desechable, sin red primero |
| 15 | C-T1-01…10, P-34 (B-06) | P+CC | OD-07, OD-20 | Tanda 1 | pendiente | **SPECIFIED** | doc 27 §6 | #13 | ejecutar tras instalar DSH y AgentTeams |
| 16 | red por componente | P+CC | OD-10 | Tanda 1 | pendiente | **SPECIFIED** | doc 27 §4, doc 08 | #13, #14 | capturar con `strace`/espacio de red sin salida |
| 17 | condiciones OD-03 | P+CC | OD-03 | Tanda 1 | pendiente | **SPECIFIED** | doc 25 §1; doc 31 §2 | #14 | medir offline, aislamiento, procedencia, captura |
| 18 | benchmarks | P+CC | OD-03, OD-05 | Tanda 1 | pendiente | **SPECIFIED** | **doc 31 (nuevo): metodología y umbrales propuestos** | aprobación **antes** de medir; #14 | P aprueba doc 31; congelar el conjunto de preguntas |
| 19 | skill fundacional | P+CC | OD-21 | Tanda 1 | pendiente | **SPECIFIED** | doc 12 §9 | #13 | validar activación y operación sin `dsh-doc` |
| 20 | respaldo y restauración | P+CC | OD-22 | Tanda 1 | pendiente | **SPECIFIED** | doc 13 §4; doc 30 Fase 7 | #13 | copiar, borrar y restaurar `DSH_HOME` |
| 21 | handoff | P+CC | OD-22 | Tanda 1 | pendiente | **SPECIFIED** | doc 13 §5 | #12…#20 | emitir el informe con comando y salida de cada dato |
| 22 | incompatibilidades | P | OD-09 | Tanda 1 | pendiente | **SPECIFIED** | doc 27 §5 | resultados de #15 | si hay BLOCK: propuesta documentada y autorización antes de tocar la baseline |
| 23 | NC-01 (B-02) | T2 | OD-16 | Tanda 2 (H0) | pendiente | **SPECIFIED** | doc 19 §3.2; EV-045 | handoff (#21) | `verify`/`approve`/`next` bloquean la discrepancia; prueba P-06 y de regresión |
| 24 | NC-02 (B-03) | T2 | OD-11, AMD-01 | Tanda 2 (H0) | pendiente | **SPECIFIED** | doc 28 AMD-01; EV-058 | #21; AMD-01 incorporada | anotar herramientas por efecto; retirar modo `fin` de `evol_verify` |
| 25 | NC-04 (B-04) | T2 | OD-16 | Tanda 2 (H0) | pendiente | **SPECIFIED** | EV-007 | #21 | lock de `.evol/` con pruebas de concurrencia y recuperación |
| 26 | NC-05 (D-01) | T2 | OD-14 | Tanda 2 (H0) | pendiente | **SPECIFIED** | EV-003 | #21 | `impact`/`trace` sin escritura; hash antes/después |
| 27 | RBAC único (B-09) | T2 | OD-11 | Tanda 2 | pendiente | **SPECIFIED** | doc 10 | #24 | tabla única en `core`; prueba P-14 |
| 28 | NC-03 (Ed25519) | T2 | OD-04 | Tanda 2 (H7) | pendiente | **SPECIFIED** | doc 11 §4 | #23, #29 | entrada v2, broker, verificación pública, migración `epoch-start` |
| 29 | aislamiento del broker | T2+P | OD-04 | Tanda 2 (H7) | pendiente | **SPECIFIED** | doc 11 §7; P-18 | entorno de pruebas del broker | ejecutar P-18; si falla, el mecanismo queda pendiente de validación |
| 30 | WebAuthn/FIDO2 (D-16) | P+T2 | OD-04 | Tanda 2 (H7) | pendiente | **SPECIFIED** | doc 11; EV-070; EV-068 | equipo de destino con llave y navegador | probar origen, RP ID `*.localhost`, UV y autenticadores en destino |
| 31 | P-18…P-34 | T2 | OD-04, OD-20 | Tanda 2 (H7) | pendiente | **SPECIFIED** | doc 11 §11 | #28, #29, #30 | ejecutar, registrar hallazgos y correcciones |
| 32 | NC-06 (`MemoryProvider`) | T2 | OD-03, AMD-04 | Tanda 2 (H4) | pendiente | **SPECIFIED** | doc 08; doc 28 | #17 | interfaz con pruebas de contrato para `mempalace` y `mnemon` |
| 33 | NC-07 (checklist, B-11) | T2 | OD-26 | Tanda 2 (H7) | pendiente | **SPECIFIED** | doc 21 | #28 | eventos, invalidación, `review.*`; AC-CL-01…16 |
| 34 | Repository Explorer (D-17) | T2 | OD-27 | Tanda 2 (H8b) | pendiente | **SPECIFIED** | doc 22 | #27 | conectores de lista permitida; RE-01…12 |
| 35 | UX-01…12 | T2 | OD-17, OD-19 | Tanda 2 | pendiente | **SPECIFIED** | doc 23 §7 | primera interfaz | accesibilidad y estados |
| 36 | D-12 comandos configurables | T2 | OD-11 | Tanda 2 | pendiente | **SPECIFIED** | EV-048, EV-072; doc 10 | #24 | mostrar y autorizar `comandos` antes de ejecutar; advertencia |
| 37 | D-06 inventario CLI→UI | T2 | OD-19 | Tanda 2 (H8) | pendiente | **SPECIFIED** | doc 10 (36 comandos) | #27 | mapa exacto de subcomandos, opciones y permisos |
| 38 | compatibilidad probada | P+CC | OD-18 | Publicación | pendiente | **SPECIFIED** | doc 16 | Tanda 1 y 2 | certificar la matriz con pruebas |
| 39 | licencias transitivas (D-08) | CC | OD-08 | Publicación | pendiente | **SPECIFIED** | doc 02 | `studio.lock.json` | inventario con herramienta (`syft`/`reuse`) y cumplimiento |
| 40 | red cero | P+CC | OD-10 | Publicación | pendiente | **SPECIFIED** | doc 08, doc 27 | #16 | pruebas de tráfico y operaciones offline |
| 41 | P/AC/RE/UX + revisión independiente | P | OD-04… | Publicación | pendiente | **SPECIFIED** | doc 25 §2 | Tanda 2 | pasar todo y encargar la revisión de seguridad |
| 42 | AMD incorporadas | P+CC | doc 28 | Publicación | pendiente | **SPECIFIED** | doc 28 «Calendario» | #9 | incorporar todas con trazabilidad |
| 43 | Desktop Linux (OD-06, H10) | P | OD-06 | Publicación | pendiente | **DEFERRED** | EV-018 (sin objetivo Linux en Harness) | propio gate de publicación | fuera de la primera Plugin Edition; comunicar el alcance; no bloquea |
| 44 | D-02 cobertura de CA | T2 | OD-14 | Deuda | pendiente | **SPECIFIED** | EV-011 | H6 | ver tabla §7 |
| 45 | D-03 grafo | T2 | OD-14 | Deuda | pendiente | **SPECIFIED** | `docs/code-memory-research/` | H0/H4 | ver §7 |
| 46 | D-04 memoria duplicada | P+CC | OD-03 | Deuda | pendiente | **SPECIFIED** | EV-012 | #17 | ver §7 |
| 47 | D-05 rechazos | T2 | OD-04 | Deuda | pendiente | **SPECIFIED** | EV-009; doc 11 §4.2 (`rejected`) | #28 | ver §7 |
| 48 | D-14 `dsh-evidence` | CC | OD-18 | Deuda | pendiente | **SPECIFIED** | EV-047; doc 08 §11 | #17 | ver §7 |
| 49 | O-01 cifras 31/35 | CC | — | Deuda | pendiente | **VERIFIED** | EV-074: **35** disciplinas (14 base + 21 extendidas); la spec dice «31» en criterios 6, 7 y 76 | AMD (nota) | Diagnóstico demostrado; **no CLOSED**: falta anotar la cifra en el texto normativo (calendario AMD) |
| 50 | N-12 `actualizaciones.aviso` | CC | OD-10 | Deuda | pendiente | **CLOSED** (documental) | EV-074: `notice.ts:57-65`, **activado por defecto**; doc 19 N-12 corregido | — | Studio debe fijar `aviso: false` en su perfil (se comprueba en #16) |

## 3. Resumen exacto de estados

| Estado | Cantidad | Asuntos |
|---|---|---|
| `DECIDED` | **0** | ninguna ratificación nueva sin confirmación expresa |
| `SPECIFIED` | **43** | 2–11, 15–42, 44–48 |
| `READY` | **4** | 1, 12, 13, 14 |
| `VERIFIED` | **1** | 49 |
| `CLOSED` | **1** | 50 |
| `DEFERRED` | **1** | 43 |
| `IN_PROGRESS`, `BLOCKED` | **0** | — |

Ningún trabajo de las Tandas 1 y 2 ni de publicación está `VERIFIED`. `READY` significa «preparado», no «autorizado»: 12, 13 y 14 esperan el preflight y la autorización de ejecución.

## 4. Decisiones que requieren confirmación del propietario

Propuestas ya **formalizadas** y esperando su confirmación formal: S-26-1, S-04-1, S-04-2, S-27-1, S-12, S-23-1, D-10 y el **paquete de ratificación** de OD-01, 02, 05, 06, 07, 08, 10…18, 22 y 23 (doc 02, sección final). Además: autorización del `push` (#1), autorización de ejecutar la Tanda 1 y aprobación de la metodología de benchmarks (#18, doc 31).

## 5. Plan de ejecución de la Tanda 1 (READY a la espera de autorización)

1. **Preflight** en el equipo de desarrollo (#2). PASS → continuar; BLOCK → corregir antes.
2. **#13** instalar DSH `0.2.1-rc.2` en prefijo aislado y comprobar integridad; **#12** empezar `studio.lock.json`.
3. **Aprobar la metodología** del doc 31 antes de medir nada (#18).
4. **#14** probar instaladores en `HOME` desechable (sin red primero).
5. **#15, #16, #17, #19** pruebas de compatibilidad, red, memoria y skill, solo con los plugins que pasaron el paso 4.
6. **#20** respaldo y restauración. 7. **#12** cerrar el manifiesto y probar su reproducibilidad (C-T1-10).
8. **#21** handoff. Si hay BLOCK: **#22** propuesta de cambio, nunca cambio directo.
9. Repetir la instalación en el equipo de instalación solo desde el manifiesto cerrado, más preflight y pruebas de destino (FIDO2, navegador).

Cierre de la tanda: **no se aprueba** sin evidencia reproducible; los WARN se registran con impacto y tratamiento; un BLOCK mantiene su estado.

## 6. Condiciones de integración de la Tanda 2 y bloqueos de publicación

**Para empezar la Tanda 2:** handoff verificable (#21); H0 comprobado (#23–#26) **antes** de habilitar cualquier autorización de fases; AMD-01 y AMD-02 incorporadas (#9); ningún mecanismo antiguo como bypass de recuperación; cada NC con su prueba de regresión y referencia al cambio de código.

**Bloqueos exclusivos de publicación:** #38 a #42 (compatibilidad probada, licencias, red cero, pruebas e independiente, enmiendas) y la decisión de licencia pública (#10). La **Desktop Edition (#43)** tiene su propio gate y **no bloquea** la primera Plugin Edition si el alcance se comunica correctamente.

## 7. Deuda heredada: tratamiento

| # | Deuda | Responsable | Prioridad | Hito | Prueba | Criterio de cierre |
|---|---|---|---|---|---|---|
| 44 | D-02 cobertura de CA por referencia | T2 | media | H6 | una prueba que no ejerce el criterio queda «referencia encontrada» | estados de evidencia (referencia/ejecutada) y revisión semántica de al menos los CA críticos; si no, **deuda explícita** con fecha |
| 45 | D-03 cola de cascada e id de símbolo | T2 | media | H0/H4 | reindexar tras cambio masivo; ids estables entre renombrados | cola persistida y id estable con prueba de regresión |
| 46 | D-04 memoria duplicada | P+CC | alta antes de OD-03 en uso | Tanda 1 | inventario de wings y duplicados | **un solo proveedor de escritura** por proyecto; **migración solo si el propietario la autoriza** y reversible |
| 47 | D-05 rechazos | T2 | media | H7 | rechazo firmado `rejected` por el broker; un agente no puede crearlo | registro de rechazos con identidad humana verificada |
| 48 | D-14 `dsh-evidence` | CC | baja | tras Tanda 1 | comparación con Project Documents de dsh-mnemon (licencia, offline, aislamiento, desinstalación) | decisión documentada; sigue **opcional** si no hay ventaja demostrada |
| 49 | O-01 31/35 | CC | baja | AMD | revisión del texto | nota de cifra real (35) en la spec |
| 50 | N-12 aviso | CC | baja | Tanda 1 | #16 | hecho (documental); falta comprobar el valor en el perfil de Studio |

Una deuda planificada **no** es una deuda resuelta.

## 8. Contradicciones entre los documentos 17, 25 y 29 (y resolución)

| # | Contradicción | Resolución |
|---|---|---|
| 1 | Doc 29 sugería «AMD-01 y 02 ya» mientras 17 y 25 las listan como no incorporadas | están **solo redactadas** (EV-074); el calendario del doc 28 lo ordena |
| 2 | Doc 17 mantenía D-09 como «sin commit» tras los commits | corregido: D-09 con commit, sin publicar |
| 3 | Doc 17 D-18 y doc 25 S-26-1 duplicaban la misma sub-decisión con significados distintos | unificado en S-26-1 según doc 21 §6 |
| 4 | Doc 25 §2 lista P-18…P-33 en una fila y P-34 en otra | todas pertenecen a doc 11 §11 (P-18…P-34) |
| 5 | Doc 29 usaba numeración 1–50; 17 usa B-/D- y 25 NC- | tabla del §2 cruza los tres identificadores |
| 6 | Doc 19 decía que el aviso de versión está «desactivado por defecto» | falso; está **activado**; corregido (EV-074) |
| 7 | Doc 29 preguntaba por el equipo y por Node ≥ 24 como supuesto | sustituido por el preflight; los requisitos salen de código real |
| 8 | Docs 18, 24 y 26 no listan 29, 30 ni 31 | pendiente de actualizar si se vuelve a empaquetar (ZIP desactualizado) |
| 9 | Doc 26 declara 98 archivos para el commit y v3.1 ahora tiene 33 | el commit `f8490ab` contiene 98; los nuevos (29, 30, 31) y las ediciones están **sin commit** |

## 9. Dictamen exacto de preparación

- **Cerrado:** #50 (documental). **Verificado:** #49 (diagnóstico). **Diferido:** #43.
- **Preparado para ejecutarse (`READY`):** #1, #12, #13, #14, a la espera de preflight y autorización.
- **Especificado, pendiente de ejecución o de pruebas:** 43 asuntos, entre ellos todos los de las Tandas 1 y 2 y de publicación.
- **Pendiente de confirmación formal del propietario:** paquete de ratificación (§4).
- **Qué no existe:** ninguna ratificación nueva, ninguna instalación, ningún código ni prueba ejecutada.
- **Bloqueos:** ninguno de decisión para empezar la Tanda 1 una vez pasado el preflight y dada la autorización; la Tanda 2 depende del handoff y de H0; la publicación, de las pruebas y de la revisión independiente.

## 10. Cambios hechos en esta fase (solo documentación)

Docs 02 (paquete de ratificación, D-10, S-12), 11 (S-04-1, S-04-2, `rejected`), 17 (D-09, D-18), 19 (N-12), 21 (S-26-1), 22 (S-27-1), 23 (S-23-1), 25, 28 (calendario), 30 (preflight), `evidence-v3.1` (EV-074), y nuevo **doc 31** (metodología de benchmarks). Sin commit.

---

# Anexo — versión original del documento 29 (conservada)

## 29 — Pendientes y subpendientes consolidados (v3.1)

Fecha: 2026-11-17. Reúne lo de los docs 17 y 25. Ninguna prueba se ha ejecutado. «Decide» = quién debe resolverlo.

### A. Decisiones del propietario

| # | Pendiente | Propuesta | Estado |
|---|---|---|---|
| 1 | Push de los commits `f8490ab` y `20ed7b8` | lo hace la persona | pendiente |
| 2 | Tanda 1: qué equipo es el «otro equipo», si tiene red y Node ≥ 24 | runbook guiado | pendiente |
| 3 | **S-26-1** ítems críticos del checklist con verificación propia | sí | pendiente |
| 4 | **S-04-1** credenciales sincronizables (BE = 1) | prohibidas | pendiente |
| 5 | **S-04-2** rotación de clave de firma y caducidad de solicitudes | 12 meses / 5 min | pendiente |
| 6 | **S-27-1** custodia del token de GitHub | servicio protegido o sin token | pendiente |
| 7 | **S-12** trailer `CA:` y excepciones (OD-12) | resolver en H0 | pendiente |
| 8 | **S-23-1 / D-15** tipografía y contrastes | elegir al construir | pendiente |
| 9 | Incorporar AMD-01…08 al texto normativo (D-11) | AMD-01 y 02 ya; el resto tras la Tanda 1 | pendiente |
| 10 | D-10 licencia de Evol-Driven antes de publicar | decidir | pendiente |
| 11 | OD sin ratificar: 01, 02, 05, 06, 07, 08, 22, 23 (baseline) y 10…18 (propuesta) | revisar | pendiente |

### B. Tanda 1 (doc 13, doc 27)

12. Redactar `studio.lock.json` con hashes al descargar.
13. Confirmar el método de instalación de DSH 0.2.1-rc.2.
14. Probar instaladores (Codebase Memory, deja-vu) en entorno desechable: informe PASS/WARN/BLOCK.
15. C-T1-01…10: AgentTeams carga; costuras de subagentes; dsh-mnemon (OD-03); Codebase Memory sin hooks; deja-vu con lista cerrada; dos proveedores de escritura; modelos y razonamiento; skill sin `dsh-doc`; miembro no lanza miembro (P-34); manifiesto reproducible.
16. Captura de red por componente.
17. Condiciones de OD-03: offline, aislamiento por proyecto, procedencia, captura controlada, sin autoevolución, sin cloud.
18. Benchmarks de memoria y Code Intelligence con umbrales previos; reproducir cifras de CBM.
19. Validar la skill fundacional (con/sin `dsh-doc`, con/sin `cordis_inspect_*`).
20. Restauración de `DSH_HOME` y almacenes.
21. Informe de handoff (doc 13 §5).
22. Si hay incompatibilidad bloqueante: propuesta de cambio de baseline.

### C. Tanda 2 (código)

23. NC-01 conciliar estado↔registro en `verify`, `approve`, `next`.
24. NC-02 anotar el MCP por efecto; retirar modo `fin` de `evol_verify`.
25. NC-04 lock de `.evol/`. 26. NC-05 consultas del grafo sin escritura.
27. Tabla única de permisos (B-09) y equivalencia CLI/MCP/UI.
28. NC-03 firma en el broker (Ed25519, entrada v2, `epoch-start`).
29. Validar aislamiento del broker (P-18). 30. Autenticador: FIDO2, `udev`, navegador, RP ID `*.localhost` (D-16).
31. Pruebas P-18…P-34.
32. NC-06 `MemoryProvider`. 33. NC-07 checklist (eventos, `evol review`, AC-CL-01…16; B-11).
34. Repository Explorer H8b (RE-01…12; token D-17).
35. UX-01…12. 36. D-12 política de revisión de `comandos`. 37. D-06 inventario CLI→UI exacto.

### D. Publicación estable

38. Compatibilidad «probada». 39. Licencias transitivas (D-08). 40. Red cero. 41. P/AC/RE/UX en verde y revisión de seguridad independiente. 42. AMD incorporadas. 43. Formato Linux de Desktop (OD-06, H10).

### E. Deuda heredada

44. D-02 cobertura de CA por referencia. 45. D-03 cola de cascada e id de símbolo. 46. D-04 memoria con 3 wings y duplicados. 47. D-05 registro de rechazos. 48. D-14 evaluar `dsh-evidence`. 49. O-01 cifras 31/35 en la spec. 50. N-12 valor por defecto de `actualizaciones.aviso`.

### F. Mejoras posteriores

Estados de evidencia más finos, interfaz móvil, modo multiusuario, Desktop Linux, `dsh-session-eval`/`dsh-session-export`, más proveedores de memoria.

### Hecho en esta etapa

Commits `f8490ab` (98 archivos de investigación) y `20ed7b8` (`.gitignore`); D-09 queda resuelta.
