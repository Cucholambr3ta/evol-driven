# Respuesta de Antigravity

- Versión instalada: Antigravity IDE 1.107.0 (extensión Antigravity `v0.2.0`, Electron `39.2.3`, Language Server Linux x64)
- Fecha: 2026-10-22

## A. Tabla de respuestas

| # | Tema | Respuesta corta | Ruta exacta | Origen |
|---|------|-----------------|-------------|--------|
| 1 | Instrucciones de proyecto | Lee ambos (`GEMINI.md` y `AGENTS.md`) de forma jerárquica subiendo al root. Las reglas viven en `.agents/rules/*.md` (también `.agent/`, `_agents/`, `_agent/`). Tienen prioridad: Proyecto > Declaradas (`skills.json`) > Global (`~/.gemini/config/`). Se deduplican por ruta resuelta. | `GEMINI.md`, `AGENTS.md`, `.agents/rules/*.md`, `~/.gemini/config/` | [DOC] `~/.gemini/antigravity-ide/builtin/skills/agy-customizations/docs/rules.md`<br>[OBS] Binario `language_server_linux_x64` (`NewDirectoryRulesDiscoveryHook`, `GEMINI.md`, `AGENTS.md`) |
| 2 | Skills | Soporta carpetas con `SKILL.md`. Frontmatter requiere `name` y `description`; proto interno reconoce además `hidden`, `skills`, `tools`, `model`. Se activa automáticamente por descripción o por invocación explícita. Progressive disclosure: solo carga `name` y `description` al inicio, y lee el cuerpo bajo demanda con `view_file`. | Proyecto: `.agents/skills/<name>/SKILL.md`<br>Global: `~/.gemini/config/skills/<name>/SKILL.md`<br>Built-in: `~/.gemini/antigravity-ide/builtin/skills/<name>/SKILL.md` | [DOC] `~/.gemini/antigravity-ide/builtin/skills/agy-customizations/docs/skills.md`<br>[OBS] Rutas builtin activas en `~/.gemini/antigravity-ide/builtin/skills/` y tipos en `language_server_linux_x64` (`SkillMetadata`) |
| 3 | Workflows o comandos | Sí, mediante **Workflows** que se exponen como **Slash Commands** (`/<nombre>`). Se definen en archivos Markdown con frontmatter (`description`). Soportan argumentos tipados (`SlashCommandArgument`). Pueden instruir al agente para encadenar pasos, invocar herramientas, activar skills o lanzar subagentes. | Proyecto: `.agents/workflows/<nombre>.md` (o `.agent/workflows/`)<br>Global: `~/.gemini/antigravity/global_workflows/<nombre>.md` | [DOC] `~/.gemini/antigravity-ide/builtin/skills/antigravity_guide/references/app.md`<br>[OBS] Extensión `package.json` (`antigravity.workflowEditor`) y binario `language_server_linux_x64` (`WorkflowSpec`, `SlashCommandInfo`, `SlashCommandArgument`) |
| 4 | Subagentes | Sí. Soporta subagentes runtime (`browser_subagent`, `invoke_subagent`, `define_subagent`, `manage_subagents`) y agentes declarativos en Markdown/JSON. Un agente principal puede invocar múltiples subagentes concurrentes a la vez pasándolos en un array. Tienen contexto aislado (cada uno con su propio `conversationId` y `transcript.jsonl`) y herramientas restringidas por spec. Pueden invocar subagentes recursivamente hasta el límite `MaxNestingDepth`. | Proyecto: `.agents/agents/<name>.md` o `.agents/agents/<name>.json`<br>Global: `~/.gemini/config/agents/`<br>Runtime logs: `~/.gemini/antigravity-ide/brain/<conv-id>/.system_generated/logs/transcript.jsonl` | [OBS] Binario `language_server_linux_x64` (`agentsCustomization`, `AgentScriptItem`, `InvokeSubagentToolConfig`, `NewInvokeSubagentToolConverter`, `NewManageSubagentsToolConverter`) |
| 5 | MCP | Se configura en `mcp_config.json` con mapa `mcpServers`. Acepta transporte **Stdio** (`command`, `args`, `env`, `cwd`) y **SSE/HTTP** (`serverUrl`, `headers`). Se pueden desactivar servidores (`"disabled": true`) o restringir herramientas específicas mediante `"disabledTools": ["toolA"]`, o modular su carga con `"tools": {"toolA": {"eager": false, "background": "off"}}`. | Global: `~/.gemini/config/mcp_config.json`<br>Plugin: `.agents/plugins/<name>/mcp_config.json`<br>Esquema: `~/.local/opt/antigravity/resources/app/extensions/antigravity/schemas/mcp_config.schema.json` | [DOC] `~/.gemini/antigravity-ide/builtin/skills/agy-customizations/docs/mcp_servers.md`<br>[OBS] Esquema `mcp_config.schema.json` y archivo activo `~/.gemini/config/mcp_config.json` |
| 6 | Ganchos o eventos | Sí, mediante `hooks.json`. Soporta `PreInvocation` (para inyectar estado del proyecto vía `injectSteps` antes de que el modelo decida), `PostInvocation` (para forzar continuación o añadir pasos), `PreToolUse` (para auditar, interceptar, bloquear o sobreescribir argumentos de herramientas), `PostToolUse` (limpieza posterior) y `Stop` (evitar que el agente termine si la meta no se ha cumplido). Internamente el motor también compila `SessionStart` para inicio de sesión. | Proyecto: `.agents/hooks.json`<br>Global: `~/.gemini/config/hooks.json`<br>Plugin: `.agents/plugins/<name>/hooks.json` | [DOC] `~/.gemini/antigravity-ide/builtin/skills/agy-customizations/docs/hooks.md`<br>[OBS] Paquetes Go en binario `language_server_linux_x64` (`google3/third_party/jetski/cortex/customization/hooks/...`, `CallSessionStartHook`) |
| 7 | Permisos | Sí, se puede impedir la ejecución de cualquier comando específico (como `evol approve`). Se puede configurar por dos vías: 1) En `.agents/hooks.json` con un handler `PreToolUse` para `run_command` devolviendo `"decision": "deny"` (bloqueo duro inmediato sin ejecutar) o `"decision": "ask"` (pide confirmación humana interactiva). 2) En configuración del IDE / Settings mediante `Command Denylist` (`user_denylist`) o reglas de `Permission Grants` (`deny`). | Configuración hooks: `.agents/hooks.json`<br>Configuración IDE: `~/.config/Antigravity IDE/User/settings.json` o UI de Settings | [DOC] `~/.gemini/antigravity-ide/builtin/skills/agy-customizations/docs/hooks.md` y `antigravity_guide/references/app.md`<br>[OBS] Protos en binario (`AutoCommandConfig.GetUserDenylist`, `PermissionGrantsConfig.GetDeny`) |
| 8 | Portabilidad | Comparte la ruta `.agents/skills/<skill>/SKILL.md` y el archivo `AGENTS.md` con herramientas como Codex u OpenCode. Conflictos potenciales: 1) Antigravity soporta variantes (`.agents`, `.agent`, `_agents`, `_agent`) que otros no; 2) Antigravity espera carpetas como `.agents/workflows/`, `.agents/rules/*.md` y `.agents/hooks.json`; 3) Si existen `GEMINI.md` y `AGENTS.md`, Antigravity lee y combina ambos, mientras otros solo leen `AGENTS.md`; 4) Formato MCP (`mcp_config.json`) difiere de la configuración de Claude Code o Cursor. | `.agents/`, `.agents/skills/`, `AGENTS.md`, `GEMINI.md` | [DOC] `~/.gemini/antigravity-ide/builtin/skills/agy-customizations/SKILL.md`<br>[OBS] PATH del sistema del usuario con binarios de `codex` y `opencode` en `/home/cucholambreta/` |

