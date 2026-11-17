# 19 — Matriz de conciliación normativa (H-04, cierra parcialmente D-07)

## 1. Qué se revisó y con qué profundidad

La documentación normativa **efectivamente existente** (EV-050, EV-056). No se dieron por existentes archivos ausentes.

| Documento | Existe | Contenido real | Profundidad de lectura |
|---|---|---|---|
| `docs/ESPECIFICACION.md` | sí, 1 883 líneas | v1 + Ampliaciones 1–8 | cabeceras de todas las ampliaciones + **búsqueda dirigida** de reglas (aprobación, MCP, agentes, memoria, telemetría/red, actualización, `evol ui`) sobre **toda la Ampliación 4–6** (líneas 734–1718) y las líneas citadas leídas en contexto. **No íntegra** (Ampliación 2 y el detalle de 5 y 6 sin leer línea a línea) |
| `docs/specs/SPEC.md` | sí, 332 líneas | Ola 1 (Amp. 7) y Ciclo 2 (Amp. 8) | cabeceras + citas dirigidas |
| `docs/specs/DOMAIN.md` | sí, 131 líneas | dominio Ola 1/Ciclo 2 | cabeceras |
| `docs/specs/THREATS.md` | sí, 142 líneas | amenazas Ola 1/Ciclo 2 | **leído en detalle** (amenazas T-1…T-13 y mitigaciones) |
| `docs/features/FEATURES.md` | sí, 237 líneas | ciclos 1 y 2 | cabeceras + citas |
| `docs/plan/PLAN.md` | sí, 206 líneas | plan del Ciclo 2 | cabeceras |
| ADR vigentes | **no existe `docs/adr/`** | — | — |
| Contratos y documentación de pipeline/memoria/seguridad/agentes/skills | dentro de `ESPECIFICACION.md` y `THREATS.md` | — | como arriba |

Ninguno describe Studio: el ciclo 3 (actual) no ha producido spec. Por tanto «normativa» significa los requisitos **vigentes del framework** con los que Studio debe ser compatible. Los documentos se **conservan sin edición**; esta matriz propone qué enmendar y cuándo.

## 2. Matriz

Clasificación: SC sin conflicto · CO complementado · SU sustituido · CT contradictorio · OB obsoleto · PR pendiente de ratificación · PP pendiente de prueba.

