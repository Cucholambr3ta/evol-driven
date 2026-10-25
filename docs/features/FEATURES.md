# Features de evol-driven

> Ola 1 (ampliación 7, criterios CA-128 a CA-148): Evol-OS, seguridad, aislamiento y conexión con
> los agentes. Plan aprobado en `/home/cucholambreta/.claude/plans/ok-mientras-revisa-el-glimmering-puddle.md`.
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
