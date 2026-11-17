# 21 — Contratos del Approval Checklist (OD-26)

Estado: **diseño documental; ninguna parte implementada.** Decisión **OD-26 confirmada por el propietario** (directiva v3.1 §6): revisión humana granular por fase, previa a la firma del broker.

## 1. Propósito y límites

La persona revisa individualmente los elementos obligatorios de **Briefing, Spec, Plan, Build, QA y Retro** antes de autorizar el avance. El checklist **no reemplaza** la firma final del Approval Broker (doc 11): es una condición previa y su estado entra en el desafío firmado (`checklist_digest`). **Los agentes no pueden marcar ítems de aprobación humana.**

## 2. De dónde salen los ítems (sin inventar)

Los ítems se **derivan** de datos que el framework ya tiene, no se escriben a mano:

| Fuente | Ítems que genera |
|---|---|
| Registro `disciplines/*.json` (35 archivos con `fases`, `artefactos`, `verificaciones`, `rol`, EV-063) | uno por cada **disciplina activa del módulo** × **artefacto** de la fase, con el resultado de su verificación |
| Reglas de la fase en el pipeline | requisitos propios de fase (ver tabla) |
| `SPEC.md` con criterios `CA-n` y `evol coverage` | en Spec y QA, un ítem por **criterio** (agrupado, desplegable) con su escenario y su prueba |
| Resultado de `verify` | todo hallazgo **WARN** genera un ítem de reconocimiento; un **BLOCK** impide marcarlo aprobado |

| Fase | Ítems obligatorios típicos (derivados; la lista exacta sale del registro y de la configuración del módulo) |
|---|---|
| Briefing | features priorizadas (FDD), escenarios con CA (BDD), pruebas de aceptación (ATDD); UDD/UXDD/A11yDD si están activas |
| Spec | criterios `CA-n` revisados uno a uno, dominio (DDD), amenazas con control y prueba (THREAT), decisiones (ADD), NFR/limitaciones (REQDD), documentación atómica (GRANULAR) |
| Plan | **plan interrogado** con marca vigente o anulación justificada (criterio 71), cobertura criterio→módulo, historias y sprints (SPRINTDD), migraciones/APIs si aplican |
| Build | pruebas unitarias y de seguridad en verde (TDD, STDD), revisión de secretos, justificación de dependencias nuevas, refactorizaciones registradas (RDD) |
| QA | escaneo de seguridad sin CRITICAL/HIGH sin ignorar (SecDD), cobertura sin huecos (`qa.requireCriteriaCoverage`), aceptación ejecutada, contratos/rendimiento/caos si activos |
| Retro | al menos una lección registrada (regla de la fase), memoria del ciclo, ignorados de seguridad por caducar, mejoras anotadas |

## 3. Esquema de un ítem (contrato `review-item/1`)

| Campo | Tipo y regla |
|---|---|
| `id` | estable y derivado: `c<ciclo>/<fase>/<fuente>/<clave>` (p. ej. `c3/spec/SDD/CA-12`); no cambia si el contenido cambia |
| `requisito` | texto corto en español, generado de la fuente |
| `obligatorio` | booleano; solo los obligatorios bloquean |
| `critico` | booleano; solo destaca el ítem en la interfaz; **no** añade autenticación por sí mismo (§6) |
| `artefactos` | lista de `{ruta, hash}` actuales |
| `evidencia` | lista de `{tipo, referencia, digest}` (informe de verificación, escaneo, prueba, diff) |
| `resultado_verificacion` | `PASS` · `WARN` · `BLOCK` · `N/A`, con el hallazgo saneado (sin contenido de documentos, sin secretos) |
| `version` | hash agregado de `artefactos` + `evidencia` |
| `estado_revision` | `aprobado` · `requiere_cambios` · `pendiente_de_revision` |
| `comentarios` | `[{approver_id, fecha, texto}]`; el texto es **dato** y se sanea al mostrarlo |
| `conformidad` | `{approver_id, fecha, version, método}` presente solo si `aprobado` |
| `estado_efectivo` | **derivado**: `valido` (aprobado y `version` igual a la actual) · `invalidado` (aprobado pero cambió `version`) · `pendiente` · `con_cambios` |

## 4. Reglas

1. **Solo una persona autenticada** marca. Un principal de tipo agente, subagente, worker, plugin o MCP recibe `403` y se registra el intento.
2. Marcar **aprobado** exige rol **Approver**; **Reviewer** puede comentar y marcar «requiere cambios»; **Reader** solo consulta.
3. Cada conformidad queda **atada a la `version`** del ítem. Si cambia un artefacto o una evidencia relevante, `estado_efectivo` pasa a `invalidado` y el ítem vuelve a pedir revisión (con el motivo visible).
4. Un ítem con resultado **BLOCK** no puede marcarse aprobado. Un **WARN** exige un comentario de reconocimiento.
5. **El avance se habilita solo si** todo ítem obligatorio tiene `estado_efectivo = valido`, ninguno está `con_cambios` y no hay BLOCK pendiente.
6. Un ítem nuevo (por un cambio de configuración o de disciplinas) entra como `pendiente`. Un ítem retirado se conserva en el historial.
7. Cambiar la configuración de disciplinas invalida las conformidades afectadas (coherente con `disciplines-change.ts` y N-18).
8. Las marcas son **consultivas hasta la ceremonia final**: el broker firma sobre `checklist_digest` y rechaza si cambió (P-31). Un agente que usara una sesión abierta no obtendría una aprobación.