| ID | Documento · referencia | Requisito anterior | Decisión aplicable | Tipo | Corrección necesaria | Estado | Evidencia |
|---|---|---|---|---|---|---|---|
| N-01 | `ESPECIFICACION.md` criterio 22 (+ Amp. 4: «al final, las verificaciones de las disciplinas, pruebas incluidas»); ayuda CLI («MCP de solo lectura») | `evol mcp` ofrece solo herramientas de lectura; no cambia el estado del pipeline. **Matiz:** la propia spec admite que `evol_verify` «fin» ejecuta pruebas | OD-11, OD-15, OD-19; doc 10 §4 | **CT** (spec vs. código) | Separar lectura/escritura/ejecución, anotar, y **enmendar** criterio 22 y la ayuda; hoy `evol_memory_add`, `evol_checkpoint`, `evol_index` escriben y `evol_verify` ejecuta comandos | CT · pendiente de enmienda (H0) | EV-004, 048, 051 |
| N-02 | `ESPECIFICACION.md:47` y criterio 21 | «Aprobar es solo humano: exige terminal interactiva» | OD-04 (autenticación humana real, broker) | **SU** (mecanismo) / se conserva el principio | El principio «solo humano» se mantiene; el **mecanismo TTY** deja de ser suficiente; `approve` solo para persona/broker, no agente | SU · PR (diseño) | EV-052, doc 11 |
| N-03 | `ESPECIFICACION.md` criterio 69 | `/evol` nunca ejecuta `approve` ni `next` | OD-04, OD-07 | SC/CO | Se conserva; se añade que ningún agente de AgentTeams tampoco | CO | doc 11 §7 |
| N-04 | `ESPECIFICACION.md:1239`; THREATS T-5 | Claude Code instala `permissions.deny` para `approve` y `next` | OD-04, OD-11 | **CO** | Pasa a **capa adicional** declarativa; no se cuenta como control principal | CO | EV-052 |
| N-05 | THREATS T-1, T-3; `ESPECIFICACION.md:250` | La clave del gate vive en `~/.config/evol/keys/<id>.key`; mitigada por regla de bloqueo del IDE; leer por script no se bloquea (riesgo aceptado); la clave se copia a otra máquina | OD-04 (broker en otra cuenta; clave inaccesible al agente) | **SU** (mitigación) | Mover la custodia de la clave al broker; revisar copia entre máquinas; decidir firma asimétrica o verificación solo vía broker (sub-decisión) | SU · PR · PP | EV-052, doc 11 §2 |
| N-06 | THREATS T-2; CA-134 | «`doctor` y `verify` comparan `state.json` con el registro firmado» | OD-16 | **CT** (`verify` no lo hace) | Implementar la comprobación en `verify`, `approve` y `next` y **bloquear** operaciones protegidas | CT · PP | EV-045 |
| N-07 | `ESPECIFICACION.md:718` | «Solo un agente propio: el orquestador `/evol`; sin agentes efímeros bajo demanda; añadir uno exige decisión explícita y entrada en la especificación» | OD-20, OD-25 | **CT** | Registrar en la spec que los roles se materializan **como miembros de AgentTeams bajo demanda**; `/evol` sigue siendo el punto de entrada y *no* un segundo scheduler | CT · PR | EV-054 |
| N-08 | `SPEC.md:185`; `FEATURES.md:133` | Fuera de alcance del ciclo 2: orquestador autónomo de equipos y GitFlow | OD-07, OD-25 | **CO** | Era exclusión de ciclo, no prohibición; el orquestado lo cubre AgentTeams; **GitFlow sigue fuera** | CO | EV-054 |
| N-09 | `ESPECIFICACION.md` Ampliación 3 (`evol ui`, BORRADOR) | Panel de documentación por proyecto; mockups en `docs/design/mockups/`; sin construir | OD-17, OD-19 | **SU** (absorbido) | El Control Center incluye sus pantallas; reutilizar mockups y su diseño de seguridad (token por sesión, origen); retirar el compromiso de construir `evol ui` | SU · PR | EV-053 |
| N-10 | `ESPECIFICACION.md:27`; `CLAUDE.md` | MemPalace es la memoria del proyecto; los agentes acceden por su MCP | OD-03 (baseline: dsh-mnemon + Mnemon Native para instalaciones **nuevas**) | **CT** (potencial) | Mientras OD-03 no esté ratificada, MemPalace sigue vigente; enmendar `CLAUDE.md` solo tras ratificación y benchmark | CT · PR · PP | doc 02 OD-03 |
| N-11 | `ESPECIFICACION.md` Ampliación 5 (`evol knowledge`, documentación de referencia) | Fuentes de documentación con origen y licencia, búsqueda y revisión | doc 08 (Project Documents de dsh-mnemon; `dsh-evidence` opcional) | **CO** | Delimitar: `evol knowledge` = referencia gobernada del framework; Project Documents/`dsh-evidence` = documentos del proyecto del usuario; sin escritura automática duplicada | CO · PP | EV-047 |
| N-12 | `SPEC.md:36`; THREATS T-10; `notice.ts` | Aviso local de versión, caché diaria, sin telemetría | OD-10 | **CO** / PP | Desactivar el aviso por política en Studio; comprobar el valor por defecto de `actualizaciones.aviso` | CO · PP | EV-055 |
| N-13 | `ESPECIFICACION.md` Ampliación 6; THREATS T-6…T-8 | Actualización con etiquetas firmadas, sumas y verificación; sin `--insecure`; `--volver` | OD-18 | **SC** | Se reutiliza para el núcleo; los plugins de Harness siguen la matriz de compatibilidad (doc 16) | SC | doc 16 |
| N-14 | THREATS T-11; CA-146/147 | `ciclo nuevo` exige persona en terminal y queda registrado | OD-04 | **SU** (mecanismo) | Pasa por el broker; conserva el registro de ciclo y fecha | SU · PR | doc 10 |
| N-15 | THREATS T-12 | `doctor` lista servidores MCP activos y marca los remotos como salida de datos | OD-10 | **CO** | Studio muestra todos los plugins/servicios con salida de datos | CO | EV-049 |
| N-16 | `ESPECIFICACION.md` Ampliación 4 (niveles A/B/C, «tope de concurrencia») | El orquestador delega con tope de concurrencia | OD-07, OD-23 | **CO** / PP | El tope nunca se construyó (comparativa, EV-008); pasa a AgentTeams y al límite de workers | CO · PP | EV-008 |
| N-17 | `ESPECIFICACION.md:776` | Roles `verificador` y `seguridad` como subagentes de solo lectura con contexto limpio | doc 05 | **CO** | Los 19 roles de Studio **incluyen** esos dos y no los sustituyen | CO | doc 05 |
| N-18 | `disciplines-change.ts` | Cambiar disciplinas invalida aprobaciones | OD-04, doc 10 | **CO** | La UI avisa de la invalidación y exige broker | CO | EV-049 |
| N-19 | `SPEC.md`/`DOMAIN.md` (Ola 1, Ciclo 2); `FEATURES.md`; `PLAN.md` | Lenguajes (`Stack`), escritura con copia y vuelta atrás, reglas de proyecto, documentación atómica, historias/sprints | — | **SC** | Sin conflicto; `Stack` se reutiliza para elegir workers por lenguaje | SC | EV-050 |
| N-20 | `FEATURES.md` Ciclo 2; skill `add` | Convención de ADR en `docs/adr/*.md` | doc 02 / ADR de la investigación | **OB**/PR | Los 6 ADR de Studio viven en `docs/research/.../adr/` (propuestos); al ratificarse deben pasar a `docs/adr/` | PR | EV-050 |
| N-22 | `ESPECIFICACION.md` criterio 94 (Amp. 5) | Cada herramienta que envía datos a la red lo declara y corre con telemetría y verificación contra terceros desactivadas | OD-10, OD-18 | **CO** | Se extiende el mismo criterio a **plugins y servicios** de Studio (CBM, dsh-mnemon, deja-vu, Engram, `dsh-evidence`): declaración de red + captura en prueba | CO · PP | EV-049, doc 11 |
| N-23 | `ESPECIFICACION.md` (Amp. 5, `evol skills incorporar`): «la aprobación por chat se descartó» | La aprobación de una skill exige terminal; ninguna aprobación escrita en un paquete se acepta | OD-04, OD-18 | **CO** | Refuerza OD-04: nada se aprueba por conversación; la aprobación de skills/plugins pasa por el broker | CO | doc 11 §7 |
| N-24 | `ESPECIFICACION.md` Amp. 4 y 5 («lo que vive en archivos de la persona se imprime, no se escribe»; sin `sudo`) | `evol agents` no escribe en configuración de usuario; las herramientas que piden administrador solo se describen | OD-18, OD-10 | **CO** / **CT** potencial | Un instalador comunitario que modifica configuración de agentes (CBM por defecto, deja-vu «wire installed agents») **contradice este principio**: solo se admite con `--no-hooks`/sin escritura o con vista previa y autorización | CO · PP | EV-027, EV-040 |
| N-21 | `CLAUDE.md` (instrucciones del repo) | Commits convencionales en español, sin atribución; MemPalace es la memoria; `evol-dev` para el origen | OD-12, OD-13 | **SC** | Sin conflicto con el trailer `CA:` (a definir) | SC | doc 02 |

