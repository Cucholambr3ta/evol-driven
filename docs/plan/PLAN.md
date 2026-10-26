# Plan de implementación — Ciclo 2 (ampliación 8, CA-150 a CA-170)

> Desarrolla `docs/specs/SPEC.md`, `docs/specs/DOMAIN.md` y `docs/specs/THREATS.md` (secciones «Ciclo
> 2»). Traduce el plan aprobado por la persona
> (`/home/cucholambreta/.claude/plans/ok-mientras-revisa-el-glimmering-puddle.md`, «Paso 4») a pasos
> de construcción concretos y en orden. El plan del ciclo 1 queda en el historial de git y en
> `docs/ESPECIFICACION.md` («Ampliación 7»).

## Orden de construcción

Cada módulo: rojo (la prueba de aceptación o la unitaria falla por la razón correcta) → verde →
refactor, `npm run ci` en verde y un commit. El orden evita dejar la CI en rojo: primero los
comprobadores y los comandos, que no tocan el registro de disciplinas; el registro y las plantillas
al final, ya validados por los comprobadores reales. Las plantillas y `writeValidArtifacts` de las
pruebas se escriben cuando hay comprobadores con los que probarlas.

### Reglas comunes de los comprobadores (`src/docs/`)

Las fija `docs/specs/SPEC.md` («Reglas de lectura comunes», 1 a 7) y las cumplen todos los
comprobadores a través de **una sola capa de lectura**, `src/docs/lectura.ts`, que ningún otro
archivo de `src/docs/` esquiva:

- `resolverRuta(raiz, texto)`: comprobación léxica, luego `realpath` del ancestro existente dentro de
  la raíz; un único resultado para «fuera de la raíz», «no existe» y «no se puede resolver».
- `leerDocumento(ruta)`: abre sin seguir el enlace final, `fstat` sobre el descriptor, solo archivos
  regulares, lectura con tope + 1 byte, UTF-8 con reemplazo; los errores de E/S son hallazgos.
- `Topes` (1 MiB por archivo, 500 archivos y 5 MiB por parte, profundidad 6) y el recorrido de
  carpetas sin seguir enlaces simbólicos.
- `nombreSeguro(texto)`: sanea (control, ANSI, saltos de línea, bidi) y trunca a 80 caracteres; todo
  mensaje y todo `--json` construyen sus nombres solo con esta función, y un identificador que no
  cumple su patrón sale como «identificador no válido en la línea N».
- `src/docs/markdown.ts`: `normalizar()` (NFD, sin tildes ni mayúsculas, sin numeración ni `:`
  final), analizadores línea a línea que ignoran los bloques de código.
- Fechas (`AAAA-MM-DD` reales, futura solo si supera la fecha local y la UTC, `hoy` inyectable),
  `MIN_LINEAS = 15` exportada, y los mensajes sin la palabra «desconocido/a».
- Por módulo: `evol docs check` recorre `config.modules` como `coverageReport`
  (`src/core/coverage.ts:122-126`) y `verifyPhase` (`src/core/pipeline.ts:94`); el `CA-n` de un
  `Origen:` se busca en el SPEC de `resolveDiscipline(SDD)`.
- Cada comprobador que crea un control escribe en su mismo módulo la prueba de seguridad del
  ciclo (T-14 a T-20): `tests/security/docs-{rutas,limites,indice-json,no-cita}.security.test.ts` y
  `aprobacion-fija-evidencia.security.test.ts`, con el cambio entre comprobar y leer inyectado de
  forma determinista y una entrada patológica con tiempo máximo.

### M0. Arreglos independientes: `m-005` y el campo `rol` del listado

- `src/core/status.ts:48`: la rama «obsoleta» cuenta solo `action === "approved"` del ciclo actual
  (`(e.ciclo ?? 1) === ctx.state.ciclo`); al abrir un ciclo la fase dice «pendiente». Prueba en
  `tests/status.test.ts`; `evol mejora hecha m-005`.
- `src/commands/disciplines.ts` `list` (l.56-64): `rol: d.rol` en el JSON; el campo ya es
  obligatorio en el esquema (`src/core/disciplines.ts:57`).

### M1. Markdown y verificación por secciones

- `src/docs/markdown.ts`: `normalizar`, `secciones(md, nivel)`, `tablas(md)`, `enlaces(md)`.
- `src/core/disciplines.ts`: variante `secciones: { patron, nivel?, secciones: [{ nombre, motivo? }] }`
  (el `nivel` solo existe aquí); `resolveDiscipline` y `artifactPaths` la remapean como un
  artefacto. `src/core/verify.ts`: implementación con `matchFiles`, el hallazgo lleva `v.nivel`, y el
  `switch` de `verifyDiscipline` gana un `default` exhaustivo. `src/core/orchestration.ts:123-137`:
  la describe.

