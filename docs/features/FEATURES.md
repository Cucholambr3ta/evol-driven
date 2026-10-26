# Features de evol-driven

> Ciclo 1 (ampliación 7, criterios CA-128 a CA-149): Evol-OS, seguridad, aislamiento y conexión con
> los agentes. Plan aprobado en `/home/cucholambreta/.claude/plans/ok-mientras-revisa-el-glimmering-puddle.md`.
> Ciclo 2 (ampliación 8, criterios CA-150 a CA-170): documentación atómica y con evidencia, al estilo
> de `evol-system` (Evol-DD) pero verificada. Está al final de este archivo.
> «La persona» es quien mantiene o usa evol.

## Adoptar un proyecto que no es TypeScript

Quien tiene un proyecto en Python o en shell puede ejecutar `evol init` y que las disciplinas
base (TDD, STDD) reconozcan sus propias pruebas, sin tener que fingir que el proyecto es
TypeScript ni remapear nada a mano.

Prioridad: alta

Criterios: CA-128, CA-129, CA-130, CA-131.

## Escribir con copia, ensayo y vuelta atrás

Quien ejecuta `evol agents` puede ver antes qué se va a escribir (`--dry-run`), y si algo sale mal
o no le convence, deshacerlo (`evol agents --deshacer`) sin perder lo que había editado después a
mano.

Prioridad: alta

Criterios: CA-132, CA-133.

## Rutas sensibles bloqueadas por defecto

Quien instala evol en un proyecto tiene, sin configurar nada, las credenciales del sistema
(`~/.ssh`, `.env`, claves, la clave del gate) fuera del alcance del agente, y sabe con claridad qué
sigue sin protección (leer con un script).

Prioridad: alta

Criterios: CA-134.

## Las reglas del proyecto por encima de las globales

Quien usa evol junto con otro framework de agentes instalado en su cuenta puede confiar en que,
dentro del proyecto, mandan las reglas de evol (idioma, commits, memoria, revisión), y ve en
`evol doctor` qué de lo global sigue ahí y si se pudo anular o solo avisar.

Prioridad: alta

Criterios: CA-135, CA-136.

## Evol como agente propio en OpenCode

Quien abre un proyecto con evol en OpenCode lo ve como un agente con nombre propio («Evol»), no
como un comando suelto, y ese agente tiene sus propios límites: no puede aprobar ni avanzar el
pipeline.

Prioridad: alta

Criterios: CA-137, CA-138, CA-139.

## Identidad propia en Claude Code

Quien abre un proyecto con evol en Claude Code ve un estilo y una línea de estado propios de evol
(la fase, lo pendiente), en vez del estilo de otro framework instalado globalmente.

Prioridad: alta

Criterios: CA-140, CA-141.

## Procedencia verificable de cada versión

Quien instala o actualiza evol puede comprobar qué contiene exactamente una versión (un listado de
componentes y las sumas de sus archivos) y que nada se alteró desde que se publicó, con una opción
explícita para saltarse el listado si hace falta.

Prioridad: media

Criterios: CA-142, CA-143, CA-144.

## Saber cuándo hay una versión nueva

Quien usa evol se entera, sin pedirlo, de que hay una versión nueva firmada y qué aprobaciones
perdería al actualizar, sin que eso le retrase el trabajo ni le envíe nada a ningún servidor.

Prioridad: media

Criterios: CA-145.

## Seguir trabajando en un segundo ciclo

Quien terminó un ciclo completo del pipeline (hasta retro) puede abrir el siguiente sin perder el
historial de aprobaciones del anterior, y solo una persona en su terminal puede abrirlo.

Prioridad: alta

Criterios: CA-146, CA-147.

## Instrucciones correctas según el repositorio

Quien trabaja en el propio repositorio de evol ve una instrucción que tiene sentido ahí («esto es
el framework: edítalo»), en vez de la instrucción genérica que evol da a los proyectos que lo usan
desde fuera.

Prioridad: baja

Criterios: CA-148.

---

# Ciclo 2: documentación atómica y con evidencia

