# Plan de implementación — Ola 1 (ampliación 7, CA-128 a CA-149)

> Desarrolla `docs/specs/SPEC.md`, `docs/specs/DOMAIN.md` y `docs/specs/THREATS.md`. Traduce el
> plan aprobado por la persona (`/home/cucholambreta/.claude/plans/ok-mientras-revisa-el-glimmering-puddle.md`,
> sección «Ola 1») a pasos de construcción concretos, en orden.

## Paso 0: resolver los supuestos «por confirmar» antes de M3, M4, M5 y M6

`docs/specs/SPEC.md`, sección Supuestos, deja dos cosas sin comprobar de las que dependen varios
criterios:

1. Que un `outputStyle`/`agent` de proyecto prevalece sobre el del usuario en Claude Code y
   OpenCode (CA-135, CA-137, CA-140).
2. Que `permissions.deny` de un proyecto sigue aplicándose aunque el `defaultMode` **global** sea
   `bypassPermissions` (de lo que dependen T-1 y T-3 de `docs/specs/THREATS.md` — y T-1/T-3 son,
   literalmente, las mitigaciones de **CA-134**, no solo de CA-135/136: la clasificación «impuesta»
   de las 9 reglas de bloqueo de M3 depende de este segundo supuesto exactamente igual que M4-M6).

**Antes de escribir código de M3 a M6**, un ensayo real y corto, documentado en
`docs/design/consultas/` (como ya hace el repositorio con otras consultas a IDEs reales):

- un proyecto de prueba con `.claude/settings.json` que fija `outputStyle` y `permissions.deny`, y
  un `~/.claude/settings.json` de usuario con `outputStyle` distinto y `bypassPermissions`;
- abrir Claude Code en ese proyecto y comprobar, a mano, qué estilo queda activo y si una regla
  `deny` del proyecto bloquea algo que `bypassPermissions` global dejaría pasar;
- lo mismo en OpenCode con `default_agent` y `permission`.

Si el resultado confirma el supuesto, M3-M6 siguen como están. Si lo desmiente, los criterios
**CA-134** (clasificación «impuesta» de las reglas de bloqueo, no solo CA-135/CA-136) y
CA-137/CA-140 (prevalencia del agente/estilo) se marcan en el propio `evol doctor` como «a
verificar» en vez de «impuesta»/confirmado, y se avisa en la retro para decidir si entra en esta
ola o se recorta a la 0.4.1. M3 se sigue construyendo igual (las reglas se instalan de todos
modos): lo único que cambia es la etiqueta que `evol doctor` les pone.

## Orden de construcción

1. **M1 — proyectos que no son TypeScript** (CA-128 a CA-131). Sin dependencias de los demás.
   - `src/core/stacks.ts` (nuevo): `STACKS` (`ts|python|shell|generico`).
   - `src/core/adopt.ts`: `detectLayout` reconoce `pyproject.toml`/`requirements*.txt`/`*.sh`.
   - `src/core/disciplines.ts` (`resolveDiscipline`, ya existe): sin cambios, solo lo usa `stacks.ts`.
   - `src/core/coverage.ts` (`parseTestTitles`): añade los patrones de pytest y bats.
   - `src/core/profiles.ts`: perfil `script`.
   - `src/commands/init.ts`: opción `--lenguaje`.

2. **M2 — copia, ensayo y vuelta atrás** (CA-132, CA-133). Depende de M1 solo en que ambos tocan
   `init`/`agents`, pero no hay dependencia de datos entre ellos; puede ir en paralelo con M1.
   **Va antes que M3 a M6**, porque M3 a M6 escriben archivos de agentes y deben pasar por el mismo
   camino de copia.
   - `src/agents/backup.ts` (nuevo): `.evol/respaldos/<ts>/manifest.json`, con el patrón atómico de
     `src/core/checkpoint.ts` (`writeCheckpoint`).
   - `src/agents/files.ts`: separa `writeAgentFiles` en `planAgentFiles()`/`applyPlan()`.
   - `src/commands/agents.ts`: `--dry-run`, `--deshacer [id]`.
   - `src/commands/init.ts`: `.evol/respaldos/` a `.gitignore`.