### M2. Comprobadores y comandos (sin tocar el registro)

Tres commits: a) documentos de dominio y requisitos, b) dossier, c) sprints.

- `src/docs/lectura.ts` (primero, con sus pruebas de seguridad T-14, T-15 y T-20), `src/docs/check.ts`
  (`DocFinding { archivo, mensaje, nivel }`, `comprobarDocs`), `granular.ts`,
  `requisitos.ts`, `evidencia.ts`, `sprints.ts`.
- `src/commands/docs.ts` (`check [--estricto] [--json]`, `evidencia [--json]`) y
  `src/commands/sprint.ts` (`check`, `estado`), con `USAGE` y alta en `src/cli.ts`. Salida
  `  × archivo: mensaje` / `  ! archivo: mensaje (aviso)`; sale con 1 si hay bloqueos (o avisos con
  `--estricto`); sin subcomando, error con el uso.
- Variante de verificación `documentos: { comprobacion }` **sin** `nivel` (cada hallazgo trae el
  suyo); nace junto a su primer comprobador, nunca vacía.

### M3. Las cinco disciplinas de base: registro, perfiles, plantillas y cifras

- `disciplines/{GRANULAR,INVESTIGACION,REQDD,SPRINTDD}.json` (cada una con su verificación
  `documentos`; `REQDD` con tres artefactos separados; `SPRINTDD` transversal desde `plan`;
  `INVESTIGACION` con todo opcional) y `ADD.json` a `tipo: base` con la verificación `secciones` en
  nivel de aviso. Los artefactos opcionales de lecciones, memoria y documentos del dossier entran en
  la huella de la aprobación.
- `src/core/disciplines.ts` `validateModuleOverrides`: rechaza remapear las rutas de una disciplina
  con verificación `documentos` (L1).
- `src/core/profiles.ts`: `BASE_DISCIPLINES` pasa a 14; `lib` y `script` no cambian.
- `INVESTIGACION` es la única disciplina con todo opcional: las pruebas genéricas de
  `tests/disciplines.test.ts` (:49 y :67) la excluyen con una lista fijada por otra prueba y le
  aplican «vacío pasa» y «falla con un artefacto inválido».
- `tests/helpers.ts` `writeValidArtifacts` (con un mapa de archivos auxiliares por disciplina) y
  `templates/project/` (ADR completo, documento de dominio de 15 líneas con `Origen:` válido,
  requisitos con un NFR, una limitación y un término, sprints e historia sin marcar); el reemplazo
  ciego de `[[COMPLETAR]]` de `tests/e2e.test.ts` nunca toca `Origen:`, enlaces, IDs, fechas ni
  claves JSON; `!templates/project/docs` en `.prettierignore`.
- Skills de rol: GRANULAR en `skills/arquitecto/SKILL.md`; INVESTIGACION, REQDD y SPRINTDD en
  `skills/analista/SKILL.md`, sin tocar su `description`.
- Cifras 31 → 35 (14 base, 21 extendidas; roles 7, 10, 4, 5, 5, 4) en las pruebas, `README.md` y
  `docs/ESPECIFICACION.md`.

### M4. Las cuatro skills nuevas y `add` enriquecida

- `skills/{granular,investigacion,reqdd,sprintdd}/` con `SKILL.md`, `evals/casos.yaml` y
  `evals/promptfooconfig.yaml`; alta en `skills/manifest.json`. Los enrutadores de la segunda ola
  quedan como foto de sus 60 skills (para no cambiar la huella de 37 skills ya aprobadas); las nuevas
  forman una tercera ola con enrutador de 64.
- `skills/add/SKILL.md`: «Referencias» y mitigaciones, sin tocar su `description`.

### M5. Cierre

- `README.md` con los comandos nuevos y sus límites; `evol coverage` sin huecos; `npm run ci` en
  verde. Se comprueba qué persisten `evol checkpoint` y `evol handoff` (privacidad del ciclo 2).
- No hay herramienta del MCP para estos comandos (limitación L4 de la spec).

## Cobertura: criterio → módulo

| Criterio                       | Módulo          | Prueba que pasa a verde                                        |
| ------------------------------ | --------------- | -------------------------------------------------------------- |
| CA-150, CA-151, CA-152, CA-154 | M2a             | `tests/acceptance/documentacion-atomica…`, `adopcion-gradual…` |
| CA-161, CA-162, CA-163         | M2a             | `tests/acceptance/requisitos-atomicos…`                        |
| CA-157, CA-158, CA-159         | M2b             | `tests/acceptance/dossier-investigacion…`                      |
| CA-167, CA-168, CA-169         | M2c             | `tests/acceptance/historias-sprints…`                          |
| CA-153, CA-164, CA-170, CA-160 | M0 (`rol`) y M3 | los cuatro de «figura con el rol» y el BLOCK/PASS de CA-160    |
| CA-155, CA-165, CA-166         | M1 y M3         | `tests/acceptance/adr-con-referencias…`, `adopcion-gradual…`   |
| CA-156                         | M3              | `tests/acceptance/adopcion-gradual…`                           |

