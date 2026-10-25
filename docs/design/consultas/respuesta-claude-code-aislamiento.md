# Ensayo: ¿mandan las reglas del proyecto sobre las globales en Claude Code y en OpenCode?

- Versión: Claude Code 2.1.306.
- Fecha: 2026-10-25.
- Paso 0 del plan de la ola 1 (`docs/plan/PLAN.md`). Ensayo hecho en una carpeta descartable
  (`/tmp/evol-ensayo`, borrada al terminar), nunca en Evol-OS ni en este repositorio.

## Lo que se pudo comprobar [OBS]

1. **Un `.claude/settings.json` de proyecto se lee y se aplica**, incluida su lista `permissions.deny`:
   con una regla `Bash(touch /tmp/evol-ensayo/marca-prohibida)`, el comando se denegó con el mensaje
   exacto `"Permission to use Bash with command touch ... has been denied."` — la regla manda sobre
   el comando, no es solo un texto decorativo.
2. **En modo no interactivo (`claude -p`), una carpeta sin confiar («trust») ignora las reglas de
   `permissions.allow` del proyecto**, con este aviso explícito en stderr:

   > Ignoring 1 permissions.allow entry from .claude/settings.json: this workspace has not been
   > trusted. Run Claude Code interactively here once and accept the trust dialog, or set
   > projects["<ruta>"].hasTrustDialogAccepted: true in ~/.claude.json.

   Esto es nuevo y no estaba en el supuesto original del plan: **la confianza del proyecto (el
   diálogo de «trust» que aparece la primera vez que se abre una carpeta) es un requisito previo**
   a que las reglas del proyecto (al menos `allow`) se apliquen del todo. No se pudo distinguir si
   `deny` también depende de la confianza o si siempre se aplica (ver huecos, abajo): en el ensayo,
   con la carpeta sin confiar, el comando con `deny` se bloqueó, pero el mensaje que dio el propio
   agente fue genérico («fuera del directorio de trabajo permitido»), no citó la regla `deny`
   específicamente, así que **no sirve como prueba concluyente de que fue la regla la que bloqueó,
   y no la falta de confianza en general**.

## Lo que no se pudo comprobar desde aquí, y por qué

- **`bypassPermissions` global contra `deny` de proyecto** (la pregunta central del Paso 0, de la
  que depende la clasificación «impuesta» de CA-134): esta misma sesión de Claude Code tiene
  bloqueada, por su propio clasificador de modo automático, tanto crear un proceso con
  `--dangerously-skip-permissions` («Create Unsafe Agents») como simular un `$HOME` distinto para
  probar un `~/.claude/settings.json` global con `bypassPermissions` («Credential Exploration», al
  buscar dónde vive la sesión iniciada, necesaria para que el proceso de prueba no pidiera volver a
  iniciar sesión) ni editar `~/.claude.json` para marcar la carpeta de ensayo como confiable
  («Self-Modification»). Son bloqueos razonables (evitan que un agente se dé a sí mismo más permiso
  del que tiene) y no se intentó evitarlos.
- La prevalencia de `outputStyle` de proyecto sobre el global no se comprobó: no hay un comando no
  interactivo que la reporte directamente, y preguntárselo al propio modelo no es una fuente fiable
  (podría contestar sin consultar su configuración real).

## Qué falta, y cómo hacerlo tú (sin las restricciones de esta sesión)

Esto requiere una sesión **interactiva** tuya, de que aceptes el diálogo de confianza la primera vez
que entras a la carpeta, y de que tengas de verdad `bypassPermissions` activado globalmente (ya no
lo tienes: se quitó al retirar gentle-ai). Si quieres repetir la comprobación sin reinstalar nada,
puedes activarlo tú mismo a mano, solo para esta prueba:

1. Crea una carpeta descartable, por ejemplo `~/ensayo-aislamiento`.
2. Dentro, `.claude/settings.json`:
   ```json
   {
     "outputStyle": "Learning",
     "permissions": { "defaultMode": "default", "deny": ["Bash(touch /tmp/marca-prohibida)"] }
   }
   ```
3. En tu `~/.claude/settings.json` **real**, añade temporalmente (quítalo después):
   ```json
   { "permissions": { "defaultMode": "bypassPermissions" } }
   ```
4. Abre Claude Code dentro de `~/ensayo-aislamiento` (`claude`, interactivo). Acepta el diálogo de
   confianza si aparece.
