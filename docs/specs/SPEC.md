# Especificación — Ola 1 (ampliación 7): Evol-OS, seguridad, aislamiento y conexión con los agentes

> Sigue a `docs/features/FEATURES.md`. Los criterios se numeran desde CA-128 porque el 127 ya se usó
> en la ola 0 (adopción de evol sobre su propio repositorio). Se pasan a `docs/ESPECIFICACION.md`
> como «Ampliación 7» en la retro, junto con las pruebas que los cubren.

## Problema y para quién

Quien mantiene o usa evol hoy tiene estos huecos:

- **Evol-OS** (un proyecto Python/shell) no se puede adoptar sin remapear rutas a mano, porque evol
  asume TypeScript.
- `evol agents` sobrescribe archivos de agentes sin copia ni vuelta atrás, y no deja rutas sensibles
  bloqueadas por defecto.
- Junto a otro framework de agentes instalado globalmente (gentle-ai o cualquier otro), las reglas
  de evol pueden perder frente a las globales, sin que nadie lo note.
- En OpenCode y en Claude Code, evol es un comando suelto, no un agente con nombre propio: no
  aparece como «Evol» en la barra del IDE.
- Una versión publicada de evol no lleva procedencia verificable (sumas, SBOM) más allá de la
  firma de la etiqueta, y nadie avisa cuando hay una versión nueva.
- Tras cerrar un ciclo completo del pipeline (hasta retro), no hay forma de abrir uno nuevo sin
  perder la auditoría del anterior.
- La instrucción que evol escribe dice siempre «no modifiques el framework», incluso en el propio
  repositorio de evol, donde eso es justo lo que hay que hacer.

## Alcance

**Entra:**

- Detección de lenguaje de proyecto (Python, shell) y perfil `script` para scripts sueltos.
- Copia, ensayo (`--dry-run`) y vuelta atrás (`--deshacer`) en `evol agents`.
- Reglas de bloqueo por defecto para rutas sensibles del sistema y del propio proyecto.
- Diagnóstico y aislamiento frente a configuración global de otro framework de agentes.
- Integración de evol como agente propio en OpenCode y como identidad propia en Claude Code.
- SBOM y sumas firmadas en cada versión publicada; verificación en `evol update`.
- Aviso local de versión nueva, sin telemetría.
- `evol ciclo nuevo` para abrir un segundo ciclo del pipeline.
- Instrucción consciente de si el repositorio es el propio origen de evol.

**Queda fuera de esta ola** (en el plan, para olas siguientes): el registro de propiedad de
archivos generados (ola 2), la retirada de archivos de versiones anteriores (ola 2), el checkpoint
automático por hook (ola 2), la profundidad de revisión según el riesgo (ola 2), los recibos del
auditor (ola 2), el modo ligero para cambios pequeños (ola 3), el banco determinista (ola 3) y la
delegación medida (ola 3).

## Supuestos

- **Confirmado (ensayo real, 2026-10-25, `docs/design/consultas/respuesta-claude-code-aislamiento.md`):**
  en Claude Code, una regla `permissions.deny` de `.claude/settings.json` del proyecto bloquea el
  comando **de forma silenciosa, sin ningún diálogo de confirmación**, aunque `permissions.defaultMode`
  sea `bypassPermissions` a nivel de usuario. De esto dependía que CA-134 pudiera llamarse
  «impuesta» de verdad (T-1, T-3 de `docs/specs/THREATS.md`): queda confirmado para Claude Code.