## Riesgos y plan B

- **El perfil base pasa de 9 a 14 y la plantilla debe pasar los comprobadores**: la e2e
  (`tests/e2e.test.ts`, seis fases sobre `evol new`) es la red de seguridad. Plan B: si una
  plantilla no se puede mantener válida tras completar sus marcadores, esa parte entra como aviso.
- **Cifras repartidas en muchos archivos** (31, 22 extendidas, reparto por rol, cuentas de skills):
  se cambian todas en M3 y la CI las verifica; un olvido se ve como una prueba en rojo, no pasa en
  silencio.
- **Skills que cambian de huella** (`analista`, `arquitecto`, `add`): vuelven a «sin aprobar» al
  actualizar; se avisa en el changelog y en la retro.
- **Comprobadores lentos o frágiles con documentos reales**: límite de tamaño, analizadores lineales
  y prueba con el árbol de `docs/` de este repositorio como entrada real.

## Qué se recortaría si falta la mitad del tiempo

`evol sprint` (M2c) pasa a un ciclo posterior; M0, M1, M2a, M2b y M3 son el núcleo.

## Verificación de punta a punta

- Por módulo: la prueba de aceptación pasa de rojo a verde, las unitarias nuevas pasan y
  `npm run ci` queda en verde.
- `evol new demo`: su `evol.config.json` trae 14 disciplinas; con los marcadores completados recorre
  las seis fases con aprobación humana en cada una.
- Comandos a mano: un árbol con un documento huérfano y un enlace roto, un dossier con una cita
  huérfana y un sprint cerrado sin lecciones; cada comando nombra exactamente lo que falla.
- Diferencial: en una copia de la versión anterior (`mktemp -d`), `evol verify` sobre un proyecto
  existente de 9 disciplinas da el mismo veredicto; `evol disciplines list --json` solo gana `rol`,
  `ADD.tipo` y cuatro filas.
- Evol-OS (en una copia): tras `evol update` sigue con sus 9 disciplinas; con
  `evol disciplines enable GRANULAR …` aparecen las exigencias nuevas.

## Interrogado

> Interrogación de `interrogar-plan`, 2026-10-26. Además de releer este plan contra
> `docs/specs/*` y el código, antes de escribirlo se interrogó el plan aprobado con un agente de
> diseño independiente que no lo había redactado; sus hallazgos ya están incorporados arriba.

### Cobertura

- Cada criterio CA-150 a CA-170 tiene un módulo (tabla de arriba) y las 6 features de
  `docs/features/FEATURES.md` se corresponden con M2, M3 y M4. `evol coverage` ya confirmó escenario
  y prueba por cada criterio en la fase spec.

### Supuestos

- Los formatos y los umbrales (15 líneas, 1 MiB) son supuestos de `FEATURES.md` y de `SPEC.md`; si
  la persona los cambia, se cambian en una constante y en las pruebas.
- `INVESTIGACION` con todo opcional rompe dos pruebas genéricas; está previsto y fijado en M3.

### Orden y dependencias

- La revisión independiente encontró que el orden anterior (registro antes que comprobadores) dejaba
  la CI en rojo en el primer módulo; se reordenó como arriba. M3 depende de M1 (nivel de aviso) y
  de M2 (el registro cita los comprobadores); M4 depende de que los formatos de M2 y M3 estén
  cerrados.

### Riesgos

- Ver «Riesgos y plan B». El mayor es la plantilla de `evol new` bajo el reemplazo ciego de
  marcadores de la e2e, con reglas escritas en M3.

### Seguridad

- Las amenazas T-14 a T-20 de `THREATS.md` tienen su control en la capa de lectura y en los
  comprobadores, y su prueba de seguridad se escribe en el módulo que crea el control (STDD, en
  build). La revisión independiente del rol `seguridad` (2026-10-26) encontró seis puntos que
  bloqueaban aprobar el spec (mensajes que citaban nombres sin sanear, T-14 mal planteada, MCP sin
  contrato, T-17, T-15 y T-18 incompletas); están corregidos en la spec y aquí.

### Reversibilidad

- Todo es aditivo salvo el perfil base y el tipo de `ADD`. Revertir es quitar las cinco
  disciplinas de `BASE_DISCIPLINES`; los proyectos ya creados no se ven afectados.

### Recorte

- Ver «Qué se recortaría si falta la mitad del tiempo».

### Resumen

- El plan es ejecutable en el orden dado y la CI queda en verde tras cada módulo; las tres decisiones
  que más pesan (perfil base, comprobadores sin remapeo de rutas, enrutadores de skills congelados)
  están justificadas arriba.
