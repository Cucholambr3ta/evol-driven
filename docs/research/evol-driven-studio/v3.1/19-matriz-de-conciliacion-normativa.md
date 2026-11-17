# 19 — Matriz de conciliación normativa (v3.1: lectura íntegra; cierra H-04 y D-07)

## 1. Qué se leyó y con qué profundidad (autorizado por el propietario, directiva v3.1 §4)

| Documento | Líneas | Profundidad v3.1 |
|---|---|---|
| `docs/ESPECIFICACION.md` | 1 883 | **íntegra** (1–1883, en cuatro tramos) |
| `docs/specs/SPEC.md` | 332 | **íntegra** |
| `docs/specs/DOMAIN.md` | 131 | **íntegra** |
| `docs/specs/THREATS.md` | 142 | **íntegra** |
| `docs/features/FEATURES.md` | 237 | **íntegra** |
| `docs/plan/PLAN.md` | 206 | **íntegra** |
| Código normativo de contraste | — | `src/core/gate.ts`, `src/commands/approve.ts`, `src/mcp.ts` (cliente), `.claude/agents/verificador.md`, `.mcp.json`, `evol.config.json`, `disciplines/` (35 archivos); además lo ya leído en v3 (`verify.ts`, `pipeline.ts`, `doctor.ts`, `commands/mcp.ts`, `notice.ts`, `cli.ts`) |
| ADR vigentes | **no existe `docs/adr/`** | — |
| Documentación de agentes, MCP, skills, aprobaciones | dentro de la spec, THREATS y los archivos de arriba | cubierta por la lectura íntegra |

Total leído: **2 931 líneas** de normativa. Ninguno describe Studio: «normativa» significa los requisitos **vigentes del framework** con los que Studio debe ser compatible. Los documentos **se conservan sin edición**; las enmiendas se redactan en el doc 28.

Clasificación: SC sin conflicto · CO complementado · SU sustituido · CT contradictorio · OB obsoleto · PR pendiente de ratificación · PP pendiente de prueba · NC no conformidad de implementación (código frente a norma correcta).

## 2. Matriz (35 filas)