- **Confirmado, con un matiz (mismo ensayo, en OpenCode):** el `default_agent` y el `agent.<id>` que
  escribe el proyecto prevalecen sobre los que trae la configuración global (la barra de estado
  mostró el agente del proyecto, no el global) — confirma la parte de CA-137/CA-140 sobre
  OpenCode. El bloqueo de un comando de shell también ocurrió con un permiso global laxo
  (`"bash": {"*": "allow"}`), pero el mensaje de OpenCode («el entorno de ejecución de shell está
  denegado en esta sesión») no distingue si lo bloqueó la regla `deny` del proyecto o si, por
  defecto, un agente nuevo (`mode: primary`) sin permiso de `bash` concedido explícitamente no lo
  tiene, con independencia de esa regla. **Queda «a verificar»** si es específicamente la regla
  `deny` la que protege, no solo la ausencia de un `allow` explícito para el agente «evol» que M5
  creará.
- Lo mismo para `outputStyle` de Claude Code: no se comprobó en el ensayo (solo se probó la regla de
  bloqueo). Se mantiene «por confirmar» para CA-135/CA-140, con una prueba más barata de hacer
  cuando se construya M4/M6 (preguntar por el estilo activo, o mirar un indicio visual).
- «La persona» en los criterios de `evol ciclo nuevo` y de las instrucciones según el repositorio es
  quien mantiene o usa evol, no un rol nuevo del pipeline.

## Criterios de aceptación

1. **CA-128**: `evol init` detecta el lenguaje de un proyecto sin `evol.config.json` propio —
   Python por `pyproject.toml`, `requirements*.txt` o un `.py` en la raíz, shell por la presencia
   de `*.sh` — y remapea las rutas y el comando de TDD en consecuencia; `--lenguaje <id>` manda
   sobre la detección.
2. **CA-129**: en un proyecto remapeado a Python o shell, `evol verify` (en la fase build) ejecuta
   el comando de pruebas de ese lenguaje (pytest, bats) y da BLOCK si falla, nombrando la prueba
   que falló.
3. **CA-130**: `evol coverage` reconoce un criterio `CA-n` citado en el nombre de una prueba de
   pytest (`def test_ca_n_…`) o en la descripción de un `@test` de bats.
4. **CA-131**: el perfil `script` solo activa BDD en la fase briefing (ni FDD ni ATDD).
5. **CA-132**: `evol agents --dry-run` lista los archivos que crearía o cambiaría, sin escribir
   ninguno.
6. **CA-133**: `evol agents --deshacer` restaura exactamente el contenido anterior a la última
   escritura, deja una copia en `.evol/respaldos/<id>/` con su `manifest.json`, y no sobrescribe un
   archivo que la persona editó después de que evol lo escribiera.
7. **CA-134**: los archivos de agentes que `evol agents` genera incluyen, por defecto, reglas de
   bloqueo para `~/.ssh`, `.env`/`.env.*`, `*.pem`, `*.key`, `~/.aws/credentials`,
   `.evol/state.json`, `.evol/gate-log.jsonl`, `evol ciclo*` y la clave del gate
   (`~/.config/evol/keys`); y `evol doctor` detecta cuando la fase de `.evol/state.json` no
   concuerda con la última aprobación válida del registro firmado.
8. **CA-135**: al ejecutar `evol agents`, ningún archivo fuera del proyecto cambia de contenido, y
   solo se desactivan en el proyecto los plugins de agentes que `evol doctor` detecta activados
   globalmente (uno inactivo no se menciona).
9. **CA-136**: `evol doctor` clasifica cada protección de convivencia como «impuesta» o
   «declarativa», nombra los hooks globales que no se pueden anular (solo se informa), y avisa si
   el modo de permisos global ejecuta sin confirmación (`bypassPermissions` o equivalente).
10. **CA-137**: tras `evol agents` en un proyecto con OpenCode, el proyecto queda con `evol` como
    `default_agent`, con un agente `evol` de `mode: primary` y una descripción propia del
    orquestador.
11. **CA-138**: `evol agents` es idempotente sobre `opencode.json` (una segunda ejecución sin
    cambios en el proyecto no modifica el archivo), y `evol agents --deshacer` devuelve el
    `default_agent` que había antes.
