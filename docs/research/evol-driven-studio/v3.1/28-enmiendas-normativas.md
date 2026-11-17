# 28 — Enmiendas normativas redactadas (AMD-01 a AMD-08)

**Qué es este documento.** El registro trazable de las enmiendas que la conciliación (doc 19) exige a la normativa vigente de Evol-Driven. Respeta la instrucción de **preservar la documentación histórica**: `docs/ESPECIFICACION.md`, `docs/specs/*`, `FEATURES.md`, `PLAN.md` y `CLAUDE.md` **no se editan en esta entrega**. Cada enmienda da el texto vigente, el texto nuevo, su fundamento, los documentos afectados y su criterio de aceptación.

**Estado de todas:** *redactada* · autorizada en el nivel que indica la columna «Autorización» · **no incorporada al texto normativo**. La incorporación se hará, en el ciclo y la fase que correspondan, **con una nota «Enmendado por AMD-nn»** junto al texto original (no sobrescribiéndolo) y con aprobación humana por `evol` si el documento es artefacto de la fase (p. ej. `SPEC.md`, `DOMAIN.md`, `THREATS.md`).

| ID | Tema | Autorización | Decisión que la origina |
|---|---|---|---|
| AMD-01 | Contrato del MCP por efectos | Directiva v3.1 §5 («MCP»), explícita para documentar | OD-11, OD-15 |
| AMD-02 | Agentes: coordinador, subagentes bajo demanda, workers | Directiva v3.1 §5 («Subagentes»), **enmienda documental explícita** | OD-20, OD-25 |
| AMD-03 | Mecanismo de aprobación y firma | OD-04 (confirmada y concretada en v3.1 §3) | OD-04 |
| AMD-04 | Proveedor de memoria | OD-03 ratificada (v3.1 §2) | OD-03 |
| AMD-05 | `evol ui` absorbido por el Control Center; lista como vista principal | Directiva v3.1 §5 («`evol ui`») y §8 | OD-17, OD-19 |
| AMD-06 | Approval Checklist (OD-26) | OD-26 confirmada | OD-26 |
| AMD-07 | Plugins e instaladores comunitarios | Directiva v3.1 §5 («Instaladores comunitarios») | OD-18 |
| AMD-08 | Repository Explorer (OD-27) | OD-27 confirmada | OD-27 |

---

## AMD-01 — Contrato del MCP por efectos

- **Texto vigente:** criterio 22 (`ESPECIFICACION.md:274`): «`evol mcp` ofrece exactamente sus herramientas de lectura; ninguna aprueba, avanza ni inicializa, y usarlas no cambia el estado del pipeline». Tabla de la Ampliación 1 (`:264`): «Servidor MCP de solo lectura». Y, en la misma spec, `:284` («`evol_verify`… corren los comandos que el proyecto declara»), `:1251` (`evol_verify` modo `fin` ejecuta pruebas) y criterio 125 (`:1694`, `evol_checkpoint` escribe `.evol/checkpoint.*` y el diario): **la spec se contradice a sí misma** (EV-058).
- **Texto nuevo:** «`evol mcp` ofrece herramientas clasificadas por **efecto** (LP lectura pura, LS lectura con efectos secundarios, ED escritura derivada, EP escritura persistente, XP ejecución de procesos o de comandos de la configuración) y cada herramienta lo declara en su anotación. **Ninguna herramienta aprueba, avanza de fase, abre un ciclo, inicializa un proyecto ni cambia la configuración de disciplinas.** Las de lectura pura (LP) no modifican ningún archivo ni ejecutan procesos. `evol_verify` en modo `fin`, `evol_checkpoint`, `evol_memory_add` y `evol_index` **no son de solo lectura**: se anotan como escritura o ejecución y exigen rol Operator. La ayuda de `evol mcp` deja de afirmar «solo lectura»».
- **Documentos afectados:** `ESPECIFICACION.md` (criterio 22; fila de la Ampliación 1; `:283-285`), ayuda de `evol mcp` (código, Tanda 2), `tests/mcp.test.ts` («solo lectura»), doc 10 §4.
- **Criterios de aceptación:** (a) existe una tabla herramienta→efecto→rol y una prueba que la compara con las anotaciones reales; (b) ninguna herramienta MCP llama a `approve`, `next`, `ciclo nuevo` ni a `disciplines enable/disable`; (c) las herramientas LP superan la prueba «hash antes/después» (P-12); (d) la salida de la ayuda coincide con la tabla (P-14).
- **No implementada:** el código sigue sin anotar las herramientas (EV-004).

