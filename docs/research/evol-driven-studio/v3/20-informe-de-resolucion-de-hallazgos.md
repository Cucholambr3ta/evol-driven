# 20 — Informe de resolución de los seis hallazgos y verificación de regresiones

Ejecución EVOL-STUDIO-DOC-CORRECTION-003 · 2026-11-17 · solo documental. **Un PASS aquí significa «corrección documental coherente y trazada»; no significa que el software esté implementado o validado.**

## 1. Matriz de cierre

Criterio de PASS: existe el cambio documental · la contradicción quedó resuelta · las referencias cruzadas son coherentes · la decisión conserva su estado · sin regresión conceptual · la evidencia soporta el resultado.

| ID | Hallazgo | Documento original | Corrección aplicada | Evidencia | Resultado |
|---|---|---|---|---|---|
| H-01 | Rollback inseguro del Approval Broker | `15-roadmap.md` (H7) | `15-roadmap.md` H7 y «Cambios v3»; `11-modelo-de-seguridad-approval-broker.md` §6 (fallo cerrado, qué se permite/no, **procedimiento de recuperación de 9 pasos**, vía de emergencia condicionada, sin bypass genérico), §7 y §8 (búsqueda de rutas indirectas); `02` OD-04; `09` §2.4; `14` §2 bis y regla 5; `17` A.2 (B-02, B-05). Búsqueda de `approve`/TTY/`next` en toda la v3: solo menciones como prohibido o histórico | EV-052 (protección vigente declarativa), EV-045 | **PASS** (documental). Límite: «ausencia de bypass» es de diseño; P-03 y P-15 sin ejecutar |
| H-02 | Permisos CLI→UI sin base en efectos | `10-inventario-cli-ui.md` | `10` reescrito: 7 clases de efecto, reglas de asignación, tabla de **cambios de clasificación**, matriz de 36 comandos (L/E/P/N/C/Ev/R-C), anotación MCP real, separación «consultar resultado» vs «ejecutar»; `11` §4 roles; `09`, `03` §2 bis, `14` §2 bis; `02` OD-11 y OD-19. `verify` (fin) pasa a Operator por ejecutar comandos de shell de la configuración | EV-048, EV-049, EV-051 | **PASS** (documental). Las filas Reader quedan **provisionales** (solo análisis estático) y las no verificadas están restringidas a Operator; pruebas P-12/P-13/P-14 pendientes |
| H-03 | Bloqueo artificial por ausencia de `dsh-doc` | `00`, `01`, `12`, `13`, `15`, `16`, `17`, `evidence` | `12` reescrito (jerarquía de seis fuentes, referencias complementarias evaluadas, validación sin `dsh-doc`, clasificación de prerequisitos en 3 niveles); `13` §2 (A/B/C); `01` C-01 resuelta a nivel de diseño; `15` «Hitos de control»; `16`; `17` A.4 (B-01 reclasificado); `02` OD-09/OD-21; `evidence-v3` EV-046 | EV-035, EV-046 | **PASS** (documental). No se afirma que la skill funcione: se valida en la Tanda 1 |
| H-04 | Conciliación normativa incompleta | `01`, `17` (D-07) | `19-matriz-de-conciliacion-normativa.md` (24 filas con las 8 columnas pedidas y la clasificación SC/CO/SU/CT/OB/PR/PP); `01` C-15…C-21; `17` D-07 y D-11…D-14; enmiendas propuestas en `19` §5 | EV-050…056 | **FAIL (parcial)** — **no es PASS**: 4 contradicciones quedan abiertas con corrección definida (N-01, 06, 07, 10) y `ESPECIFICACION.md` no se leyó íntegra (Ampliación 2 y detalle de 5 y 6). D-07 queda **parcialmente cerrada** y se dice cómo cerrarla |
| H-05 | UX de autorización | `09`, `10`, `11`, `15` | `11` §5 (flujo unificado en 7 pasos; los registros de aprobación y transición no se fusionan; la transición no corre si falla el registro; 9 estados visuales); `09` §2.4; `10` filas `approve`/`next`; `15` H7 | doc 11 | **PASS** (documental). Pruebas P-03…P-09 pendientes |
| H-06 | Corrección de EV-041 (`dsh-evidence`) | `evidence`, `08`, `16` | `evidence-v3` EV-047 (existencia, paquete, versiones, dependencias, límites, limitación de la búsqueda original; **EV-041 se conserva**); `08` §1 y §11; `01` C-03; `13` §4; `16`; `02` OD-03/OD-18; `17` D-14. Se mantiene como **plugin opcional candidato, no baseline**; sin instalar | EV-047 | **PASS** (documental). Compatibilidad real, offline, licencias transitivas, aislamiento, desinstalación: **pendientes** |