12. **CA-139**: el permiso de `bash` del agente `evol` en OpenCode deniega `evol approve` y
    `evol next`.
13. **CA-140**: tras `evol agents` en un proyecto con Claude Code, el proyecto queda con el estilo
    `Evol` activo y una línea de estado que muestra la fase actual del pipeline.
14. **CA-141**: `evol agents --deshacer` retira el estilo y la línea de estado de evol del
    proyecto.
15. **CA-142**: `evol release` incluye, dentro del commit etiquetado, `release/SUMAS.txt`,
    `release/sbom.spdx.json` y `release/SUMAS.txt.sig` (firmado con la clave de la etiqueta).
16. **CA-143**: `evol update` rechaza una versión cuyos archivos no coinciden con sus propias
    sumas, y rechaza una etiqueta firmada por una clave no autorizada; ninguna opción de
    `evol update` permite saltarse esas comprobaciones.
17. **CA-144**: `evol release --sin-sbom` publica sin SBOM y lo deja registrado en `release.json`.
18. **CA-145**: `evol doctor` avisa, como mucho una vez al día y sin retrasar el comando más de 6
    segundos cuando no hay red, de una versión nueva firmada, nombrando las skills que perderían la
    aprobación al actualizar; la persona puede apagar el aviso en su configuración.
    **Reserva (2026-10-25, revisada el mismo día):** el propio aviso cuesta ~10-60 ms (medido).
    `evol doctor` costaba ~2.6-2.7 s _antes_ de esta mejora (conexión a MemPalace y sondeo de la
    versión de ~15 herramientas de seguridad, en serie); se paralelizaron ambas y se acotó a 1,5 s
    cada sondeo de versión, bajando el coste normal a ~1.6-1.7 s. Aun así, corriendo dentro de
    `npm run ci` (los 1170 casos de los 56 archivos de prueba en paralelo) la contención de CPU de
    la máquina sigue empujando el caso límite por encima de 3 s de forma consistente (~4 s medidos):
    ya no es algo que el código de `doctor` pueda acotar sin más cambios de alcance mayor. Por
    decisión de la persona (2026-10-25), el presupuesto del criterio y de la prueba de aceptación
    pasan de 3 a 6 segundos, realista para ese escenario de carga total; el uso normal (una sola
    invocación) sigue siendo de ~1.6-1.7 s.
19. **CA-146**: `evol ciclo nuevo` abre un segundo ciclo del pipeline sin invalidar la cadena de
    aprobaciones firmadas del primer ciclo, y las aprobaciones del ciclo anterior no cuentan como
    aprobación previa del nuevo.
20. **CA-147**: `evol ciclo nuevo` exige una persona en una terminal (como `evol approve`), y
    ninguna herramienta del MCP de evol permite abrirlo.
21. **CA-148**: en el propio repositorio de evol-driven, la instrucción que `evol agents` genera en
    `AGENTS.md` invita a editar el framework; en cualquier otro proyecto, sigue prohibiéndolo.
22. **CA-149**: `evol doctor` lista los servidores MCP activos del proyecto (los del proyecto y los
    globales que el IDE heredaría), con su transporte, y marca los remotos como una salida de
    datos. Criterio nuevo, añadido en spec a partir de la revisión de seguridad (el plan ya lo
    preveía para M4, pero no había quedado en ningún criterio de briefing).

> El criterio 22 (CA-149) es posterior al briefing de esta ola: la revisión del rol `seguridad`
> encontró que M4 preveía listar los MCP remotos (RISK-004 del hallazgo de gentle-ai) y que no
> había quedado en ningún criterio. Como el briefing de CA-135/CA-136 ya está aprobado, se añade al
> final en vez de ampliar un criterio existente (regla de SDD: «no renumeres criterios que ya
> existen»). Lleva su propio escenario y prueba, añadidos en spec a los artefactos de BDD/ATDD de
> esta ola (`tests/features/aislamiento-proyecto.feature`,
> `tests/acceptance/aislamiento-proyecto.acceptance.test.ts`); no toca los escenarios ni las
> pruebas de CA-135/CA-136 que briefing ya aprobó.