| ID | Documento · referencia | Requisito anterior | Decisión aplicable | Tipo | Corrección | Estado v3.1 | Evidencia |
|---|---|---|---|---|---|---|---|
| N-01 | `ESPECIFICACION.md` criterio 22 (`:274`), `:264`, `:283-285`; ayuda CLI | `evol mcp` ofrece «exactamente sus herramientas de lectura» | OD-11, OD-15; directiva §5 | **CT** (spec vs. spec y vs. código) | AMD-01 | **Resuelta por enmienda redactada** (ficha §3.1) | EV-058 |
| N-02 | `:47`, criterio 21 | «Aprobar es solo humano: terminal interactiva» | OD-04 (WebAuthn + Ed25519) | **SU** (mecanismo) | AMD-03: perfiles `terminal` y `broker` | SU · resuelta | EV-052, EV-060 |
| N-03 | criterio 69 | `/evol` nunca ejecuta `approve` ni `next` | OD-04, OD-07 | CO | se extiende a todo agente de AgentTeams | CO | doc 11 §10 |
| N-04 | `:1239`; THREATS T-5 | `permissions.deny` para `approve`/`next` | OD-04 | CO | capa adicional declarativa, no control principal | CO | EV-052 |
| N-05 | THREATS T-1, T-3; `:250` | clave del gate en `~/.config/evol/keys`, mitigada por regla del IDE; se copia entre máquinas | OD-04 | **SU** (mitigación) | clave privada Ed25519 en la cuenta del broker; claves públicas verificables en cualquier máquina | SU · PP (P-18, P-26) | EV-060 |
| N-06 | THREATS T-2; CA-134 | «`doctor` y `verify` comparan `state.json` con el registro» | OD-16 | **NC** (código) | corregir `verify`, `approve`, `next`; **la norma no se enmienda** (ficha §3.2) | NC-01 abierta en el **código** (H0); norma sin contradicción | EV-045 |
| N-07 | `:718-721`, `:26`, `:856-858` | un solo agente propio; sin agentes efímeros bajo demanda | OD-20, OD-25; directiva §5 | **CT** | AMD-02 | **Resuelta por enmienda redactada** (ficha §3.3) | EV-062 |
| N-08 | `SPEC.md:185`; `FEATURES.md:133` | fuera de alcance del ciclo 2: orquestador autónomo y GitFlow | OD-07, OD-25 | CO | era exclusión de ciclo; GitFlow sigue fuera | CO | EV-062 |
| N-09 | Ampliación 3 (`evol ui`, BORRADOR) | panel por proyecto, `evol ui --app`, constelación | OD-17, OD-19; directiva §5 y §8 | **SU** (absorbido) | AMD-05 | SU · resuelta | EV-064 |
| N-10 | `:20`, `:27`, criterios 8 y 9; `CLAUDE.md` | MemPalace como memoria del framework | OD-03 **ratificada** | **CT potencial** → resuelta por alcance | AMD-04: `MemoryProvider` (`mempalace` vigente; `mnemon` por defecto en Studio nuevo); `CLAUDE.md` intacto (ficha §3.4) | **Resuelta por enmienda redactada** | EV-067 |
| N-11 | Ampliación 5 (`evol knowledge`) | documentación de referencia con origen y licencia | doc 08 | CO | delimitar `evol knowledge` / Project Documents / `dsh-evidence` | CO · PP | EV-047 |
| N-12 | `SPEC.md:36` (CA-145); T-10 | aviso local de versión, sin telemetría | OD-10 | CO/PP | **Verificado en código (`notice.ts:57-65`): el aviso está ACTIVADO por defecto** (`actualizaciones.aviso !== false`, en el `config.json` del usuario). La política de Studio exige **fijarlo en `false`** en su perfil; la afirmación anterior «desactivado por defecto» era incorrecta | CO · VERIFICADO (valor) · PP (prueba de red) | EV-055, EV-074 |
| N-13 | Ampliación 6; T-6…T-8 | etiquetas firmadas, sumas, sin `--insecure` | OD-18 | SC | se reutiliza para el núcleo | SC | EV-065 |
| N-14 | T-11; CA-146/147 | `ciclo nuevo` exige persona en terminal | OD-04 | SU (mecanismo) | pasa por el broker | SU | doc 10 |
| N-15 | T-12 (CA-149) | `doctor` lista MCP y marca los remotos como salida de datos | OD-10 | CO | Studio lista todos los plugins con salida de datos | CO | EV-049 |
| N-16 | Ampliación 4 (tope de concurrencia) | el orquestador delega con tope | OD-07, OD-23 | CO/PP | el tope nunca se construyó; pasa a AgentTeams | CO · PP | EV-008 |
| N-17 | `:776`; criterio 74 | `verificador` y `seguridad` solo lectura, contexto limpio | doc 05 | CO | los roles de Studio los incluyen y no los sustituyen | CO | doc 05 |
| N-18 | `disciplines-change.ts` | cambiar disciplinas invalida aprobaciones | OD-04, OD-26 | CO | la UI avisa; el checklist invalida conformidades | CO | EV-049 |
| N-19 | Ola 1 y Ciclo 2 (SPEC/DOMAIN/FEATURES/PLAN) | `Stack`, respaldo, documentación atómica, sprints | — | SC | `Stack` se reutiliza para elegir workers | SC | EV-057 |
| N-20 | Skill `add`; Amp. 8 | ADR en `docs/adr/*.md` | doc 02 | OB/PR | los ADR de Studio pasan a `docs/adr/` al ratificarse | PR | EV-050 |
| N-21 | `CLAUDE.md` | commits convencionales, en español, sin atribución; MemPalace; `evol-dev` | OD-12, OD-13 | SC | trailer `CA:` compatible | SC | doc 02 |
| N-22 | criterio 94 | herramientas que usan red lo declaran, sin telemetría | OD-10, OD-18 | CO | se extiende a plugins y servicios de Studio | CO · PP | EV-049 |
| N-23 | `:1200` (aprobación por chat descartada) | la aprobación de skills exige terminal | OD-04 | CO | pasa por el broker | CO | doc 11 §10 |
| N-24 | `:1237` (se imprime, no se escribe) | `evol agents` no escribe en configuración de usuario | OD-18; directiva §5 | CO / **CT potencial** | AMD-07: perfiles aislados y prueba en entorno desechable | **Resuelta por enmienda redactada**; PP | EV-071 |
| N-25 | Ampliación 2 (`:292`, `:393`) | «no hay firmas por persona; HMAC; firmas por persona descartadas por ahora» | OD-04 | **SU** | AMD-03 | SU · resuelta | EV-059 |
| N-26 | criterio 62 (`:559`) | Documentación abre por defecto en Constelación | directiva §8 (lista primero) | **SU** | AMD-05 | SU · resuelta | EV-064 |
| N-27 | pipeline: aprobación de fase | la aprobación exige artefactos, verificación y hash | OD-26 | CO | el checklist es condición previa a la firma, sin reemplazarla | CO | doc 21 |
| N-28 | `:856-858`, criterio 76 | orquestación plana; cada disciplina la aplica un rol | OD-20, OD-25 | CO | se conserva (AMD-02, reglas 3 y 4); prueba P-34 | CO · PP | EV-062, EV-063 |
| N-29 | criterio 57; Amp. 5 (S5) | la pantalla Skills no crea, sube ni importa; entrar solo por la auditoría | OD-18 | CO | Plugin Studio gestiona plugins; las skills siguen entrando solo por `evol skills audit/incorporar` | CO | EV-064 |
| N-30 | criterio 36 (`evol export --json`) | conjunto de datos con esquema versionado para informe y `evol ui` | OD-15, OD-17 | CO | contrato de datos de la UI y del Repository Explorer | CO | EV-066 |
| N-31 | CA-142…144; T-6…T-8 | procedencia, sumas y SBOM; sin opción para saltar la verificación | OD-18 | CO | los plugins propios de Studio se publican con la misma procedencia | CO · PP | EV-065 |
| N-32 | Amp. 8 (`:1685`): `.evol/` va en git | los registros del proyecto se versionan | OD-26, OD-10 | CO | los comentarios del checklist no se versionan por defecto | CO | doc 21 §7 |
| N-33 | criterios 6, 7, 76 («31») vs. Amp. 8 («35») | cifras de disciplinas | — | OB | observación O-01; no es de Studio | OB (anotada) | EV-063 |
| N-34 | MCP de `evol` y `evol knowledge` (criterio 114) | las herramientas MCP de conocimiento solo leen, desactivadas por defecto | OD-11 | CO | misma regla de efectos | CO | EV-058 |
| N-35 | Repository Explorer (nuevo) | la spec no cubre historial Git/GitHub; `MODIFIES` usa `git diff` | OD-27 | SC | nueva ampliación (AMD-08) | SC | doc 22 |