## 5. Almacenamiento y operaciones

- **Registro de eventos** `.evol/review/c<ciclo>/<fase>/events.jsonl`, de solo añadir, escrito **solo** por el servicio de revisión del broker (los agentes no escriben `.evol/`, doc 07 regla). El estado se reconstruye de los eventos; `checklist_digest` = SHA-256 del estado canónico.
- **Operaciones** (mismo permiso para UI y CLI, tabla única, doc 10):

| Operación | Efecto | Permiso |
|---|---|---|
| `review.list` / `review.get` | lectura de ítems y estado derivado | Reader |
| `review.export` | exportación del estado (sin comentarios si se pide) | Reader |
| `review.mark` | marcar aprobado / requiere cambios / pendiente | Approver (aprobado) · Reviewer (requiere cambios), **solo sesión humana** |
| `review.comment` | añadir comentario | Reviewer o superior, sesión humana |
| `review.reopen` | volver un ítem a pendiente | Reviewer o superior, sesión humana |

No hay equivalente de línea de comandos para **marcar**: un TTY no demuestra presencia humana (doc 11 §1). La CLI ofrece solo `evol review list|show|export` de lectura; la accesibilidad se resuelve con navegación por teclado y lector de pantalla en el Centro de revisión (doc 23).

## 6. Sellado y operaciones excepcionales (S-26-1)

**Decisión propuesta por el propietario (pendiente de confirmación formal): checklist individual con una ceremonia WebAuthn final vinculada al conjunto de ítems; autenticación adicional solo ante operaciones excepcionales.**

- **Regla general:** la persona marca ítem por ítem (consultivo); la ceremonia final del broker incluye `checklist_digest` y la pantalla repite el resumen (n.º de ítems obligatorios válidos, WARN reconocidos). **No** hay verificación de usuario por ítem.
- **Operaciones excepcionales (exigen una verificación WebAuthn adicional, propia y con su desafío):** (a) aprobar con **anulación** firmada (p. ej. plan sin interrogar); (b) aceptar un **WARN de seguridad**; (c) cambiar `comandos` o las disciplinas tras sellar un ítem; (d) **reabrir** una fase ya aprobada; (e) las operaciones de claves y credenciales del doc 11 §6. Esta lista es una concreción propuesta, a revisar al implementar.
- Justificación: una sesión abierta no basta para aprobar (BA-13, doc 11), y se evita la fatiga de pedir verificación decenas de veces.

## 7. Privacidad

Los comentarios pueden contener datos personales. Se guardan localmente; `evol.config.json` decidiría si `.evol/review/comentarios` se versiona (por defecto **no**, a diferencia de lo demás de `.evol/`, que va en Git, `ESPECIFICACION.md:1685`). Los textos se sanean al mostrarse (T-20).

## 8. Pruebas de aceptación (todas pendientes)

| ID | Prueba | Resultado esperado |
|---|---|---|
| AC-CL-01 | Generar el checklist de cada fase en un proyecto de ejemplo | los ítems coinciden con disciplinas activas, artefactos y criterios; ninguno inventado |
| AC-CL-02 | Un agente intenta `review.mark` por UI, RPC, MCP y navegador automatizado | denegado; intento registrado |
| AC-CL-03 | Cambiar un byte de un artefacto de un ítem aprobado | `invalidado`; avance bloqueado |
| AC-CL-04 | Ítem con BLOCK intentado aprobar | rechazado |
| AC-CL-05 | WARN sin comentario | rechazado |
| AC-CL-06 | Un obligatorio `requiere_cambios` | avance bloqueado |
| AC-CL-07 | Todos válidos, sin ceremonia | no hay aprobación |
| AC-CL-08 | Checklist cambia entre abrir la ceremonia y firmar | rechazado (`checklist_digest`) |
| AC-CL-09 | Cambio de disciplinas | conformidades afectadas invalidadas; ítems nuevos pendientes |
| AC-CL-10 | Retro sin lección | ítem obligatorio pendiente |
| AC-CL-11 | Plan sin marca de interrogación vigente | ítem obligatorio pendiente (o anulación firmada) |
| AC-CL-12 | Comentario hostil (ANSI, bidi, saltos de línea) | saneado al mostrar |
| AC-CL-13 | Un Reviewer intenta marcar aprobado | denegado |
| AC-CL-14 | Navegación completa por teclado y lector de pantalla | todos los ítems alcanzables |
| AC-CL-15 | Equivalencia de `list/get` entre CLI, MCP y UI | mismos datos |
| AC-CL-16 | Un ítem retirado | permanece en el historial |

## 9. Documentos afectados

`09` §2.4 (Approval Center y Centro de revisión) · `10` (filas `review.*`) · `11` §3.1 y §5 · `14` (H7) · `15` · `17` · `19` (N-27) · `23` (vistas). Propuesta de enmienda normativa: `28` AMD-06.