---

# Especificación — Ciclo 2 (ampliación 8): documentación atómica y con evidencia

> Sigue a `docs/features/FEATURES.md` (sección «Ciclo 2»). Los criterios continúan en CA-150 porque
> el ciclo 1 llegó a CA-149. Se pasan a `docs/ESPECIFICACION.md` como «Ampliación 8» en la retro,
> junto con las pruebas que los cubren. Las decisiones de la persona y los supuestos viven en
> `FEATURES.md` y no se repiten aquí salvo cuando fijan un contrato.

## Problema y para quién

Quien usa evol para construir un proyecto acaba con pocos documentos grandes (`SPEC.md`,
`DOMAIN.md`, `THREATS.md`, `PLAN.md`): sirven para aprobar una fase, pero no dejan evidencia fina de
cómo se llegó a cada decisión, ni permiten que un agente que implementa un subdominio lea solo lo
suyo. Tampoco hay dónde dejar una investigación con sus fuentes, ni requisitos no funcionales con su
umbral, ni una forma de partir el desarrollo en historias y sprints con su propia memoria.

El método de `evol-system` resolvía parte de esto con documentos atómicos, pero sus campos de
fuentes y de trazabilidad estaban vacíos en la práctica. Este ciclo lleva ese método a evol con una
diferencia: **cada vínculo lo comprueba evol**.

## Alcance

- `evol docs check [--estricto] [--json]`: comprueba los documentos de dominio, los requisitos, el
  dossier de investigación y los sprints de cada módulo del proyecto.
- `evol docs evidencia [--json]`: comprueba solo los dossiers de investigación.
- `evol sprint check [--json]` y `evol sprint estado [--json]`.
- Cuatro disciplinas nuevas (`GRANULAR`, `INVESTIGACION`, `REQDD`, `SPRINTDD`), cada una con su
  skill, y `ADD` enriquecida; las cinco entran en el perfil base (de 9 a 14 disciplinas).
- Verificaciones de disciplina con nivel de aviso y por secciones.
- El campo `rol` en `evol disciplines list --json`.
- Plantillas de `evol new` que pasan las comprobaciones una vez completadas.
- Corrección de `m-005`: el estado de una fase al abrir un ciclo nuevo dice «pendiente».

## Fuera de alcance

- El orquestador autónomo de equipos de subagentes y GitFlow (`/evol sprint` de evol-system).
- Los JSON «gemelos» de cada documento.
- Una herramienta del MCP para `evol docs`: expondría rutas al modelo sin que haya contrato,
  amenazas ni criterios para ello; queda para un ciclo posterior (limitación L4).
- Comprobar que una fuente diga lo que el índice de evidencia afirma de ella (ver limitación L2).
- Cambiar los proyectos que ya existen.

## Contratos de formato

Los comprobadores solo entienden estos formatos; lo que no cabe en ellos no se comprueba.

