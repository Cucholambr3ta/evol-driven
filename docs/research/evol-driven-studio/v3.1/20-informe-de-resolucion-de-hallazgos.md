# 20 — Informe de resolución de hallazgos y verificación de regresiones (v3.1)

Ejecución EVOL-STUDIO v3.1 (directiva de cierre), 2026-11-17 · solo documental. **Un PASS aquí significa «corrección documental coherente y trazada»; no significa que el software esté implementado o validado.**

## 1. Matriz de cierre (H-01…H-06)

Criterio de PASS: existe el cambio documental · la contradicción quedó resuelta · las referencias cruzadas son coherentes · la decisión conserva su estado · sin regresión conceptual · la evidencia soporta el resultado.

| ID | Hallazgo | Resultado v3 | Resultado v3.1 | Qué cambió en v3.1 |
|---|---|---|---|---|
| H-01 | Rollback inseguro del broker | PASS (doc) — **aceptado por el propietario** | **PASS (doc)** | el fallo cerrado y la recuperación se conservan y se amplían con rotación, revocación y reset de aprobadores (doc 11 §6, §8) |
| H-02 | Permisos CLI→UI sin base en efectos | PASS (doc) — aceptado | **PASS (doc)** | se añaden `review.*`, `repo.*` y operaciones del broker; el MCP se eleva a enmienda AMD-01 (doc 10) |
| H-03 | Bloqueo por ausencia de `dsh-doc` | PASS (doc) — aceptado | **PASS (doc)** | sin cambios de fondo; baseline ratificada, `C-T1-08` comprueba la skill sin `dsh-doc` |
| **H-04** | **Conciliación normativa** | **FAIL (parcial)** | **PASS (doc)** | lectura **íntegra** de 2 931 líneas (EV-057); matriz de 35 filas; cuatro fichas completas (N-01, 06, 07, 10); 8 enmiendas redactadas (doc 28); D-07 **cerrada** con las salvedades de §3 |
| H-05 | UX de autorización | PASS (doc) — aceptado | **PASS (doc)** | el flujo «Autorizar avance» incorpora el checklist previo y la ceremonia WebAuthn (doc 11 §5) |
| H-06 | `dsh-evidence` | PASS (doc) — aceptado | **PASS (doc)** | sin cambios; sigue opcional, fuera de la baseline |

**Por qué H-04 pasa ahora y no antes:** lo que lo impedía era la lectura parcial de `ESPECIFICACION.md` y cuatro contradicciones abiertas. Ya no hay lectura parcial (EV-057), y cada contradicción tiene decisión, enmienda redactada, documentos afectados, criterios y estado. **Lo que no se ha hecho:** incorporar esas enmiendas al texto normativo (D-11) ni corregir el código (NC-01).

## 2. Hallazgos nuevos de la lectura íntegra (no estaban en los seis)

| ID | Hallazgo | Tratamiento |
|---|---|---|
| C-18 (ampliado) | El criterio 22 de la spec se contradice con sus propios criterios 125, `:284` y `:1251` (EV-058) | AMD-01 |
| C-22 | La Ampliación 2 descartó «firmas por persona» y fijó el HMAC (EV-059) | AMD-03 (el broker sustituye en el perfil `broker`) |
| C-23 | El criterio 62 abre Documentación en Constelación | AMD-05 (lista primero) |
| C-24 | Cifras de disciplinas «31» frente a «35» en la propia spec | observación O-01 (ajena a Studio) |
| NC-01 | `verify`/`approve`/`next` no concilian estado y registro | corrección de código en H0, **no** enmienda |

## 3. Cierre de D-07

**CERRADA documentalmente.** Cumple: lectura íntegra; matriz completa; cada contradicción con decisión y enmienda; ninguna contradicción normativa material sin resolver. **Salvedades honestas:** (1) las enmiendas AMD-01…08 están **redactadas y autorizadas pero no incorporadas** a `ESPECIFICACION.md` ni a las specs (se preserva la historia; D-11); (2) NC-01 es un defecto de código pendiente; (3) la verificación práctica (P-xx, C-T1-xx, AC-CL, RE, UX) no se ha hecho.