> Origen: el método de `evol-system` (Evol-DD v0.6.3, en `/home/cucholambreta/Projects/evol-system`),
> leído en `.agent/workflows/doc-granular.md`, `evol-sprint.md` y `docs/DOC_STANDARD.md`: tras el
> briefing, un documento por subdominio dentro de una carpeta por dominio, con un índice de
> trazabilidad; las historias y los sprints con su propia memoria y lecciones; umbrales medibles de
> calidad. Y el modelo de dossier de investigación con índice de evidencia que ya usa la persona en
> `/home/cucholambreta/Projects/Evol-OS/investigacion/`.
>
> **Lo que este ciclo mejora respecto a evol-system:** allí los campos de fuentes y de trazabilidad
> existían en el esquema pero estaban vacíos en todos los archivos revisados. Aquí cada vínculo
> (documento ↔ índice, cita ↔ fuente, historia ↔ sprint) lo comprueba `evol` y el incumplimiento se
> ve en `evol verify`, no se queda como un campo sin llenar.
>
> **Decisiones de la persona (2026-10-25):** alcance completo y «así de granular»; `ADD` y las cuatro
> disciplinas nuevas (`GRANULAR`, `INVESTIGACION`, `REQDD`, `SPRINTDD`) entran en el perfil **base**,
> que pasa de 9 a 14 disciplinas. Los proyectos que ya existen no cambian, porque un perfil solo se
> aplica al crear o adoptar un proyecto con `evol new` o `evol init`; `lib` y `script` tampoco.
>
> **Supuestos (la persona los puede corregir):**
>
> 1. Los requisitos funcionales siguen en `SPEC.md` (sus criterios, con `evol coverage`); lo nuevo son
>    los no funcionales, las limitaciones conocidas y el glosario.
> 2. No se copian los JSON «gemelos» de cada `.md`: en evol-system no llevaban información propia, y la
>    trazabilidad la dan los índices y las comprobaciones.
> 3. Quedan fuera de este ciclo el orquestador autónomo de equipos de subagentes y el flujo GitFlow de
>    `/evol sprint`, porque son ejecución y no documentación.
> 4. `evol disciplines list --json` pasa a incluir el campo `rol` de cada disciplina (un campo más, sin
>    quitar ni renombrar ninguno), y `ADD` pasa de tipo «extendida» a «base».
> 5. Las verificaciones de las disciplinas pueden declarar un nivel de aviso (hoy siempre bloquean);
>    así los registros de decisiones sin «Referencias» avisan en vez de bloquear. Las que ya existen
>    siguen igual.
> 6. Las disciplinas nuevas llevan estos roles: `GRANULAR`, arquitecto; `INVESTIGACION`, `REQDD` y
>    `SPRINTDD`, analista.
> 7. `INVESTIGACION` nace con todos sus artefactos opcionales: valida un dossier cuando existe y no
>    obliga a investigar. La matriz de capacidades y el modelo de amenazas de un tema son opcionales.
> 8. `evol docs check` solo comprueba cada parte si existe su carpeta (`docs/proyecto/`,
>    `docs/requisitos/`, `docs/sprints/`, `investigacion/`); si no hay ninguna, termina bien diciendo
>    que no hay nada que comprobar.
> 9. Los umbrales nacen como aviso y modestos: un documento de dominio con menos de 15 líneas de
>    contenido (sin contar títulos ni la línea de origen) avisa; con `--estricto` falla.
> 10. Un sprint está **cerrado** cuando todas las tareas de los checklists de sus historias están
>     marcadas; solo entonces se exigen su memoria y sus lecciones. Mientras está abierto se van
>     escribiendo, pero no se exigen.
> 11. Las fechas de consulta de las fuentes son `AAAA-MM-DD` reales y no pueden ser futuras.
>
> **Formatos que los criterios dan por fijados:**
>
> - Documentos de dominio: `docs/proyecto/<dominio>/<subdominio>.md` con una línea `Origen: <ruta>` que
>   apunta a un archivo que existe, e índice `docs/proyecto/INDEX.md` con un enlace Markdown por
>   documento.
> - Dossier: `investigacion/<tema>/<tema>-audit.md`, `<tema>-evidence-index.md` (opcionales también
>   `-capability-matrix.md` y `-threat-model.md`); el índice es una tabla
>   `ID | Fuente | Consultada | Clasificación | Afirma`, con ID `E-n`, fecha y clasificación en
>   hecho, supuesto o contradicción; las citas del dossier se escriben `[E-n]`.
> - Requisitos: `docs/requisitos/NO_FUNCIONALES.md` (tabla `ID | Requisito | Métrica | Umbral |
Validación`), `RESTRICCIONES.md` (sección «Limitaciones conocidas» con `### Ln` y las líneas
>   `Razón:`, `Impacto:` y `Roadmap:`) y `GLOSARIO.md` (un `### Término` por término).
> - ADR: `docs/adr/NNNN-titulo.md` con las secciones Contexto, Opciones, Decisión, Consecuencias y
>   Referencias.
> - Historias y sprints: `docs/sprints/INDEX.json` (`{ "sprints": [{ "id", "titulo", "historias" }] }`),
>   `docs/historias/HU-n/` con `propuesta.md`, `requisitos-escenarios.md`, `escenario-tecnico.md` y
>   `checklist-tareas.md` (tareas `- [ ]` y `- [x]`), y por sprint `docs/sprints/<id>/memoria.md` y
>   `lecciones.md`.