## AMD-02 — Agentes: coordinador, subagentes bajo demanda y workers

- **Texto vigente:** `ESPECIFICACION.md:718-721`: «Agentes propios de evol-driven (decidido). Solo uno: el orquestador `/evol`… la v1 no crea agentes efímeros bajo demanda, y añadir uno nuevo exige una decisión explícita y una entrada en esta especificación». `:26` («Fuera de la v1… agentes efímeros creados bajo demanda»); `:856-858` (orquestación plana, profundidad 1).
- **Decisión:** el propietario **autoriza la enmienda documental** (v3.1 §5), no su implementación.
- **Texto nuevo:** «Evol-Driven conserva **un único agente de entrada propio: el orquestador `/evol`**. Con Evol-Driven Studio, el orquestador puede coordinar, mediante **AgentTeams**, (a) un **agente coordinador**, (b) **subagentes especializados bajo demanda** (miembros de un equipo, definidos por su perfil: rol, modelo, herramientas) y (c) **workers deterministas** (procesos sin modelo). Se aplican estas reglas: (1) **no existe una segunda autoridad del pipeline ni un segundo scheduler**: las fases las gobierna Evol-Driven y las tareas las coordina AgentTeams; (2) **ningún subagente, worker o coordinador puede aprobar fases protegidas, avanzar de fase, abrir un ciclo ni escribir `.evol/`**; (3) se **conserva la orquestación plana**: un subagente no lanza otro subagente y un worker no es un agente; (4) el criterio 76 se mantiene: cada disciplina la aplica **exactamente un rol de competencia**; los miembros de Studio especializan la ejecución, no reasignan disciplinas; (5) `verificador` y `seguridad` siguen siendo de solo lectura con contexto limpio; (6) la ejecución adaptativa del pipeline (OD-25) no reduce verificaciones, permisos ni autorizaciones».
- **Documentos afectados:** `ESPECIFICACION.md` (`:26`, `:718-721`, `:856-858`), docs 04, 05, 07, 08 (reglas ya coherentes; se añade la regla de profundidad 1 y la prueba P-34).
- **Criterios de aceptación:** (a) un miembro intenta `approve`/`next`/`ciclo nuevo`/escribir `.evol/` → denegado (P-03); (b) un miembro intenta lanzar otro miembro → denegado o inexistente (P-34, **a verificar en AgentTeams durante la Tanda 1**); (c) un worker no invoca modelos; (d) la suma de disciplinas por rol sigue cerrando (criterio 76); (e) no hay un segundo planificador de tareas (revisión de doc 07).
- **No implementada.**

## AMD-03 — Mecanismo de aprobación y firma

- **Texto vigente:** `:47` («Aprobar es solo humano: `evol approve` exige una terminal interactiva y que escribas el nombre de la fase»); `:48-49` (clave del gate en la configuración del usuario); criterios 2, 3, 21, 69, 147; Ampliación 2 `:292` («no hay firmas por persona; se mantiene la clave HMAC actual») y `:393`; THREATS T-1, T-3, T-5, T-11.
- **Texto nuevo:** «Los mecanismos de aprobación se definen por **perfil de instalación**. **Perfil `terminal`** (proyectos de Evol-Driven sin Studio): el mecanismo actual (terminal interactiva, nombre de la fase, HMAC) se conserva sin cambios. **Perfil `broker`** (Evol-Driven Studio): toda aprobación protegida exige **WebAuthn con verificación de usuario obligatoria** y es firmada con **Ed25519** por el Approval Broker (doc 11); una confirmación visual, un TTY o un HMAC compartido **no bastan**; si el broker falla, lo protegido queda bloqueado; no existe `--yes`, bypass ni ruta de emergencia genérica. **El principio «aprobar es solo humano» se conserva en ambos perfiles.** «Firmas por persona (descartadas por ahora)» queda **sustituido** en el perfil `broker`».
- **Documentos afectados:** `ESPECIFICACION.md` (`:47-49`, `:292`, `:393`, criterios 2 y 3 como propios del perfil `terminal`), `THREATS.md` (T-1, T-3, T-5, T-11: nuevo apartado de Studio), doc 11, doc 02 (OD-04).
- **Criterios de aceptación:** las pruebas P-03, P-15, P-18…P-34 del doc 11; formato de entrada v2 documentado; lectura compatible de entradas HMAC mediante `epoch-start`.
- **No implementada.**