## 4. Verificación de regresiones

| Capacidad / invariante | ¿Se conserva? | Dónde |
|---|---|---|
| Pipeline de siete fases | sí | 04 |
| Aprobaciones y gates autoritativos | sí, **con checklist y firma asimétrica** | 11, 21 |
| Dos máquinas de estados (fases / tareas) | sí | 04, 07 |
| AgentTeams como coordinador, sin segundo scheduler | sí | 03, 07, AMD-02 |
| Subagentes y workers bajo demanda | sí, profundidad 1 | 05, 28 |
| Memoria local | sí, `MemoryProvider` | 08, AMD-04 |
| Code Intelligence híbrido | sí | 02 (OD-05), 05 |
| Model Routing opcional | sí | 06 |
| Visual-first | sí, con `EVOL-STUDIO-UI-UX-SYSTEM` | 09, 10, 23 |
| Approval Broker y fallo cerrado | sí, **más estricto** | 11 |
| Skill fundacional | sí | 12 |
| Plugin Edition antes que Desktop | sí | 15 |
| Trazabilidad, reversibilidad, privacidad | sí | 24, 21 §7 |
| Decisiones confirmadas (04, 19, 20, 21, 24, 25) | **sin cambios de contenido** | 02 |

**Búsqueda de contradicciones con la baseline.** Patrones comprobados en v3.1: aprobación sin autenticación humana efectiva (ninguna propuesta); avance directo por agentes (ninguno); rollback a `evol approve` (solo como prohibición histórica); HMAC como mecanismo de Studio (solo como referencia al estado actual y a la migración); `latest` (solo prohibido); instalación automática de plugins no aprobados (ninguna); compatibilidad declarada como probada (ninguna: «probada aquí = no»); versiones de la baseline iguales en 02, 07, 13, 16 y 27.

## 5. Verificación de consistencia mecánica

Se comprobó por script que todas las referencias cruzadas de v3.1 resuelven: **EV** (todas definidas en `evidence-*`), **OD-01…27**, **N-01…35**, **AMD-01…08**, **P-01…34**, **BA-01…18**, **AC-CL-01…16**, **RE-01…12**, **UX-01…12**, **C-T1-01…10**, **D-xx** y las referencias «doc NN». Resultado: sin referencias huérfanas.

## 6. Bloqueos y condiciones (resumen; detalle en el doc 25)

| Etapa | Estado |
|---|---|
| **Tanda 1** | **No hay bloqueo de decisión**: baseline, memoria y arquitectura de aprobación están decididas. Quedan **pruebas** dentro de la tanda (compatibilidad, red, instaladores, benchmark) |
| **Tanda 2** | depende del handoff de la Tanda 1, del cierre de H0 (NC-01, 02, 04, 05), de la validación del aislamiento del broker y de un autenticador utilizable |
| **Publicación estable** | combinaciones probadas, licencias, red cero y todas las pruebas P/AC/RE/UX |

## 7. Dictamen v3.1

| Categoría | Veredicto |
|---|---|
| **DOCUMENTACIÓN CONSISTENTE** | **Sí, con alcance documental:** el conjunto v3.1 es internamente coherente (verificación mecánica y de patrones) y está **conciliado** con la normativa mediante enmiendas **redactadas**. Salvedad: la normativa vigente aún no las incorpora |
| **DOCUMENTACIÓN CON PENDIENTES** | **Sí, no estructurales:** incorporar AMD-01…08 (D-11); decisiones S-26-1, S-04-1/2, S-27-1, S-12; confirmación de tipografía y contrastes (D-15); autorización del commit y del ZIP |
| **IMPLEMENTACIÓN NO VALIDADA** | **Sí, sin excepciones:** ninguna prueba, compatibilidad ni benchmark se ha ejecutado; nada de Studio está construido |
| **BLOQUEO REAL DE INTEGRACIÓN** | **No para iniciar la Tanda 1.** **Sí, acotado** para la Tanda 2 (validación del broker y del autenticador, H0) y para la publicación |

**No se emite PASS de implementación.**