## Documentación atómica por dominio

Quien termina el spec de un proyecto puede partirlo en una carpeta por dominio técnico (`db`, `api`,
`auth`…) con un documento por subdominio, cada uno legible por separado por un agente que lo
implemente, y un índice que los une. `evol docs check` comprueba que el índice y los documentos
coinciden en las dos direcciones y que cada documento dice de dónde sale.

Prioridad: alta

Criterios: CA-150, CA-151, CA-152, CA-153.

## Adoptar la exigencia poco a poco

Quien ya usa evol en un proyecto no ve sus fases bloqueadas de golpe por una exigencia nueva de
documentación: las comprobaciones de calidad nuevas empiezan como aviso, y la persona puede pedir
que bloqueen (`--estricto`); un aviso no impide aprobar la fase. Un proyecto nuevo con el perfil
base sí nace con las disciplinas nuevas; los perfiles `lib` y `script` y los proyectos creados antes
no cambian.

Prioridad: alta

Criterios: CA-154, CA-155, CA-156.

## Dossier de investigación con índice de evidencia

Quien pide investigar algo (una herramienta, un competidor, un enfoque) obtiene una carpeta por tema
con su auditoría (y, si hace falta, su matriz de capacidades y su modelo de amenazas) y, sobre todo,
un índice de evidencia: cada fuente con su
fecha de consulta y si lo que aporta es un hecho, un supuesto o una contradicción. Cada cita del
dossier se puede rastrear hasta una fuente del índice.

Prioridad: alta

Criterios: CA-157, CA-158, CA-159, CA-160.

## Requisitos no funcionales, limitaciones y glosario

Quien especifica un proyecto escribe los requisitos no funcionales con su métrica, su umbral y cómo
se comprueba; las limitaciones que se aceptan a sabiendas con su razón, su impacto y cuándo se
revisan (aparte de las amenazas de seguridad); y un glosario sin términos repetidos.

Prioridad: media

Criterios: CA-161, CA-162, CA-163, CA-164.

## Decisiones de arquitectura con sus referencias

Quien escribe una decisión de arquitectura (ADD, ahora en el perfil base) ve avisados los registros
que no dicen qué opciones se descartaron y qué consecuencias tienen, o que no enlazan la decisión con
el código y las pruebas que la sostienen («Referencias»). Son avisos: no bloquean la fase.

Prioridad: media

Criterios: CA-165, CA-166.

## Historias y sprints con su propia evidencia

Quien parte el desarrollo en sprints tiene, por cada historia, su propuesta, sus escenarios, su
escenario técnico y un checklist de tareas atómicas; y, por cada sprint, su memoria y sus lecciones,
que se van escribiendo mientras se trabaja y quedan como evidencia para revisar después.
`evol sprint estado` dice cuánto va cada uno y `evol sprint check` avisa de lo que falta.

Prioridad: media

Criterios: CA-167, CA-168, CA-169, CA-170.