| Parte        | Archivo                                                        | Formato                                                                                                                                                                                                                                        |
| ------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dominios     | `docs/proyecto/<dominio>/<subdominio>.md`                      | Una línea `Origen: <ruta>` hacia un archivo que existe. Al menos 15 líneas de contenido (aviso).                                                                                                                                               |
| Índice       | `docs/proyecto/INDEX.md`                                       | Un enlace Markdown `[texto](dominio/subdominio.md)` por documento, relativo a `docs/proyecto/`.                                                                                                                                                |
| Dossier      | `investigacion/<tema>/<tema>-evidence-index.md`                | Tabla `ID \| Fuente \| Consultada \| Clasificación \| Afirma`; ID `E-n`; fecha `AAAA-MM-DD` no futura; clasificación del vocabulario cerrado.                                                                                                  |
| Dossier      | `investigacion/<tema>/<tema>-audit.md` y demás `*.md` del tema | Las citas se escriben `[E-n]` y cada una existe en el índice; una fuente que nadie cita avisa.                                                                                                                                                 |
| NFR          | `docs/requisitos/NO_FUNCIONALES.md`                            | Tabla `ID \| Requisito \| Métrica \| Umbral \| Validación`; ninguna celda vacía.                                                                                                                                                               |
| Limitaciones | `docs/requisitos/RESTRICCIONES.md`                             | Sección «Limitaciones conocidas»; cada `### Ln` lleva las líneas `Razón:`, `Impacto:` y `Roadmap:`.                                                                                                                                            |
| Glosario     | `docs/requisitos/GLOSARIO.md`                                  | Un `### Término` por término; no se repite ninguno (sin distinguir mayúsculas ni tildes).                                                                                                                                                      |
| ADR          | `docs/adr/NNNN-titulo.md`                                      | Secciones Contexto, Opciones, Decisión, Consecuencias y Referencias; la falta de una avisa.                                                                                                                                                    |
| Sprints      | `docs/sprints/INDEX.json`                                      | `{ "sprints": [{ "id", "titulo", "historias": ["HU-n"] }] }`; `id` `[A-Za-z0-9_-]{1,40}`, historia `HU-[0-9]{1,6}`; sin claves desconocidas, sin ids repetidos (sin distinguir mayúsculas), como mucho 200 sprints y 200 historias por sprint. |
| Historias    | `docs/historias/HU-n/`                                         | `propuesta.md`, `requisitos-escenarios.md`, `escenario-tecnico.md` y `checklist-tareas.md` (tareas `- [ ]` y `- [x]`).                                                                                                                         |
| Cierre       | `docs/sprints/<id>/memoria.md` y `lecciones.md`                | Se exigen solo cuando el sprint está cerrado: todas las tareas de los checklists de sus historias marcadas, y al menos una.                                                                                                                    |

Reglas de lectura comunes (valen para los cuatro comandos y para `evol verify`):