3. **M3 — lista de bloqueo de rutas sensibles** (CA-134). Depende del Paso 0 (clasificación
   «impuesta»/«a verificar») y de M2 (usa `planAgentFiles`).
   - `src/agents/files.ts`: `DENY_RULES` (hoy 3 entradas) gana las 9 de CA-134.
   - `src/core/gate.ts`/`src/commands/doctor.ts`: comparación de `state.currentPhase` contra
     `verifyChain`/`findValidApproval`. **M9 cambia `findValidApproval`** (añade el filtro por
     ciclo): si M9 se construye antes que M3, la prueba de M3 ya debe ejercitar esa función con la
     firma final; si M3 va primero, revisar al construir M9 que su cambio no rompe lo que M3 ya
     probó.
   - `src/agents/adapters.ts`: mismas reglas para OpenCode (fragmento, hasta M5).

4. **M4 — aislar el proyecto y diagnosticar la convivencia** (CA-135, CA-136, CA-149). Depende del
   Paso 0 y de M2 (usa `planAgentFiles`/`applyPlan`). CA-149 (MCP) es nuevo desde spec: añade a
   `evol doctor` la lectura de `mcp.servers` tanto de `opencode.json` (global y del proyecto) como
   de `.mcp.json`/`.claude/settings.json` de Claude Code (global y del proyecto) — CA-149 no se
   limita a un IDE, y esta ola da a evol identidad propia en ambos (M5, M6).
   - `src/agents/convivencia.ts` (nuevo): `detectGlobalAgents(home)`.
   - `src/agents/files.ts`: sección «Reglas de este proyecto» en `CLAUDE.md`/`AGENTS.md`, bloque
     `env` en `.claude/settings.json`.
   - `src/core/config.ts`: `ConfigSchema` gana `agentes: {aislar, commits, atribucion}` (opcional).
   - `src/commands/doctor.ts`: sección «Convivencia» (hooks, `bypassPermissions`, MCP remotos,
     impuesta/declarativa).
   - `src/skills/audit.ts` (`auditSkill`, reutilizada, sin cambios): pasada determinista sobre una
     copia temporal de las instrucciones ajenas detectadas.

5. **M5 — agente «Evol» en OpenCode** (CA-137 a CA-139). Depende del Paso 0, M2 y M3 (reglas de
   bloqueo) y M4 (permisos del agente deniegan lo mismo que M3 en general).
   - `src/agents/adapters.ts`: el adaptador OpenCode escribe `opencode.json` del proyecto
     (`agent.evol`, `default_agent`, `permission`, `mcp.evol`), con `readJson`/`formatJson` de
     `src/agents/files.ts`.
   - `.evol/propiedad.json` (nuevo): `default_agent` anterior, para `--deshacer`.

6. **M6 — identidad «Evol» en Claude Code** (CA-140, CA-141). Depende del Paso 0 y M2.
   - `.claude/output-styles/evol.md` (plantilla nueva).
   - `src/agents/files.ts`: `outputStyle`, `statusLine`, `permissions.defaultMode` en
     `.claude/settings.json` del proyecto.
   - `src/commands/status.ts` (nuevo): `evol status --linea`.

7. **M7 — SBOM y sumas firmadas** (CA-142 a CA-144). Sin dependencia de M1-M6; puede ir en paralelo.
   - `src/release/release.ts`: `release/SUMAS.txt`, `release/sbom.spdx.json` (reutiliza el núcleo de
     `runSyft`, `src/security/runners-infra.ts:219`, con ruta de salida), `SUMAS.txt.sig`.
   - `src/release/update.ts`: `verifyTag` (ya existe) más la verificación de sumas antes de
     compilar.

8. **M8 — aviso de versión nueva** (CA-145). Depende de M7 (solo cuentan etiquetas con SBOM/sumas
   firmadas) y de que exista el registro de skills aprobadas (`src/skills/manifest.ts`, ya existe)
   para nombrar las que perderían aprobación.
   - `src/commands/doctor.ts` y `src/commands/hook.ts`: `inspectUpdate` (ya existe) con caché diaria
     en `~/.config/evol/aviso-version.json`.
   - `src/core/config.ts`: `actualizaciones.aviso`.