---

## B. Ejemplos mínimos que funcionan

### 1. Una skill `demo` con su `SKILL.md`

#### `.agents/skills/demo/SKILL.md`
```markdown
---
name: demo
description: Run health checks and environment validation for the demo project. Use whenever verifying deployment readiness.
---

# Demo Skill

Follow these steps to validate the project:

1. Check runtime dependencies:
   `node --version`
2. Run automated validation:
   `npm test`
3. If errors occur, inspect the failure logs and suggest fixes.
```

---

### 2. Un workflow o comando `demo`

#### `.agents/workflows/demo.md`
```markdown
---
description: Execute the full project sanity check and status report
---

# Workflow: /demo

When this slash command is invoked:
1. Verify git repository status:
   `git status --short`
2. Run project tests:
   `npm test`
3. Report whether all checks passed cleanly.
```

---

### 3. Un subagente `demo`

#### `.agents/agents/demo.md`
```markdown
---
name: demo-inspector
description: Read-only verification subagent for codebase inspection and security audits.
subagent: true
model_tier: FAST
disable_model_selection: true
tools:
  - view_file
  - grep_search
  - list_dir
---

You are a read-only code inspection specialist.
Analyze code structures, inspect configuration files, and report potential anomalies without modifying any files.
```

---

### 4. La entrada de un servidor MCP de ejemplo