1. **Rutas, en este orden.** Primero una comprobación léxica sobre el texto: se rechaza una ruta
   absoluta, con segmentos `..`, con un esquema (`file:`, `data:`, `//host`, `C:\`) salvo los
   enlaces `http:` y `mailto:` (que se ignoran), con caracteres de control o con `%00`; se quita
   `#ancla` y `?consulta` y se decodifica `%` una sola vez. Después se resuelve con `realpath` el
   ancestro que existe y debe quedar dentro de la raíz del módulo. Fuera de la raíz, «no existe» y
   «no se puede resolver» dan **el mismo** mensaje, para no revelar qué hay fuera del proyecto.
2. **Lectura.** Solo archivos regulares (nunca FIFO ni dispositivos). Se abre sin seguir el enlace
   final, se comprueba con `fstat` sobre el descriptor ya abierto y se lee como mucho el tope más
   un byte; un enlace simbólico dentro de una carpeta de documentos es un hallazgo. EACCES, ELOOP,
   ENAMETOOLONG y ENOENT son hallazgos, nunca excepciones.
3. **Topes (bloqueo si se superan, porque un documento grande esconde citas huérfanas):** 1 MiB por
   archivo, 500 archivos y 5 MiB en total por parte, profundidad 6. Si se supera un tope, la parte
   se da por no comprobada y el comando falla diciendo cuál.
4. **Mensajes.** Se distingue el **contenido** (frases, celdas, descripciones, valores: nunca se cita)
   de los **nombres** (rutas relativas al módulo, identificadores `E-n`, `NFR-n`, `Ln`, `HU-n`, id de
   sprint, término del glosario). Un nombre sale **saneado**: sin caracteres de control, secuencias
   ANSI, saltos de línea ni marcas bidireccionales, y truncado a 80 caracteres con «…»; un
   identificador que no cumple su patrón sale como «identificador no válido en la línea N». Lo que
   sale por `--json` pasa por el mismo saneado.
5. **Texto.** Los bloques de código (tres tildes inversas) no cuentan como contenido, encabezados ni
   enlaces; los archivos se leen como UTF-8 y los bytes inválidos se reemplazan. Una tarea de
   checklist es una línea que empieza (con hasta tres espacios) por `- [ ]`, `- [x]` o `- [X]`.
6. **Fechas.** `AAAA-MM-DD` reales, comprobadas de ida y vuelta (`2026-02-30` no vale); una fecha es
   futura solo si supera a la vez la fecha local y la UTC. Las clasificaciones se comparan sin
   distinguir mayúsculas ni tildes.
7. **Qué se aprueba.** Todo archivo que lee un comprobador es artefacto de su disciplina (con mínimo
   0 cuando es opcional), así que cambiarlo después de aprobar la fase invalida la aprobación; una
   prueba de registro lo comprueba para cada disciplina con comprobación de documentos.

## Criterios de aceptación

1. **CA-150**: `evol docs check` termina bien sobre un árbol `docs/proyecto/` consistente: cada
   documento de dominio aparece enlazado en `docs/proyecto/INDEX.md`, cada enlace del índice apunta
   a un documento que existe y cada documento declara su `Origen:` en un archivo que existe.
2. **CA-151**: `evol docs check` falla y nombra, a la vez, un documento que el índice no enlaza y un
   enlace del índice que apunta a algo que no existe (trazabilidad en las dos direcciones).
3. **CA-152**: `evol docs check` falla y nombra el documento de dominio que no declara `Origen:`, y
   el que lo declara hacia un archivo que no existe (nombrando también esa ruta).
4. **CA-153**: la disciplina `GRANULAR` figura en `evol disciplines list --json` con el rol
   «arquitecto» y la fase «spec»; el listado incluye ahora el campo `rol` de cada disciplina.
5. **CA-154**: `evol docs check` avisa, sin fallar, de un documento de dominio con menos de 15 líneas
   de contenido, y solo de ese; con `--estricto` el aviso hace fallar el comando.
6. **CA-155**: un aviso no bloquea: con solo avisos pendientes (un ADR sin «Referencias»),
   `evol verify` da WARN y la fase se puede aprobar.
7. **CA-156**: un proyecto nuevo creado con el perfil base trae 14 disciplinas (las 9 de siempre más
   `ADD`, `GRANULAR`, `INVESTIGACION`, `REQDD` y `SPRINTDD`); los perfiles `lib` y `script` y un
   proyecto creado antes conservan su lista.
8. **CA-157**: `evol docs evidencia` termina bien sobre un dossier consistente: cada fuente tiene
   ID `E-n`, fecha de consulta y clasificación válidas, y toda cita `[E-n]` del tema existe en su
   índice.
9. **CA-158**: `evol docs evidencia` falla y nombra una fuente sin fecha de consulta y otra con una
   clasificación fuera de hecho, supuesto o contradicción, y no nombra las fuentes válidas.
10. **CA-159**: `evol docs evidencia` falla y nombra una cita `[E-n]` que no existe en el índice del
    tema.
11. **CA-160**: con la disciplina `INVESTIGACION` activa, `evol verify` da BLOCK nombrando el índice
    de evidencia cuando un tema tiene auditoría pero no índice, y PASS cuando ambos son
    consistentes; la disciplina figura con el rol «analista».
12. **CA-161**: `evol docs check` falla y nombra el requisito no funcional al que le falta el umbral
    y el que carece de validación, cada uno por su motivo, y no nombra los completos.
13. **CA-162**: `evol docs check` falla y nombra la limitación conocida a la que le falta un campo,
    diciendo solo el campo que falta (`Razón`, `Impacto` o `Roadmap`), y no nombra las completas.
14. **CA-163**: `evol docs check` falla y nombra el término del glosario definido más de una vez, y
    no nombra los que aparecen una sola vez.
15. **CA-164**: la disciplina `REQDD` figura en `evol disciplines list --json` con el rol «analista»
    y la fase «spec».
16. **CA-165**: con la disciplina `ADD` activa, `evol verify` avisa (WARN) de un ADR sin la sección
    «Referencias» y le pide enlazar la decisión con su implementación y sus pruebas.
17. **CA-166**: con la disciplina `ADD` activa, `evol verify` avisa por separado de un ADR sin la
    sección «Opciones» y de otro sin «Consecuencias», cada uno solo por lo que le falta, y no nombra
    un ADR completo.
18. **CA-167**: `evol sprint check` falla y nombra la historia de `docs/sprints/INDEX.json` que no
    existe en `docs/historias/`.
19. **CA-168**: `evol sprint estado` informa, por sprint, de cuántas tareas de los checklists de sus
    historias están marcadas sobre el total (por ejemplo «3 de 5»).
20. **CA-169**: `evol sprint check` reporta como incompleto, nombrando `lecciones.md` y `memoria.md`,
    el sprint con todas sus tareas marcadas que no los tiene, y no exige nada a un sprint abierto.
21. **CA-170**: la disciplina `SPRINTDD` figura en `evol disciplines list --json` con el rol
    «analista» y la fase «plan».

## Limitaciones conocidas

### L1 Las disciplinas con comprobación de documentos no admiten remapear sus rutas

Razón: los comprobadores miran carpetas fijas (`docs/proyecto`, `docs/requisitos`, `docs/sprints`,
`investigacion`); si un módulo remapeara el artefacto, la comprobación de artefactos lo encontraría
en el sitio nuevo y el comprobador diría «nada que comprobar».
Impacto: un proyecto adoptado con `evol init` cuyo módulo remapea esas rutas recibe un error claro
al cargar su configuración, en vez de un PASS falso.
Roadmap: pasar al comprobador las rutas ya resueltas por módulo cuando haga falta (ciclo posterior).

### L2 Evol comprueba la forma y los vínculos de la evidencia, no su verdad

Razón: verificar que una fuente diga lo que el índice afirma exige leerla y entenderla, y evol no usa
ningún modelo para verificar.
Impacto: un índice bien formado con una afirmación falsa pasa las comprobaciones; la clasificación
en hecho, supuesto o contradicción la revisa la persona al aprobar la fase.
Roadmap: revisar el 2027-06-30 si compensa un comprobador de enlaces vivos.

### L3 Solo se leen archivos Markdown en el dossier

Razón: los dossiers suelen traer PDF y otros binarios, y leerlos exigiría analizadores que abren
superficie de ataque.
Impacto: una cita dentro de un PDF no se comprueba.
Roadmap: ninguno previsto.

### L4 No hay herramienta del MCP para los comandos de documentación

Razón: la salida de una herramienta del MCP entra en el contexto del modelo de un tercero, así que
necesita su propio contrato (parámetros sin rutas libres, rutas relativas, saneado y una prueba de
solo lectura) y su propia amenaza.
Impacto: el orquestador consulta `evol docs check` y `evol sprint check` por la línea de comandos, como
con las demás comprobaciones que no son herramientas del MCP.
Roadmap: especificarla en un ciclo posterior si la persona la necesita.

### L5 Los nombres de archivo y de tema salen en los mensajes

Razón: sin ellos un hallazgo no dice dónde está el problema.
Impacto: un nombre como `entrevista-juan-perez.md` aparece en la salida, en `--json`, en CI y en
logs. Los nombres se sanean y se truncan, pero no se ocultan.
Roadmap: ninguno previsto; la skill `investigacion` recomienda no poner datos personales en nombres
de archivo y activar PrivacyDD si el dossier trata datos de personas.