9. **M9 — ciclo siguiente** (CA-146, CA-147). Sin dependencia de M1-M8 (toca pipeline/gate/state, no
   agentes ni release). **Debe estar terminado antes de cerrar la ola**, porque sin él la ola 2 no
   puede abrir su propio ciclo.
   - `src/core/state.ts`: `StateSchema` gana `ciclo`/`ciclos[]`.
   - `src/core/gate.ts`: `GateEntry` gana `ciclo?` opcional (no rompe `canonicalPayload` existente);
     `findValidApproval` ignora lo anterior al ciclo.
   - `src/commands/ciclo.ts` (nuevo): `evol ciclo nuevo`, con el mismo patrón de confirmación de
     terminal que `src/commands/approve.ts`.
   - `src/mcp.ts`: sin cambios (no se añade ninguna herramienta de ciclo).

10. **M10 — instrucciones según el repo** (CA-148). Depende de M5/M6 solo en que toca los mismos
    archivos generados, pero es independiente en lógica. Va último porque es el de menor prioridad.
    - `src/agents/files.ts` (`claudeBlock`) y `src/agents/adapters.ts` (`instructionsBlock`):
      detectan `package.json.name === "evol-driven"` y `.git` presente.

## Cobertura: criterio → mejora

| Criterio                       | M   |
| ------------------------------ | --- |
| CA-128, CA-129, CA-130, CA-131 | M1  |
| CA-132, CA-133                 | M2  |
| CA-134                         | M3  |
| CA-135, CA-136, CA-149         | M4  |
| CA-137, CA-138, CA-139         | M5  |
| CA-140, CA-141                 | M6  |
| CA-142, CA-143, CA-144         | M7  |
| CA-145                         | M8  |
| CA-146, CA-147                 | M9  |
| CA-148                         | M10 |

Los 22 criterios tienen M asignado: ninguno queda sin construir en esta ola.

## Riesgos y plan B

| Riesgo                                                                                                        | Plan B                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La ola 1 es grande (10 mejoras, 22 criterios)                                                                 | Si el avance se atasca, M6, M8 y M10 se recortan a una 0.4.1 sin romper dependencias (ninguna otra mejora depende de ellas)                                                                                                                      |
| `TDD: npm run ci` es lento (pty, semgrep) y el semgrep intermitente puede bloquear aprobaciones               | Reintentos ya existentes en `runSemgrep` (`src/skills/tools.ts`); si bloquea una aprobación real, se diagnostica con el log de `EVOL_DIAGNOSTICS_DIR` antes de reintentar, no se ignora el fallo                                                 |
| El supuesto del Paso 0 (outputStyle/agent, permissions.deny bajo bypassPermissions) se desmiente              | T-1/T-3 de THREATS.md se degradan a «a verificar»; **CA-134**, CA-135/137/140 se construyen igual pero `evol doctor` deja de afirmar «impuesta» sin comprobarlo; se decide en la retro si entra en esta ola                                      |
| El escenario de `evol ciclo nuevo` (M9) depende del comando `script` para simular una terminal en las pruebas | Mismo convenio que `tests/e2e.test.ts`: se acepta porque ya es la práctica del repositorio; si el entorno de CI real no tiene `script`, esas pruebas quedan sin ejecutar (riesgo ya señalado en la revisión del briefing, no nuevo de este plan) |
| T-9 y T-13 (riesgos aceptados de THREATS.md) caducan y nadie los revisa a tiempo                              | T-9 caduca el 2026-12-31, antes de construir la ola 2; se añade a la retro de esta ola como recordatorio explícito                                                                                                                               |

## Qué se recortaría si falta la mitad del tiempo

Por este orden: M10 (menor prioridad, cosmético), M8 (aviso de versión nueva: útil pero no
bloqueante para nada más), M6 (identidad en Claude Code: M5 ya cubre el valor equivalente en
OpenCode). M1 a M5, M7 y M9 no se recortan: M1 es lo que motivó la ola (Evol-OS), M2 a M5 son
seguridad y aislamiento explícitamente pedidos por la persona, M7 es procedencia de versiones y M9
es necesario para seguir con la ola 2.

## Verificación de punta a punta

Además de lo que ya describe «Cómo se ejecuta» del plan de la persona (una rama por ola, `evol
verify` en PASS en cada fase, `npm run ci`, `evol security scan`, `evol coverage`, aprobación y
avance en terminal):

- **Antes de publicar la primera versión con M7** (SBOM y sumas), además de que pasen las pruebas
  automatizadas (`tests/acceptance/procedencia-version.acceptance.test.ts`,
  `tests/release.test.ts`, `tests/update.test.ts`), instalar esa etiqueta de verdad desde una
  máquina de prueba con `evol update --repositorio <el propio origen>` y comprobar que la
  instalación real la acepta. Un error en el primer `release/SUMAS.txt` real (no simulado en una
  prueba) que deje toda la cadena de actualización rota no es reversible una vez que alguien la
  instaló.
