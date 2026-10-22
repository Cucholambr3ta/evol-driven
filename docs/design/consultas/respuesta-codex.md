# Respuesta de Codex

- Versión instalada: `codex-cli 0.163.0` [OBS: salida de `codex --version`].
- Fecha: 2026-10-22 (fecha del entorno) [OBS].

## A. Tabla de respuestas

| # | Tema | Respuesta corta | Ruta exacta | Origen |
|---|------|-----------------|-------------|--------|
| 1 | Instrucciones de proyecto | Sí. Lee un archivo global y luego, desde la raíz del proyecto hasta el directorio de trabajo, como máximo un archivo por nivel. Se concatenan de raíz a hoja; los posteriores tienen precedencia práctica. Tamaño combinado predeterminado: 32 KiB (`project_doc_max_bytes`). `CLAUDE.md` no es especial: solo se leería si aparece en `project_doc_fallback_filenames`; no encontré una configuración de fallback activa. No hay evidencia de que lea `GEMINI.md` por defecto. | Global: `$CODEX_HOME/AGENTS.override.md` o, si no existe/no tiene contenido, `$CODEX_HOME/AGENTS.md` (por defecto `~/.codex`). Proyecto: cada nivel entre raíz Git y CWD: `AGENTS.override.md`, `AGENTS.md`, luego fallbacks configurados. En esta instalación no encontré esos archivos en el proyecto ni `~/.codex/AGENTS.md`. | [DOC](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [OBS] búsquedas en `/home/cucholambreta/Projects/evol-driven` y rutas de ancestros/globales; `~/.codex/config.toml` no configura fallbacks. |
| 2 | Skills | Sí, carpetas con `SKILL.md`. Rutas documentadas: `.agents/skills` desde CWD hacia la raíz Git, `~/.agents/skills`, `/etc/codex/skills` y las integradas. Frontmatter mínimo documentado: `name` y `description`; no confirmé otros campos reconocidos en Codex CLI. Se pueden invocar explícitamente con `$nombre` y el modelo también puede elegirlas por la descripción. Primero descubre metadatos y lee el cuerpo al invocarlas. | Proyecto: `$CWD/.agents/skills/<skill>/SKILL.md` y equivalentes en ancestros hasta raíz. Usuario: `~/.agents/skills/<skill>/SKILL.md`. Admin: `/etc/codex/skills/<skill>/SKILL.md`. | [DOC](https://learn.chatgpt.com/docs/build-skills), [OBS] existen `/home/cucholambreta/.codex/skills/.system/{imagegen,openai-docs,review-agent,skill-creator,skill-installer}/SKILL.md` y enlaces `diagnose-crash`, `omarchy`; no existe `.agents/skills` en este repo. La instalación observada usa además `.codex/skills`, aunque la guía de rutas local enumera `.agents/skills`, no `.codex/skills`. |
| 3 | Workflows o comandos | Un workflow reutilizable puede exponerse como skill e invocarse `$evol`; admite contexto/argumentos en el mensaje del usuario, pero no encontré un esquema formal de argumentos posicionales para skills. Los prompts personalizados se documentan como `/prompts:<nombre>` en la app de escritorio; no confirmé que sean mecanismo del CLI instalado ni que haya una carpeta compartida para él. No hay evidencia aquí de un comando arbitrario definido por el usuario como `/evol`. Una skill puede instruir a Codex para que use herramientas/subagentes disponibles, pero no registra por sí sola un comando CLI. | Skill: `.agents/skills/evol/SKILL.md` o `~/.agents/skills/evol/SKILL.md`. Prompts de la app: `/prompts:<nombre>`; ruta de archivos para el CLI: [NO SÉ]. | [DOC](https://learn.chatgpt.com/docs/build-skills), [DOC](https://learn.chatgpt.com/docs/reference/slash-commands), [NO SÉ] soporte de prompts personalizados en este CLI. |
| 4 | Subagentes | Sí. El CLI reporta `multi_agent` y `multi_agent_v2` como funciones estables y activas; esta sesión también expone herramientas de colaboración. La documentación define agentes personalizados en TOML, en `~/.codex/agents/` o `.codex/agents/`. Campos obligatorios: `name`, `description`, `developer_instructions`; admite, entre otros, modelo y esfuerzo de razonamiento. Pueden trabajar en paralelo; el tope se configura con `agents.max_concurrent_threads_per_session` (alias legado `max_threads`) y el default lo decide Codex. Tienen contexto propio, pero heredan sandbox, aprobaciones, proveedor y servidores MCP del padre. Algunas capacidades/herramientas se pueden desactivar; no se puede asignar al subagente otro sandbox a través de su TOML. No pude confirmar un límite de profundidad ni si un subagente puede crear otro en este CLI. | Definición por proyecto: `.codex/agents/demo.toml`; global: `~/.codex/agents/demo.toml`; límites: `[agents]` en `config.toml`. En esta instalación no existen esas carpetas/configuraciones. | [DOC](https://learn.chatgpt.com/docs/agent-configuration/subagents), [DOC](https://learn.chatgpt.com/docs/config-file/config-reference), [OBS] `codex features list` muestra `multi_agent stable true` y `multi_agent_v2 stable true`; no declara un tope configurado. |
| 5 | MCP | Sí. Configuración TOML de usuario en `~/.codex/config.toml` y de proyecto en `.codex/config.toml` (la de proyecto solo se carga si el repo es de confianza). Transportes: proceso local STDIO y Streamable HTTP. Herramientas se pueden permitir/denegar mediante `enabled_tools`/`disabled_tools` y configurar por servidor o herramienta con modos `auto`, `prompt`, `writes`, `approve`. | `[mcp_servers.nombre]` en `~/.codex/config.toml` o `.codex/config.toml`. Ejemplo de ruta de usuario observado: `/home/cucholambreta/.codex/config.toml`. | [DOC](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [DOC](https://learn.chatgpt.com/docs/config-file/config-basic), [OBS] `codex mcp list` devuelve “No MCP servers configured yet”; config de usuario solo tiene `[tui] screen_reader_detection_done = true`. |
| 6 | Ganchos o eventos | Sí: hooks configurables en `config.toml`, entre ellos `SessionStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`, `SessionEnd` y eventos de subagente. `SessionStart` puede añadir contexto antes de la solicitud del modelo; `PreToolUse` puede bloquear herramientas cubiertas; `Stop` puede pedir una continuación del turno. No encontré un evento llamado “notificación al terminar turno”; el equivalente documentado es `Stop`, y `SessionEnd` es fin de sesión, no de cada turno. Los hooks no cubren todas las rutas de herramientas, así que no son una frontera absoluta. | `[hooks]` y tablas `[[hooks.Evento]]` en `$CODEX_HOME/config.toml` o `.codex/config.toml`; los comandos pueden residir, por ejemplo, en `.codex/hooks/`. No hay hooks configurados en el `config.toml` de usuario observado. | [DOC](https://learn.chatgpt.com/docs/hooks), [DOC](https://learn.chatgpt.com/docs/config-file/config-reference), [OBS] lectura de `/home/cucholambreta/.codex/config.toml`. |
| 7 | Permisos | Para un comando del shell se puede crear una regla `forbidden` que Codex bloquea sin pedir confirmación cuando esa regla coincide. Las reglas documentadas controlan comandos ejecutados fuera del sandbox; no son un bloqueo universal de cualquier vía para producir el mismo efecto. La aprobación decide cuándo preguntar; el sandbox limita acceso a archivos/red; las reglas permiten, preguntan o prohíben prefijos fuera del sandbox. Para cubrir herramientas locales compatibles también se puede usar `PreToolUse`, pero la guía advierte que hay rutas que no pasan por hooks. | Reglas: `~/.codex/rules/*.rules` o `.../.codex/rules/*.rules` junto a una capa de configuración activa; `decision = "forbidden"`. Hooks: `hooks.PreToolUse`. No hay reglas ni hooks observados en el repo o `~/.codex`. | [DOC](https://learn.chatgpt.com/docs/agent-configuration/rules), [DOC](https://learn.chatgpt.com/docs/hooks), [DOC](https://learn.chatgpt.com/docs/config-file/config-advanced), [OBS] búsquedas locales. |
| 8 | Portabilidad | `AGENTS.md` es una convención de Codex y otras herramientas de agentes pueden leerlo, pero no puedo afirmar que todas lo hagan ni que interpreten igual sus instrucciones. `.agents/skills` es una ubicación expresamente documentada para skills de Codex y puede servir como ubicación compartida si la otra herramienta implementa ese estándar. Los nombres/rutas de skills Codex (`~/.agents/skills`) no son necesariamente las rutas de Antigravity u OpenCode. `CLAUDE.md` requiere declararse como fallback en Codex. Riesgo: reglas duplicadas o contradictorias, activación con semántica distinta y diferencias de seguridad/herramientas. | Compartida potencial: `AGENTS.md`, `.agents/skills/<nombre>/SKILL.md`. Codex específico: `.codex/config.toml`, `.codex/agents/`, `$CODEX_HOME/`. | [DOC](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [DOC](https://learn.chatgpt.com/docs/build-skills), [NO SÉ] compatibilidad exacta/actual de Antigravity y OpenCode; no la verifiqué en sus fuentes oficiales. |

## B. Ejemplos mínimos que funcionan

Los ejemplos son ilustrativos, no se crearon en el proyecto. Los modelos del ejemplo de subagente deben sustituirse por uno habilitado en la cuenta.

### 1. Skill `demo`

`/home/cucholambreta/Projects/evol-driven/.agents/skills/demo/SKILL.md`

```markdown
---
name: demo
description: Resume el estado y los próximos pasos de este proyecto cuando el usuario pide un resumen de estado.
---

Lee el README y el estado Git. Devuelve un resumen breve con los cambios sin commit y los próximos pasos que estén documentados. No modifiques archivos.
```

Se invoca con `$demo` o con una solicitud que coincida con su descripción. [DOC](https://learn.chatgpt.com/docs/build-skills)

### 2. Workflow/comando `demo`

No confirmé comandos de usuario arbitrarios `/demo` en este CLI. La alternativa funcional es la misma skill anterior, invocada como `$demo`. Los prompts `/prompts:<nombre>` pertenecen a la referencia de comandos de la app de escritorio y no los presento como ejemplo del CLI. [DOC](https://learn.chatgpt.com/docs/reference/slash-commands)

### 3. Subagente `demo`

`/home/cucholambreta/Projects/evol-driven/.codex/agents/demo.toml`

```toml
name = "demo"
description = "Agente de solo lectura para resumir el estado del repositorio."
model = "gpt-6-luna"
model_reasoning_effort = "low"
developer_instructions = "Lee README.md y devuelve el propósito del proyecto y los comandos de desarrollo. No edites archivos."
```

Para fijar un máximo de cuatro hilos subagente en la sesión, se puede usar en `.codex/config.toml`:

```toml
[agents]
max_concurrent_threads_per_session = 4
```

El campo del modelo depende de disponibilidad de cuenta. El TOML personaliza instrucciones/modelo, pero no crea un sandbox más restrictivo que el padre. [DOC](https://learn.chatgpt.com/docs/agent-configuration/subagents)

### 4. Servidor MCP

`/home/cucholambreta/Projects/evol-driven/.codex/config.toml`

```toml
[mcp_servers.docs]
url = "https://example.com/mcp"
enabled_tools = ["search"]
disabled_tools = ["delete"]
default_tools_approval_mode = "prompt"
```

Ejemplo STDIO:

```toml
[mcp_servers.local_docs]
command = "npx"
args = ["-y", "example-mcp-server"]
```

La URL/paquete de ejemplo debe apuntar a un servidor MCP real. [DOC](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

## C. Límites

- La profundidad máxima de anidamiento de subagentes y si un hijo puede crear nietos: [NO SÉ]; no está aclarado en la guía consultada.
- Un agente no obtiene un sandbox más estricto poniendo `sandbox_mode` en su archivo TOML; hereda permisos y sandbox del padre.
- La cantidad máxima de hilos no está fijada en el config observado; se puede configurar. El CLI no informó el default efectivo.
- Las reglas `forbidden` documentadas cubren comandos del shell fuera del sandbox, no constituyen un mecanismo general de lista negra para todos los efectos/herramientas.
- Hooks pueden bloquear llamadas compatibles, pero la propia documentación advierte que hay rutas especializadas que pueden quedar fuera del hook común.
- No confirmé que un `/evol` definido como comando de prompt acepte argumentos ni pueda delegar por sí mismo. Una skill puede describir el flujo y usar las herramientas de agentes que el runtime habilite.
- No confirmé compatibilidad exacta de frontmatter no mínimo (`metadata`, argumentos, etc.) ni carga de `CLAUDE.md`/`GEMINI.md` sin configurar fallbacks.

## D. Dudas y contradicciones

- La documentación oficial sobre instrucciones de proyecto permite fallbacks arbitrarios con `project_doc_fallback_filenames`; eso significa que `CLAUDE.md` se puede habilitar, no que Codex lo lea siempre. El archivo `~/.codex/config.toml` observado solo contiene una opción de TUI, así que aquí no se configuraron.
- La documentación oficial enumera `.agents/skills`, `~/.agents/skills`, `/etc/codex/skills` y skills del sistema. En esta instalación también están visibles skills bajo `~/.codex/skills` y los usa el runtime de esta conversación. Puede ser una extensión de empaquetado del entorno; no extrapolo esa ruta como la ubicación general documentada para skills locales.
- La referencia `/prompts:<nombre>` es de la app de escritorio. No hallé confirmación oficial suficiente de su equivalencia en Codex CLI 0.163.0. El ejemplo portable que sí puedo respaldar es una skill explícita.
- Los docs de MCP describen tanto configuración de usuario como `.codex/config.toml` de proyecto. La configuración de usuario está presente, pero `codex mcp list` confirma que esta instalación no tiene servidores registrados.
- La documentación oficial de subagentes especifica concurrencia configurable y herencia de permisos, pero no hallé un máximo de profundidad ni confirmación del spawn recursivo. No atribuyo al CLI las opciones multi-agent de Agents API como si fueran su contrato.
- No afirmo compatibilidad con Antigravity u OpenCode sin revisar su documentación y versiones; compartir `.agents/skills` y `AGENTS.md` solo ayuda si esas herramientas admiten esas convenciones.

**Fuentes oficiales principales:** [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Skills](https://learn.chatgpt.com/docs/build-skills), [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [Hooks](https://learn.chatgpt.com/docs/hooks), [Rules](https://learn.chatgpt.com/docs/agent-configuration/rules), [Config basics](https://learn.chatgpt.com/docs/config-file/config-basic).