## 3. Fichas de las cuatro discrepancias señaladas por el propietario

### 3.1 N-01 — Contrato del MCP
| Campo | Contenido |
|---|---|
| Requisito normativo exacto | Criterio 22 (`:274`): «`evol mcp` ofrece exactamente sus herramientas de lectura; ninguna aprueba, avanza ni inicializa, y usarlas no cambia el estado del pipeline». Ampliación 1 (`:264`): «Servidor MCP de solo lectura» |
| Evidencia de implementación actual | El servidor expone 13 herramientas sin anotar (EV-004); `evol_memory_add`, `evol_checkpoint` e `evol_index` escriben; `evol_verify` modo `fin` ejecuta comandos con `shell: true` (EV-048). La propia spec lo admite en `:284`, `:1251` y criterio 125 (`:1694`): el criterio 22 está **desactualizado** (EV-058) |
| Nueva decisión aplicable | Directiva v3.1 §5: reconocer los efectos reales y clasificar por efectos; OD-11 (tabla única de permisos) |
| Conflicto | El criterio 22 y la ayuda de `evol mcp` afirman una garantía que el código y la propia spec no cumplen |
| Enmienda necesaria | **AMD-01** |
| Documentos afectados | `ESPECIFICACION.md` (criterio 22, `:264`, `:283-285`), ayuda del CLI, `tests/mcp.test.ts`, docs 10 y 11 |
| Criterios de aceptación | tabla herramienta→efecto→rol; anotaciones reales iguales a la tabla; ninguna herramienta toca `approve`, `next`, `ciclo nuevo`, `disciplines`; P-12 y P-14 |
| **Estado final** | **Resuelta documentalmente** (enmienda redactada y autorizada); la corrección del código es H0 |

### 3.2 N-06 — Estado frente al registro firmado
| Campo | Contenido |
|---|---|
| Requisito normativo exacto | CA-134 (`SPEC.md`): «`evol doctor` detecta cuando la fase de `state.json` no concuerda con la última aprobación válida del registro firmado». THREATS T-2: «`evol doctor` y `evol verify` comparan la fase de `state.json` contra la última aprobación válida… y avisan» |
| Evidencia de implementación actual | `doctor.ts:158-168` compara con `expectedPhase(log)` (`gate.ts:204`); `verify`, `approve` y `next` no lo hacen (EV-045) |
| Nueva decisión aplicable | OD-16: ante inconsistencia, bloquear operaciones protegidas |
| Conflicto | **No hay contradicción normativa.** Hay una **no conformidad de implementación** (NC-01): `verify` no cumple lo que T-2 le atribuye; y un endurecimiento (bloquear, no solo avisar) que OD-16 pide |
| Enmienda necesaria | **Ninguna a la norma.** El «avisan» de T-2 se endurece a «bloquean las operaciones protegidas» en el ciclo de Studio (nota en AMD-03) |
| Documentos afectados | código (`verify`, `approve`, `next`, H0 del doc 14); doc 11 §8 (conciliación) |
| Criterios de aceptación | P-06; `verify`, `approve` y `next` con `state.json` adelantado terminan en bloqueo con diagnóstico |
| **Estado final** | **Sin contradicción normativa; NC-01 abierta en el código**, con corrección y prueba definidas (no impide cerrar D-07, sí es condición de Tanda 2) |