- Tras M4, repetir en un proyecto real (no un fixture de prueba) el ensayo del Paso 0, ya con el
  código construido, para confirmar que lo que `evol doctor` clasifica como «impuesta» lo es de
  verdad en la máquina de la persona (la que tiene gentle-ai, antes de que se retire del todo).
- Tras M9, en una copia de este mismo repositorio, ejecutar `evol ciclo nuevo` real y comprobar que
  `evol status`/`evol prerequisites` del ciclo nuevo no arrastran nada del ciclo anterior.

## Interrogado

> Interrogación de `interrogar-plan`, fecha 2026-10-25. La persona que escribió este plan es quien
> lo interroga a continuación, con la distancia de releerlo contra `docs/specs/*` y el código real
> en vez de contra su propia memoria de haberlo escrito; cada hallazgo cita archivo y línea, no una
> impresión general.

### Cobertura

- Cada criterio CA-128..CA-149 tiene un M (tabla de arriba); cada feature de
  `docs/features/FEATURES.md` corresponde a uno o más de esos CA-n, ya enlazados en la propia
  spec. No hay feature huérfana: las 10 de FEATURES.md se corresponden una a una con M1-M10 más
  CA-149 dentro de M4.
- `evol coverage` (ejecutado en la fase spec) ya confirmó escenario y prueba por cada criterio; este
  plan no repite esa comprobación, solo el reparto en pasos de construcción.

### Supuestos

- **Comprobado** (en spec, por la revisión del rol `seguridad` y del rol `verificador`): que los
  criterios citan correctamente sus disciplinas y pruebas; que el ámbito de T-9/T-13 es
  proporcional.
- **Por comprobar** (Paso 0, explícito arriba): precedencia de `outputStyle`/`agent` y de
  `permissions.deny` bajo `bypassPermissions` global. Es el supuesto más importante del plan porque
  3 de los 10 M dependen de él (M4, M5, M6) y una de las dos motivaciones centrales de la ola
  (aislarse de gentle-ai) depende de que sea cierto.
- **Por comprobar, menor**: que `evol-driven` puede detectarse a sí mismo de forma fiable con
  `package.json.name === "evol-driven"` (M10, CA-148): un fork o una copia renombrada rompería la
  detección, pero el impacto de equivocarse es bajo (un texto de instrucción, no una protección de
  seguridad), así que no se trata como supuesto crítico.

### Orden y dependencias

- Verificado paso a paso en la sección «Orden de construcción»: M2 antes de M3-M6 (comparten el
  camino de escritura), Paso 0 antes de M3-M6 (clasificación de las reglas de bloqueo y de la
  convivencia), M3/M4 antes de M5 (comparten reglas de bloqueo), M7 antes de M8 (el aviso exige
  SBOM/sumas), M9 sin dependencias previas pero obligatorio antes de cerrar la ola.
- No encontrado ningún paso que dependa de algo que otro paso **posterior** crea (ningún ciclo).
- Sí encontrado, en la segunda interrogación, el caso inverso: un paso posterior (M9) que modifica
  una función (`findValidApproval`) de la que un paso anterior (M3) ya depende. No es un ciclo ni
  bloquea el plan, pero queda anotado en M3 como advertencia de construcción, porque la
  interrogación original solo miraba dependencias hacia adelante, no modificaciones hacia atrás.

### Riesgos

- Los tres riesgos ya señalados por la persona (tamaño de la ola, `npm run ci` lento, semgrep
  intermitente) tienen plan B explícito en la tabla de arriba, igual que el supuesto del Paso 0 y
  el riesgo de `script` en CI, que no eran nuevos de este plan sino ya señalados en el briefing.
- **Lo que impide aprobar**: ninguno de los riesgos identificados carece de plan B o de dueño; no
  hay bloqueo encontrado en esta sección.

### Seguridad