## AMD-04 — Proveedor de memoria

- **Texto vigente:** `:20` («Memoria con MemPalace… dependencia externa»), `:27` («los agentes acceden a la memoria por el MCP de MemPalace»), criterios 8 y 9; `CLAUDE.md` («MemPalace es la memoria de este proyecto. No uses ninguna otra»).
- **Texto nuevo:** «`evol memory` accede a la memoria mediante una interfaz **`MemoryProvider`** (patrón de `CodeIntelProvider`, criterios 14 y 15), con dos proveedores: **`mempalace`** (vigente; es el de este repositorio y el de los proyectos existentes) y **`mnemon`** (dsh-mnemon + Mnemon Native; **predeterminado en instalaciones nuevas de Evol-Driven Studio**). El proveedor se fija en `evol.config.json`; **nunca cambia en silencio**; no hay migración destructiva. No se activan varios proveedores de escritura automática sobre las mismas sesiones sin una política explícita. El proveedor de memoria **no sustituye** la autoridad de Evol-Driven sobre requisitos, verificaciones, aprobaciones y fases».
- **`CLAUDE.md`:** **no se enmienda**. Su regla describe el repositorio `evol-driven`; la baseline de Studio rige para **instalaciones nuevas** (OD-03), de modo que no hay contradicción mientras no se declare el proveedor `mnemon` para este repositorio.
- **Documentos afectados:** `ESPECIFICACION.md` (`:20`, `:27`, criterios 8 y 9, como propios del proveedor `mempalace`), doc 08, doc 02 (OD-03).
- **Criterios de aceptación:** pruebas de contrato del proveedor para ambos (misma suite); funcionamiento sin conexión; aislamiento por proyecto; procedencia de cada recuerdo; captura automática controlada; autoevolución de skills desactivada; sin dependencia cloud (benchmark y red, doc 25).
- **No implementada** (hoy `evol memory` solo habla con MemPalace).

## AMD-05 — `evol ui` absorbido y vista principal de documentos

- **Texto vigente:** Ampliación 3 (`:404-562`, **BORRADOR**): `evol ui` en `127.0.0.1`, criterios 38–65; criterio 62: «La página Documentación abre en la vista Constelación»; `:489-494` (mockups = wireframes).
- **Texto nuevo:** «`evol ui` **no se construye como producto separado**: sus pantallas y requisitos de seguridad (acciones que escriben con token por sesión y comprobación de origen; sin datos sensibles en el HTML; pantalla Skills sin controles de crear, subir o importar; teclado y `prefers-reduced-motion`) pasan a ser requisitos del **Control Center de Evol-Driven Studio** (`EVOL-STUDIO-UI-UX-SYSTEM`). La vista de **Documentos abre en Lista**; la constelación y los grafos son vistas complementarias con lista equivalente (criterio 62 queda sustituido)».
- **Documentos afectados:** `ESPECIFICACION.md` (Amp. 3), docs 09 y 23.
- **Criterios de aceptación:** UX-01…UX-12 (doc 23); equivalencia lista↔grafo.
- **No implementada.**

## AMD-06 — Approval Checklist

