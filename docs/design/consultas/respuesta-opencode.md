# Respuesta de OpenCode

- Versión instalada: **2.1.2** (paquete `@opencode/cli` 2.1.2, binario `/home/cucholambreta/.opencode/bin/opencode`, lanzado por shim de mise en `~/.local/share/mise/installs/opencode/latest/node_modules/.bin/opencode`). [OBS]
- Fecha: **2026-10-22**

> Nota importante sobre el nombre: OpenCode V1 era `sst/opencode`. Esta instalación es **OpenCode V2** (repo `anomalyco/opencode`, según `package.json` del paquete instalado). La documentación de V2 vive en `https://opencode.ai/v2/docs/` y es la única fuente válida para lo que sigue. [OBS]+[DOC]

## A. Tabla de respuestas

| # | Tema | Respuesta corta | Ruta exacta | Origen |
|---|------|-----------------|-------------|--------|
| 1 | Instrucciones de proyecto | Sí leo `AGENTS.md`. Global + de la raíz del proyecto hacia abajo hasta el workspace, combinados (sin resolver conflictos). **NO leo `CLAUDE.md`** (verificado empíricamente). El campo `instructions` de la config añade archivos/globs/URLs *después* de los `AGENTS.md`. | `<proyecto>/AGENTS.md`, `~/.config/opencode/AGENTS.md`; campo `instructions` en `opencode.json` | [DOC]+[OBS] |
| 2 | Skills | Sí: carpetas con `SKILL.md` y archivos `*.md` sueltos en la raíz. Rutas proyecto y global, incluida compatibilidad `.claude/skills` y `.agents/skills`. El frontmatter reconoce `name`, `description`, `metadata.opencode/autoinvoke`, `disable-model-invocation`. Solo se anuncia ID+name+description; el cuerpo se carga al invocarla con la herramienta `skill`. | `.opencode/skills/<id>/SKILL.md`, `~/.config/opencode/skills`, `~/.claude/skills`, `~/.agents/skills`, `.claude/skills`, `.agents/skills`; campo `skills` en config | [DOC]+[OBS] |
| 3 | Workflows o comandos | Sí: `/evol` se define en `.opencode/commands/evol.md` (o `command/`, singular legacy). Cuerpo = plantilla con `$ARGUMENTS`, `$1`…`$9` y bloques `` !`shell` ``. Frontmatter: `description`, `agent`, `model`, `subagent`. | `.opencode/commands/<nombre>.md`, `~/.config/opencode/commands/`; también JSON `commands` en config | [DOC]+[OBS] |
| 4 | Subagentes | Agentes primarios vs `subagent`. Se definen en `.opencode/agents/<name>.md` (o JSON `agents`). Delegación vía herramienta `subagent`, varios en paralelo (uno por llamada), contexto aislado. Profundidad de anidamiento por defecto **1** (un subagente NO puede crear otro) salvo `experimental.subagent_depth`. `general` no puede lanzar subagentes. | `.opencode/agents/<name>.md`, `~/.config/opencode/agents/`; `agents`, `experimental.subagent_depth` en config | [DOC]+[OBS] |
| 5 | MCP | Sí. En `opencode.json` bajo `mcp.servers`. Local: `type:"local"`, `command:[...]`, opcional `cwd`, `environment`. Remoto: `type:"remote"`, `url`, `headers`, `oauth`. Herramientas se llaman `<server>_<tool>` y se restringen con permisos/policies. `codemode` (por defecto `true`) las expone agrupadas. | `~/.config/opencode/opencode.json` y `<proyecto>/opencode.json`, clave `mcp.servers` | [DOC]+[OBS] |
| 6 | Ganchos o eventos | Sí, **plugins** en TypeScript/JavaScript (`Plugin.define({ id, setup(ctx) })`). Hooks: `session.hook("prompt"/"context"/"compaction"/"generate"/"title"/"model.request"/"http.request"/"http.response")`, `tool.hook("execute.before"/"execute.after")`, `shell.hook("create.before")`, `permission.hook("evaluate")`, y `ctx.event.subscribe()` para el flujo de eventos del servidor. | `.opencode/plugins/<x>.ts|js|dir`, `~/.config/opencode/plugins/`; campo `plugins` en config | [DOC]+[OBS] |
| 7 | Permisos | Sí. Lista ordenada de reglas `{action, resource, effect}` con `allow`/`ask`/`deny`. `action:"shell"`, `resource:"evol approve *"`, `effect:"deny"` bloquea el comando (verificado empíricamente). Se configuran a nivel global, proyecto y por agente (`agents.<id>.permissions`); agent-specific se *añaden* tras las globales, gana la **última** coincidencia. `policies` (binario, solo endurece) es una capa aparte que gana sobre permisos. | `permissions` en config; `agents.<id>.permissions`; `policies` | [DOC]+[OBS] |
| 8 | Portabilidad | Sí: `AGENTS.md` es estándar compartido (Codex/Cursor/otros) y se leen `.claude/skills` y `.agents/skills` como fuentes de compatibilidad. Conflictos: un `.opencode` gana sobre `.claude`/`.agents`; IDs de skill duplicados se sobreescriben según precedencia; **`CLAUDE.md` NO se lee** (solo `AGENTS.md`). | ver §A.2 y §A.1 | [DOC]+[OBS] |