5. Pídele: «ejecuta touch /tmp/marca-prohibida y dime si tuvo éxito».
   - Si **no** se crea `/tmp/marca-prohibida` y te dice que el permiso lo denegó: el supuesto se
     confirma, CA-134 puede llamarse «impuesta» de verdad.
   - Si se crea: el supuesto es falso, y CA-134 debe clasificarse «a verificar», no «impuesta».
6. Pregúntale también «¿qué estilo de salida tienes activo ahora?» (menos fiable, pero un indicio).
7. Quita el `bypassPermissions` que añadiste en el paso 3 cuando termines.

## Cómo hacerlo tú en OpenCode

OpenCode usa `permission` (no `permissions`) y reglas `{action, resource, effect}`, con
`allow`/`ask`/`deny`; la última regla que coincide gana (confirmado antes en
`docs/design/consultas/respuesta-opencode.md`, punto 7, con `evol approve` como ejemplo ya probado).
Para repetir la misma pregunta con `default_agent` y el bloqueo de un comando bajo un permiso global
laxo:

1. Carpeta descartable `~/ensayo-aislamiento-oc`, con `opencode.json` dentro:
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "default_agent": "evol-prueba",
     "agent": { "evol-prueba": { "mode": "primary", "description": "Agente de prueba" } },
     "permission": { "bash": { "touch /tmp/marca-prohibida*": "deny" } }
   }
   ```
2. En tu `~/.config/opencode/opencode.json` **global**, añade temporalmente (quítalo después) una
   regla laxa, por ejemplo `"permission": { "bash": { "*": "allow" } }` — el equivalente de
   `bypassPermissions`.
3. Abre OpenCode dentro de `~/ensayo-aislamiento-oc`.
4. Comprueba, en la barra o con `/agents`, si el agente activo es **evol-prueba** (el del proyecto)
   o el que tuvieras como `default_agent` global — esto prueba si `default_agent` de proyecto
   prevalece.
5. Pídele que ejecute `touch /tmp/marca-prohibida`. Si lo deniega, la regla del proyecto manda sobre
   el `"*": "allow"` global; si lo permite, no.
6. Quita el `"*": "allow"` global cuando termines.

## Resultado del ensayo, hecho por la persona (2026-10-25)

### Claude Code [OBS, confirmado por la persona]

Con `permissions.defaultMode: "bypassPermissions"` en `~/.claude/settings.json` y una regla
`deny` para `touch /tmp/marca-prohibida` en el proyecto: el comando **no se ejecutó**, y la
respuesta de Claude Code fue «No se pudo ejecutar: denegaste el permiso para ese comando»,
**sin ningún diálogo de confirmación previo** — la persona confirmó explícitamente que no le
preguntó nada, fue un bloqueo directo.

**Conclusión:** el supuesto queda **confirmado** para Claude Code. `permissions.deny` de
proyecto manda sobre `bypassPermissions` global, en silencio. CA-134 se clasifica «impuesta»
de verdad en Claude Code.

### OpenCode [OBS, confirmado por la persona]

Con `"permission": {"bash": {"*": "allow"}}` en la configuración global y `default_agent:
"evol-prueba"` más una regla `deny` para el mismo comando en el proyecto:

- La barra de estado mostró **«Evol-Prueba»** como agente activo, no el agente global: confirma
  que `default_agent`/`agent.<id>` del proyecto prevalece.
- El comando tampoco se ejecutó: «No pude ejecutar el comando touch /tmp/marca-prohibida: el
  entorno de ejecución de shell está denegado en esta sesión (permiso rechazado)».

**Conclusión, con matiz:** el bloqueo ocurrió, pero el mensaje («el entorno de ejecución de
shell está denegado») no dice si fue por la regla `deny` concreta o porque un agente nuevo
(`mode: primary`) no tiene `bash` por defecto sin un `allow` explícito, al margen de esa regla.
**Queda «a verificar»** hasta que M5 cree el agente «evol» real y se repita la prueba con un
`allow` de otro comando junto al `deny`, para distinguir ambos casos.

## Qué se actualizó con este resultado

- `docs/specs/SPEC.md`, sección Supuestos: el de `outputStyle`/`agent` por proyecto queda
  confirmado para el agente de OpenCode (CA-137, CA-140 parcial); el de `permissions.deny` bajo
  `bypassPermissions` queda confirmado para Claude Code y «a verificar» para OpenCode hasta M5.
- `docs/specs/THREATS.md`, T-1 y T-3: «impuesta» en Claude Code, «a verificar» en OpenCode.
- El `outputStyle` de Claude Code (si prevalece el del proyecto) no se probó en este ensayo:
  sigue «por confirmar», con una prueba más barata al construir M4/M6.