### 3.3 N-07 — Agentes propios
| Campo | Contenido |
|---|---|
| Requisito normativo exacto | `:718-721`: «Solo uno: el orquestador `/evol`… la v1 no crea agentes efímeros bajo demanda, y añadir uno nuevo exige una decisión explícita y una entrada en esta especificación». `:856-858`: orquestación plana |
| Evidencia de implementación actual | Hoy hay un orquestador y dos envoltorios de subagente de solo lectura (`verificador`, `seguridad`, `.claude/agents/`, EV-057); el tope de concurrencia no se construyó (EV-008) |
| Nueva decisión aplicable | OD-20 y OD-25 (confirmadas) y autorización expresa de la enmienda documental (directiva §5) |
| Conflicto | El diseño de Studio añade coordinador, subagentes bajo demanda y workers; la spec exige decisión y entrada |
| Enmienda necesaria | **AMD-02** (con reglas: sin segunda autoridad, sin aprobar, profundidad 1, criterio 76 intacto) |
| Documentos afectados | `ESPECIFICACION.md` (`:26`, `:718-721`, `:856-858`), docs 04, 05, 07, 08 |
| Criterios de aceptación | P-03 para miembros; P-34 (un miembro no lanza otro); sin segundo scheduler; criterio 76 sigue cerrando |
| **Estado final** | **Resuelta documentalmente**; la regla de profundidad 1 queda **a verificar en AgentTeams** (Tanda 1) |

### 3.4 N-10 — Memoria
| Campo | Contenido |
|---|---|
| Requisito normativo exacto | `:20` y `:27` (MemPalace, dependencia externa y MCP de acceso); criterios 8 y 9; `CLAUDE.md`: «MemPalace es la memoria de este proyecto. No uses ninguna otra» |
| Evidencia de implementación actual | `evol memory` habla solo con MemPalace; `evol.config.json` guarda `memory.wing`; hay precedente de interfaz de proveedor en `CodeIntelProvider` (EV-067) |
| Nueva decisión aplicable | **OD-03 ratificada** (directiva §2): dsh-mnemon + Mnemon Native, predeterminado para instalaciones nuevas de Studio |
| Conflicto | Solo si se interpreta que la baseline de Studio reemplaza la memoria de **este** repositorio o de los proyectos existentes; el texto de OD-03 dice «instalaciones nuevas» y «sin migración destructiva» |
| Enmienda necesaria | **AMD-04** (interfaz `MemoryProvider`). `CLAUDE.md` **no** se enmienda |
| Documentos afectados | `ESPECIFICACION.md` (`:20`, `:27`, criterios 8–9), doc 08, doc 02 |
| Criterios de aceptación | pruebas de contrato por proveedor; sin conmutación silenciosa; offline; aislamiento por proyecto; procedencia; sin escritura automática duplicada; autoevolución de skills desactivada |
| **Estado final** | **Resuelta documentalmente por alcance**; el benchmark y la prueba de red (doc 25) ya no son condición de ratificación sino de **aceptación de la integración** |

## 4. Resumen por tipo

35 filas: **SC 4** (N-13, 19, 21, 35) · **CO 18** (incluye las marcadas «/PP») · **SU 6** (N-02, 05, 09, 14, 25, 26) · **CT 4**, todas resueltas por enmienda redactada (N-01 y N-07 contradicciones; N-10 y N-24 contradicciones potenciales resueltas por alcance y por perfiles) · **NC 1** (N-06, defecto de código, no de la norma) · **OB 2** (N-20, N-33). Con prueba pendiente (PP): N-05, 11, 12, 16, 22, 24, 28, 31.

## 5. Estado de D-07 y de H-04

**D-07: CERRADA documentalmente.** La lectura de la normativa es íntegra (EV-057); toda contradicción tiene decisión, enmienda redactada, documentos afectados y criterios de aceptación; no queda ninguna **contradicción normativa material sin resolver**. **Lo que no significa:** que la normativa ya diga lo nuevo. Las ocho enmiendas (doc 28) están **redactadas y autorizadas pero no incorporadas** al texto normativo (se hará con notas «Enmendado por AMD-nn», sin editar lo histórico); y NC-01 es un defecto de código pendiente. Ambas cosas se listan en `25-condiciones-y-pruebas-pendientes.md`.

**H-04: PASS documental**, con ese alcance.