## B. Ejemplos mínimos que funcionan

> Solo de lo que SÍ soporta OpenCode V2. **No** se han creado en tus proyectos; probados en carpetas temporales ya borradas.

### 1. Skill `demo` — ruta: `<proyecto>/.opencode/skills/demo/SKILL.md`

```markdown
---
name: Demo
description: Skill de demostración; descríbela bien porque así la elige el modelo.
metadata:
  opencode/autoinvoke: true   # false la oculta del listado del modelo
---

## Flujo

1. Lee `references/policy.md` (relativo a esta carpeta).
2. Ejecuta `scripts/run.ts`.
```

`<proyecto>/.opencode/skills/demo/references/policy.md` y `scripts/run.ts` viven junto al `SKILL.md`.
El ID de la skill sale de la ruta (aquí `demo`), es `\`case-sensitive\`` y **no** del `name` del frontmatter.
También vale un archivo suelto: `<proyecto>/.opencode/skills/demo.md` → ID `demo`.
Rutas globales equivalentes: `~/.config/opencode/skills/demo/SKILL.md`.
Se invoca con `@demo` en el prompt o por la herramienta `skill` con `{id:"demo"}`. **[OBS: `demo` y `flatskill` se descubrieron en la prueba]**

### 2. Comando `demo` — ruta: `<proyecto>/.opencode/commands/demo.md`

```markdown
---
description: Ejecuta la demo
agent: build
# model: anthropic/claude-sonnet-4-5#high   # opcional
# subagent: true                              # opcional: sesión hija en segundo plano
---

Haz la demo de $ARGUMENTS. Si falta, usa $1 como objetivo y $2 como alcance.
```

Se invoca como `/demo mi-objetivo "con tests"`.
Cuerpo = plantilla: `$ARGUMENTS` es todo el texto; `$1…$9` son posicionales (el último consume el resto);
`` !`git diff` `` inserta la salida de shell antes de enviar. Rutas anidadas dan nombres con `/`:
`.opencode/commands/team/demo.md` → `/team/demo`.
Existe también la forma JSON:

```jsonc
{ "$schema": "https://opencode.ai/config.json",
  "commands": { "demo": { "description": "…", "template": "Haz la demo de $ARGUMENTS.", "agent": "build" } } }
```

**[OBS: `/demo` apareció al definir `.opencode/commands/demo.md`]**

### 3. Subagente `demo` — ruta: `<proyecto>/.opencode/agents/demo.md`

```markdown
---
description: Subagente de demostración; el modelo principal lo elige por esta descripción.
mode: subagent          # primary | subagent | all
model: anthropic/claude-sonnet-4-5#high   # opcional; si se omite hereda el del padre
permissions:
  - { action: edit, resource: "*", effect: deny }
  - { action: shell, resource: "*", effect: deny }
---

Eres un revisor. Lista hallazgos por severidad con archivo y línea. No edites archivos.
```

Rutas anidadas dan IDs con `/`: `.opencode/agents/team/demo.md` → `team/demo`.
El agente principal lo lanza pidiéndolo en lenguaje natural («usa el subagente demo para…»); OpenCode expone una
herramienta `subagent` y la gobierna el permiso `subagent` del padre:

```jsonc
{ "agents": { "orchestrator": {
  "permissions": [
    { "action": "subagent", "resource": "*", "effect": "deny" },
    { "action": "subagent", "resource": "demo", "effect": "allow" } ] } } }
```

Forma JSONC equivalente: `"agents": { "demo": { "mode": "subagent", "system": "…", "permissions": [...] } }`.
**[OBS: `.opencode/agents/probe/demo.md` apareció como `probe/demo` en `opencode debug agents`]**

### 4. Servidor MCP de ejemplo — ruta: `<proyecto>/opencode.json` (o `~/.config/opencode/opencode.json`)

Local (stdio):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "demo-local": {
        "type": "local",
        "command": ["npx", "-y", "@modelcontextprotocol/server-everything"],
        "environment": { "LOG_LEVEL": "info", "MCP_API_KEY": "{env:MCP_API_KEY}" }
      }
    }
  }
}
```

Remoto (Streamable HTTP con OAuth por defecto):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "demo-remote": { "type": "remote", "url": "https://mcp.example.com/mcp" }
    }
  }
}
```

Restringir sus herramientas (nombre normalizado `<server>_<tool>`):

```jsonc
{ "permissions": [ { "action": "demo_remote_*", "resource": "*", "effect": "deny" } ] }
```

o a nivel de policy (endurece siempre): `{ "action": "integration.use", "resource": "mcp:demo-remote", "effect": "deny" }`.
**[OBS: tu `~/.config/opencode/opencode.json` ya usa este formato, con `"mcp": { "servers": { … } }`]**

### 5. (Extra) Plugin con hook — ruta: `<proyecto>/.opencode/plugins/evol-state.ts`

Como el orquestador quiere inyectar el estado del proyecto en el contexto, esto es lo relevante:

```ts
import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "evol.state",
  async setup(ctx) {
    // 1) antes de admitir cada prompt del usuario
    await ctx.session.hook("prompt", (event) => {
      event.prompt.files ??= []
      event.prompt.files.push({ uri: `file://${ctx.location.directory}/.evol/state.md` })
    })
    // 2) justo antes de cada llamada al modelo (inyecta instrucciones)
    await ctx.session.hook("context", (event) => {
      event.system.push({ type: "text", text: "Estado del proyecto: ver .evol/state.md" })
    })
    // 3) antes/después de cada herramienta
    await ctx.tool.hook("execute.before", (event) => { /* ... */ })
    // 4) eventos de sesión
    const ac = new AbortController()
    void (async () => { for await (const e of ctx.event.subscribe({ signal: ac.signal })) { /* ... */ } })()
    return () => ac.abort()
  },
})
```

## C. Límites

Cosas que **no** puedes hacer y que afectarían a un orquestador que reparte trabajo entre subagentes:

1. **No leo `CLAUDE.md`.** V2 solo reconoce `AGENTS.md` como archivo de instrucciones; no hay *fallback*. Si tu orquestador
   escribe el estado en `CLAUDE.md`, OpenCode lo ignorará (verificado: el modelo no veía el marcador de `CLAUDE.md`).
   → Escribe el estado en `AGENTS.md` o en un archivo declarado en `instructions` o inyectado por plugin.
2. **Los subagentes no pueden crear subagentes por defecto.** `experimental.subagent_depth` = `1`. Un subagente "auditor"
   que quiera lanzar más subagentes necesita subir ese valor (experimental, puede cambiar o desaparecer).
3. **`general` no puede lanzar subagentes** (regla de fábrica). `explore` es de solo lectura (niega escritura). El agente
   que reparte trabajo debe ser un primario propio, no `general`.
4. **El contexto de cada subagente es aislado y fresco.** No hereda tu conversación; hay que pasarle todo lo necesario en
   el prompt. Los hijos *sí* heredan las reglas de permisos vigentes en el momento de crearse.
5. **No controlo el paralelismo desde la config.** Puedo lanzar varios subagentes (una llamada a la herramienta `subagent`
   cada uno; con `background=true` en paralelo), pero **no hay un tope de "N a la vez" configurable ni conocido**: la
   concurrencia la decide el modelo principal dentro de un turno. [NO SÉ: no confirmé el número máximo real].
6. **No hay un hook "al iniciar sesión" exacto.** Lo más cercano es `setup(ctx)` del plugin (carga del plugin) y el hook
   `session.hook("prompt", …)` (por prompt admitido). No existe un gancho equivalente a "session.start" en la doc de V2.
   El flujo de eventos (`ctx.event.subscribe()`) es de solo lectura: observa, no inyecta.
7. **Comandos `/` son del cliente, no del modelo.** El modelo no "ve" la lista de comandos en su contexto (verificado: no
   pudo listarlos sin leer archivos). No puedes pedirle a un subagente que "ejecute `/evol`" como texto; los comandos los
   dispara el usuario o la API (`ctx.session.command`), no el propio modelo de forma implícita.
8. **`request` por agente (temperatura/headers/body) no se envía todavía** en V2: se preserva pero el runner no lo manda.
   Configura eso en el provider/modelo, no en el agente.
9. **La profundidad de anidamiento, el scanner portable, `todo`, etc. son `experimental`**: pueden cambiar o desaparecer
   sin aviso.
10. **Los `deny` no se pueden levantar desde el proyecto.** Un `deny` global o una policy (o Console) siempre gana; un
    proyecto no puede "re-permitir" algo denegado arriba. Útil para blindar `evol approve`, pero implica que si el
    usuario deniega globalmente algo, tu orquestador no podrá saltárselo.
11. **Los comandos de shell en plantillas (`!`…`` ` ``) se ejecutan fuera del flujo de permisos del agente.** «Only use
    commands from sources you trust.» No metas argumentos no confiables en bloques de shell.