**Hallazgo adicional de la propia revisión (no estaba en los seis):** la investigación v1 (EV-006) afirmaba que el estado no se concilia con el registro; `evol doctor` **sí** lo hace (EV-045), aunque ni `verify`, ni `approve`, ni `next` lo exigen y la spec dice «doctor y verify». Se corrige por adición (EV-045, C-17, N-06, OD-16) sin editar el original.

## 2. Verificación de regresiones (§15)

Cada capacidad se comprobó en los documentos v3 y se buscaron expresiones contradictorias (§3).

| Capacidad | ¿Se conserva? | Dónde |
|---|---|---|
| Pipeline de siete fases | sí | `04` §1–3 |
| Aprobaciones y gates autoritativos | sí | `03` §2, `11` |
| Dos máquinas de estados | sí | `04` §1, `07` |
| AgentTeams como coordinador | sí | `03`, `07`, OD-07 |
| Subagentes bajo demanda | sí | `05` |
| Workers locales | sí | `05` §2, `08` §8 |
| Memoria local | sí | `08` §6–7 |
| Code Intelligence híbrido | sí | `02` OD-05, `05` |
| Model Routing | sí (con aclaración de versión) | `06` |
| Visual-first | sí | `09`, `10` |
| Approval Broker | sí, **más estricto** | `11` |
| Skill fundacional | sí, **independiente de una referencia** | `12` |
| Plugin Edition / Desktop Edition | sí | `15` H9/H10, `16` |
| Contrato de handoff | sí, con campo adicional | `13` §5 |
| Recuperación de trabajos | sí | `07` §4 |
| Trazabilidad | sí | `07`, `19` |
| Reversibilidad | sí (la reversión del broker es «fallo cerrado», no un retorno a un camino menos seguro) | `11` §6, `15` |
| Privacidad | sí, con distinción memoria/inferencia | `08` §7, OD-10 |

## 3. Búsqueda de contradicciones con la baseline

| Patrón buscado | Resultado | Excepción justificada |
|---|---|---|
| Aprobación sin autenticación humana efectiva | no aparece como propuesta | — |
| Avance directo por agentes | no | — |
| CLI privilegiada sin aislamiento | `approve`/`next` solo vía broker (doc 10, 11) | — |
| Segundo scheduler | solo como «no se crea» | — |
| Memoria propia injustificada | no | — |
| Indexación completa en cada turno | no | — |
| Instalación automática de plugins no aprobados | no; `dsh-evidence` y skills comunitarias **no se instalan** | — |
| Selección silenciosa de modelos remotos | prohibida (`06` §5) | — |
| Compatibilidad declarada como probada | no; todo «Probada aquí = no» (`16`) | — |
| Dependencias de skills como bloqueo absoluto | corregido (`12`, `13`, `17`) | — |
| Cadena `latest` | solo como «no usar `latest`» y como dato del registro npm | — |
| Mención de «volver a `evol approve`» | solo como hallazgo histórico y como prohibición (`01`, `11`, `15`) | — |

## 4. Estado de las decisiones (OD-01…OD-25)

Sin cambios de ratificación. Confirmadas: **OD-04, 19, 20, 21, 24, 25**. Baselines propuestas: OD-01, 02, 03, 05, 06, 07, 08, 09, 22, 23. Propuestas: OD-10…18. **No se crearon OD nuevas** (los cambios se absorbieron en OD-03, 04, 09, 11, 16, 17, 18, 19, 21, 22, 24, 25). Sub-decisión abierta dentro de OD-04: firma asimétrica o verificación solo vía broker (doc 11 §2).

## 5. Bloqueos restantes (reales)

| Etapa | Bloqueo |
|---|---|
| Tanda 1 | ratificación de OD-09/OD-03; prueba de compatibilidad AgentTeams↔versión elegida; condiciones de entrada de CBM |
| Tanda 2 | cierre de H0 (estado↔log bloqueante, MCP por efectos, lock, tabla única de permisos); factor de presencia humana y custodia de clave |
| Publicación | combinaciones «probadas», licencias transitivas, red cero, P-01…P-17 |

## 6. Dictamen

- **DOCUMENTACIÓN CON PENDIENTES.** Cinco de los seis hallazgos están corregidos con trazabilidad; H-04 queda **parcial** (D-07 sin cerrar del todo; N-01, 06, 07 y 10 abiertas con corrección definida).
- **IMPLEMENTACIÓN NO VALIDADA.** Ninguna prueba, compatibilidad ni benchmark se ejecutó.
- **BLOQUEO REAL DE INTEGRACIÓN: sí, acotado** a los puntos del §5; **ya no existe un bloqueo general por `dsh-doc`**.
- **No se emite PASS general.** *DOCUMENTACIÓN CONSISTENTE* no se otorga hasta cerrar D-07.