#### `~/.gemini/config/mcp_config.json`
```json
{
  "mcpServers": {
    "sqlite-inspector": {
      "command": "sqlite-mcp-server",
      "args": ["/home/cucholambreta/data.db"],
      "env": {
        "DB_READONLY": "1"
      },
      "disabled": false,
      "disabledTools": ["execute_write_query"],
      "tools": {
        "query": {
          "background": "off",
          "eager": true
        }
      }
    }
  }
}
```

---

## C. Límites

1. **Hooks síncronos y bloqueantes:** Los ganchos de ciclo de vida (`hooks.json`) solo soportan `"type": "command"` (ejecución de procesos locales mediante `sh -c` / `cmd /c`). Se ejecutan de manera estrictamente síncrona y bloquean el bucle de razonamiento del agente hasta que devuelven su respuesta en stdout. No admiten hooks asíncronos desacoplados ni transporte directo vía HTTP.
2. **Sin reconfiguración de MCP en caliente durante una sesión activa:** No existe un comando dinámico de agente para registrar nuevos servidores MCP durante una conversación; los cambios en `mcp_config.json` requieren recargar la ventana o reiniciar el Language Server (`antigravity.restartLanguageServer`).
3. **Tope de profundidad de subagentes (`MaxNestingDepth`):** La creación de subagentes recursivos está acotada por configuración (`InvokeSubagentToolConfig.MaxNestingDepth`) para prevenir bucles de recursión infinita.
4. **Contexto completamente estricto y aislado por subagente:** Cada subagente corre en una trayectoria independiente con su propio `conversationId` y `transcript.jsonl`. No existe memoria compartida ni paso implícito de contexto entre subagentes hermanos que corran en paralelo; toda la información compartida debe ser canalizada explícitamente por el agente orquestador mediante el prompt de entrada o archivos en disco.
5. **Topología de orquestación en estrella (sin mensajería peer-to-peer):** Los subagentes no pueden intercambiar mensajes directos entre ellos durante la ejecución. El orquestador principal distribuye el trabajo y consolida las respuestas una vez que cada subagente termina (`join`).
6. **Políticas de confirmación de terminal para comandos no autorizados:** Si el usuario tiene una política de ejecución restrictiva (`request-review` o `strict`), cualquier comando emitido por un subagente que no figure en `user_allowlist` o no cuente con un permiso previo detendrá la ejecución esperando aprobación manual interactiva del usuario.
7. **Restricción de modificación de archivos fuera del espacio de trabajo:** El agente y sus subagentes tienen restringida por defecto la modificación de archivos fuera de la raíz del workspace activo (`Non-Workspace File Access Policy`), requiriendo confirmación explícita si se intenta editar fuera de `/home/cucholambreta/Projects/evol-driven`.

---

## D. Dudas y contradicciones

1. **Límite numérico exacto de concurrencia para `invoke_subagent`:** En los protobufs compilados de Go se observa que `InvokeSubagentToolConfig` define `MaxNestingDepth`, `FastModel` y `HeavyModel`, y el tool acepta una lista arbitraria `Subagents []SubagentEntry`. Sin embargo, no se pudo confirmar si existe una directiva expuesta al usuario para fijar un tope numérico rígido de procesos concurrentes (por ejemplo, un flag `max_concurrent_subagents`), o si este depende enteramente del planificador de goroutines y del pool de subprocesos del Language Server.
2. **Disponibilidad de `SessionStart` en `hooks.json`:** En el código fuente compilado del binario (`session_start.go`, `CallSessionStartHook`, `SessionStartHookArgs`, `SessionStartHookResult`) la funcionalidad para capturar el inicio de sesión e inyectar pasos (`injectSteps`) ya está completamente implementada. Sin embargo, en la documentación oficial de `hooks.md` solo se describen formalmente cinco eventos (`PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`). Queda la duda de si `SessionStart` está reservado como hook interno o si ya es consumible directamente en `hooks.json` sin documentar.
3. **Descubrimiento directo de `mcp_config.json` en raíz de proyecto sin plugin:** La documentación oficial de MCP (`mcp_servers.md`) estipula que las dos ubicaciones oficiales son `~/.gemini/config/mcp_config.json` (global) y `plugins/<plugin_name>/mcp_config.json` (plugins). No obstante, el esquema de validación de la extensión VS Code machea el patrón `**/mcp_config.json`. No se pudo confirmar al 100% si un `.agents/mcp_config.json` suelto (fuera de una carpeta `plugins/`) es ingerido de forma autónoma por el Language Server o si es obligatorio empaquetarlo bajo la estructura de plugin.
