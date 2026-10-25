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
18. **CA-145**: `evol doctor` avisa, como mucho una vez al día y sin retrasar el comando más de 3
    segundos cuando no hay red, de una versión nueva firmada, nombrando las skills que perderían la
    aprobación al actualizar; la persona puede apagar el aviso en su configuración.
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