- `docs/specs/THREATS.md` ya cubre la superficie de esta ola con 13 amenazas y sus mitigaciones,
  revisado por el rol `seguridad`. Este plan no añade superficie nueva que THREATS.md no contemple.
  No es un mapeo uno a uno de los 10 M (una revisión más detallada lo corrigió): M1 no tiene
  amenaza asociada porque no añade superficie de riesgo (correcto, no es un hueco), y M6 tampoco
  aparece citado en ninguna mitigación (T-5 cubre el agente «evol» solo para CA-134/CA-139, no para
  el estilo o la línea de estado de CA-140/141) — ninguno de los dos es un hallazgo de seguridad en
  sí, porque ni M1 ni la identidad visual de M6 manejan datos sensibles ni permisos, pero la
  afirmación de «uno a uno» era inexacta y se corrige aquí.
- No se incorpora ninguna dependencia nueva en esta ola (M1-M10 usan solo Node, `node:fs`,
  `node:crypto`, `ssh-keygen` ya usado por `release.ts`, y herramientas de seguridad ya instaladas
  por `evol setup`); no aplica `incorporar-dependencia`.

### Reversibilidad

- M2 (copia y vuelta atrás) es, precisamente, lo que hace reversible la escritura de M3 a M6: si
  algo de esas mejoras sale mal a medio construir, `evol agents --deshacer` recupera el estado
  anterior del proyecto en desarrollo (no solo de un proyecto de prueba).
- M9 (ciclo nuevo) es, por diseño, no reversible hacia atrás (abrir un ciclo no se deshace,
  CA-146/CA-147): correcto, porque revertirlo invalidaría el propósito de separar las aprobaciones
  por ciclo; queda anotado como decisión consciente, no como hueco.
- Para M7 (SBOM y sumas), un error en la primera versión publicada con esta mejora (0.4.0 en
  adelante) no es reversible una vez que alguien instaló esa etiqueta: **lo que impide aprobar**
  hasta que quede dicho en el propio plan: antes de publicar la primera versión con M7, ejecutar
  `evol update` contra esa etiqueta desde una máquina de prueba (no solo los tests automatizados)
  para confirmar que una instalación real la acepta, no solo que las pruebas pasan. Añadido como
  paso explícito en «Verificación de punta a punta» de esta ola.

### Recorte

- Ya resuelto arriba («Qué se recortaría si falta la mitad del tiempo»): M10, M8, M6, en ese orden,
  sin romper ninguna dependencia de los M restantes.

### Resumen (primera pasada)

**Lo que impide aprobar:** un único hallazgo, ya corregido en este mismo documento (sección
Reversibilidad, M7): falta un paso de instalación real antes de publicar la primera versión con
SBOM y sumas, más allá de las pruebas automatizadas. Con ese paso añadido a «Verificación de
punta a punta», no queda nada pendiente de esta interrogación.

**Lo que mejora el plan:** ninguno adicional a lo ya incorporado en «Riesgos» y «Supuestos».

## Segunda interrogación (independiente, sin haber escrito el plan)

> Quien interroga en esta sección no escribió el documento ni su primera autointerrogación: lo lee
> contra `docs/specs/*` desde cero. Fecha 2026-10-25.

**Lo que impide aprobar, encontrado y ya corregido arriba:**

1. El Paso 0 (versión original) solo bloqueaba M4 a M6, pero `docs/specs/SPEC.md` y
   `docs/specs/THREATS.md` atan el supuesto de `permissions.deny` bajo `bypassPermissions`
   directamente a T-1/T-3, que son las mitigaciones de **CA-134** (M3), no solo de CA-135/136. Con
   el plan sin corregir, M3 se habría construido y etiquetado «impuesta» antes de que el ensayo
   confirmara si eso es cierto. Corregido: el Paso 0, la entrada de M3 y la fila de Riesgos ahora
   incluyen M3 y CA-134 explícitamente.

**Lo que mejora el plan, ya incorporado arriba:**

2. La afirmación «los 10 M mapean uno a uno a mitigaciones de THREATS.md» era inexacta para M1 y
   M6 (ninguno de los dos tiene amenaza asociada, y con razón, pero la frase lo daba a entender).
   Corregida en «Seguridad».
3. El alcance de CA-149 dentro de M4 solo mencionaba `opencode.json`, cuando el criterio no se
   limita a un IDE y esta misma ola da a evol identidad en Claude Code también. Corregido en la
   entrada de M4.
4. M9 modifica `findValidApproval`, que M3 ya usa; no es un ciclo de dependencias, pero la primera
   interrogación no revisaba ese caso (algo posterior que cambia algo anterior). Anotado en M3 y en
   «Orden y dependencias».

Con estas cuatro correcciones, la segunda interrogación no deja nada más pendiente.