## 3. Resumen por tipo

24 filas: SC 3 · CO 12 · SU 4 · CT 4 (N-01, N-06, N-07, N-10) · OB/PR 1. Con prueba pendiente (PP): N-05, N-06, N-10, N-11, N-12, N-16 y las filas que dependen de P-xx del doc 11.

## 4. Estado de D-07

**PARCIALMENTE CERRADA.** Se contrastó la normativa existente con las decisiones v3 y todas las contradicciones detectadas están resueltas o justificadamente abiertas (N-01, 06, 07, 10 quedan **abiertas con corrección definida y dueño**). **No se cierra del todo porque `ESPECIFICACION.md` no se leyó íntegra** (Ampliaciones 2, 5 y 6 en detalle); riesgo residual: requisitos adicionales que no aparecieron en la búsqueda dirigida. Para cerrar D-07: lectura completa de esas ampliaciones y de `SPEC.md`/`FEATURES.md`/`PLAN.md`, y repetir esta matriz.

## 5. Enmiendas propuestas (no ejecutadas; dependen de un ciclo de Evol y de ratificación)

| Enmienda | Documento | Disparador |
|---|---|---|
| Criterio 22 y ayuda de `evol mcp` | `ESPECIFICACION.md`, CLI | H0 |
| Entrada del agente efímero bajo demanda | `ESPECIFICACION.md:718` | ratificación de OD-20/25 |
| Mecanismo de aprobación y custodia de clave | `ESPECIFICACION.md:47`, THREATS T-1/T-11 | diseño del broker (H7) |
| Retiro de `evol ui` | `ESPECIFICACION.md` Amp. 3 | ratificación de OD-17 |
| Memoria del proyecto | `CLAUDE.md`, `ESPECIFICACION.md:27` | ratificación de OD-03 tras benchmark |
| Spec propia de Studio | `docs/specs/` | briefing/spec del ciclo correspondiente |