12. **No hay forma de impedir que el modelo *decida* no ejecutar algo** (mi propio criterio de seguridad intervino en una
    prueba pidiéndome ejecutar `evol approve --yes`). Un `deny` sí bloquea a nivel de herramienta (probado), pero el
    modelo puede negarse aunque esté permitido.

## D. Dudas y contradicciones

- **Nombre/versión.** El binario dice `opencode v2.1.2` y el `package.json` apunta a `github.com/anomalyco/opencode`
  (repo de V2). La doc V1 (`opencode.ai/docs/`) **no** aplica. Marqué toda la respuesta como V2. Si en algún punto
  esperabas comportamiento de V1 (`sst/opencode`), habrá diferencias: campos `permission`/`tools`/`maxSteps` están
  deprecados y `subtask` es alias de `subagent`.
- **`CLAUDE.md`.** [DOC] dice explícitamente «V2 recognizes `AGENTS.md` only. It does not use `CLAUDE.md` as a fallback.»
  Lo confirmé [OBS]: con solo `CLAUDE.md` presente, el modelo respondió `NO` a si veía el marcador; el string `CLAUDE.md`
  en el binario aparece solo en el prompt del comando `init` (que lo lista como archivo a *considerar* al generar
  `AGENTS.md`), no como cargador. Sin contradicción, pero quería ser explícito porque muchas guías de V1 lo mencionan.
- **Tope de subagentes concurrentes.** [NO SÉ] el número máximo. La doc habla de `subagent_depth` (anidamiento), no de
  concurrencia. No lo pude medir de forma fiable en una prueba headless.
- **`opencode debug agents` en V2 muestra** `build`, `plan`, `compaction`, `explore`, `general`, `summary`, `title`
  (los tres últimos `hidden`). La doc también cita un agente `build` con permiso extra `question` y `browser:deny` que sí
  vi en mi salida; no hay `scout` en V2 (la doc lo dice).
- **API para listar catálogos (`/api/command`, `/api/agent`, `/api/skill`).** Existen, pero solo devolvieron datos con el
  servidor de fondo anclado al directorio del proyecto (home), no con un `serve` efímero sin `directory` válido en el
  query (la auth rechazaba con query string). Por eso verifiqué la discovery con `opencode debug agents` (subagentes) y
  con una sesión headless real (skills y `AGENTS.md`), que es evidencia más directa. [NO SÉ] la firma exacta del parámetro
  de directorio de esos endpoints.
- **`instructions` vs `AGENTS.md`.** No se contradicen: se combinan. Orden: [DOC] 1) system prompt del agente, 2) guía de
  Code Mode, 3) MCP/references/skills, 4) `AGENTS.md` globales y de proyecto + `instructions` configurados, 5) fecha/
  entorno, 6) instrucciones por sesión de la API. Todo *acumulativo*, sin resolución de conflictos.