- **Texto nuevo (nueva ampliación de Studio):** «En el perfil `broker`, antes de la ceremonia de autorización, la persona revisa los ítems obligatorios de la fase (contrato `review-item/1`); no se puede avanzar con ítems obligatorios sin conformidad válida o con cambios pendientes; las conformidades se atan a la versión de los artefactos; los agentes no pueden marcar ítems; el checklist no reemplaza la firma del broker».
- **Documentos afectados:** `ESPECIFICACION.md` (apartado nuevo), `SPEC.md`/`DOMAIN.md`/`THREATS.md` del ciclo de Studio, docs 09, 10, 11, 21.
- **Criterios de aceptación:** AC-CL-01…16 (doc 21).

## AMD-07 — Plugins e instaladores comunitarios

- **Texto vigente:** `:1237` («lo que vive en archivos de la persona se imprime, no se escribe»), criterios 94 y 143, T-6…T-8.
- **Texto nuevo:** «Los plugins comunitarios de Studio se instalan **solo en perfiles de Harness aislados**, con versión exacta, hash y licencia registrados en el manifiesto reproducible (doc 27). Un instalador que modifica configuraciones de agentes (Codebase Memory, deja-vu) se **revisa antes** y se prueba en un **entorno desechable** antes de usarse en un perfil persistente; sin autorización explícita no escribe en la configuración personal de la persona. Ninguna opción permite saltarse la verificación de hashes o firmas (paridad con CA-143)».
- **Documentos afectados:** `ESPECIFICACION.md` (apartado de Studio), docs 13, 16, 27.
- **Criterios de aceptación:** prueba del instalador en entorno desechable con comparación de `HOME`, perfiles y configuración de agentes antes/después; captura de red; desinstalación limpia (doc 27 §4).

## AMD-08 — Repository Explorer

- **Texto nuevo (nueva ampliación de Studio):** «El plugin **Evol Repository Explorer** ofrece, solo de lectura, historial Git local y actividad GitHub opcional, relacionados con pipeline, tareas, criterios y evidencias. No realiza `push`, `merge` ni borrado de ramas y no almacena tokens en lugares accesibles a los agentes».
- **Documentos afectados:** `ESPECIFICACION.md` (apartado nuevo), doc 22.
- **Criterios de aceptación:** RE-01…RE-12 (doc 22).

---

## Observaciones que no requieren enmienda

- **O-01 (cifras antiguas):** criterios 6, 7 y 76 hablan de «31» disciplinas; la Ampliación 8 (`:1831`) fija 35. Es una inconsistencia previa y ajena a Studio; se anota para la próxima revisión de la spec.
- **NC-01 (no conformidad de implementación, N-06):** la normativa es correcta («`doctor` y `verify` comparan `state.json` con el registro», T-2); el **código** solo lo hace `doctor` (EV-045). Se corrige en el código (H0, doc 14), **no** se enmienda la spec.

## Calendario de incorporación (programado; nada incorporado hasta hoy)

**Comprobado en `git`:** `docs/ESPECIFICACION.md` no se ha modificado (EV-074): **ninguna** enmienda está incorporada; AMD-01 y AMD-02 están solo **redactadas**. La frase «AMD-01 y 02 ya» del doc 29 era una **propuesta de calendario**, no un estado.

**Mecanismo:** ciclo 3 de `evol`, fase *spec*, con aprobación humana; nota «Enmendado por AMD-nn» junto al texto original, sin borrarlo; incorporar un texto **no** equivale a haber implementado el código.

| Orden | Enmienda | Debe estar incorporada antes de | Motivo |
|---|---|---|---|
| 1 | AMD-01, AMD-02 | H0 (Tanda 2) | corrigen una contradicción vigente y gobiernan la anotación del MCP y los miembros de AgentTeams |
| 2 | AMD-07 | cierre de la Tanda 1 | gobierna instaladores y perfiles aislados |
| 3 | AMD-05 | H2 (primera vista) | sustituye el criterio 62 y absorbe `evol ui` |
| 4 | AMD-04 | H4 (`MemoryProvider`) | contrato de memoria |
| 5 | AMD-03, AMD-06 | H7 | broker y checklist |
| 6 | AMD-08 | H8b | Repository Explorer |
