# Consulta para el agente de OpenCode

> **Cómo usar este archivo.** Abre la carpeta `/home/cucholambreta/Projects/evol-driven` en OpenCode y pega al
> agente: «Lee `docs/design/consultas/consulta-opencode.md` y haz lo que pide». El agente escribirá su respuesta en
> `docs/design/consultas/respuesta-opencode.md`, y yo la leeré de ahí.
>
> Para otro IDE, copia este archivo cambiando «OpenCode» y «opencode» por su nombre.

---

## Instrucciones para el agente

Necesito que investigues **tu propia instalación** y respondas con datos verificables. Es una consulta de
**solo lectura**:

- No modifiques archivos, ajustes ni configuración del IDE ni de ningún proyecto.
- **La única excepción** es el archivo de respuesta: `docs/design/consultas/respuesta-opencode.md`
  (créalo; si existe, reemplázalo).
- Si necesitas probar algo, hazlo dentro de una carpeta temporal nueva y bórrala al terminar.

### Contexto

Estoy diseñando un adaptador para que un orquestador llamado `/evol` funcione en varios IDE. El orquestador lee el
estado de un proyecto, divide el trabajo y lo reparte entre subagentes que aplican «skills» (carpetas con un
`SKILL.md`). Necesito saber qué ofrece OpenCode y cómo se configura, sin suposiciones.

### Reglas de respuesta

- Para cada dato indica su origen:
  - **[DOC]** documentación oficial (con el enlace),
  - **[OBS]** lo observaste en tu instalación (con la ruta del archivo o la salida del comando),
  - **[NO SÉ]** si no puedes confirmarlo.
- No rellenes huecos con lo que «suele ser». Si dos fuentes se contradicen, di cuáles y por qué dudas.
- Indica la **versión** de OpenCode instalada y la **fecha** de hoy.

### Preguntas

1. **Instrucciones de proyecto.** ¿Lees `AGENTS.md`? ¿Dónde (proyecto, global) y con qué prioridad se combinan? ¿Lees
   también `CLAUDE.md`? ¿Qué diferencia hay con el campo `instructions` de la configuración?
2. **Skills.** ¿Soportas carpetas con `SKILL.md`? ¿En qué rutas, a nivel de proyecto y global (`.opencode/skills`,
   `~/.config/opencode`, otras)? ¿Qué campos del frontmatter reconoces? ¿Cómo decides activar una y cargas el contenido
   completo solo al elegirla?
3. **Comandos propios.** ¿Cómo defino un comando tipo `/evol` (por ejemplo en `.opencode/command`)? ¿Cuál es el formato
   (frontmatter y cuerpo), cómo se invoca, acepta argumentos, y puede elegir el agente o el modelo que lo ejecuta?
4. **Agentes y subagentes.** ¿Qué diferencia hay entre agentes primarios y subagentes? ¿Dónde y con qué formato se
   definen (ruta, modo, herramientas, permisos, modelo)? ¿Puede el agente principal delegar en varios a la vez y hay un
   tope? ¿Cada subagente tiene contexto aislado? ¿Puede un subagente crear otros?
5. **MCP.** ¿Cómo se configura en `opencode.json` (usuario y proyecto), con qué formato y transportes (local, remoto)?
   ¿Cómo apruebas o restringes sus herramientas por agente?
6. **Plugins y eventos.** ¿Hay plugins o hooks al iniciar la sesión o antes y después de una herramienta, para inyectar
   el estado del proyecto en el contexto? ¿En qué lenguaje y dónde se definen?
7. **Permisos.** ¿Puedo impedir que el agente ejecute un comando concreto, por ejemplo `evol approve`, aunque yo no lo
   vea? ¿Cómo funcionan los permisos por herramienta y por patrón de comando (`allow`, `ask`, `deny`) y dónde se
   configuran, a nivel global, de proyecto y de agente? ¿Qué pasa si dos niveles se contradicen?
8. **Portabilidad.** ¿Compartes carpeta o configuración con otras herramientas (por ejemplo `.agents/skills` con Codex o
   Antigravity, o `AGENTS.md` con todas)? ¿Qué conflictos podrían aparecer?

### Qué debe contener `respuesta-opencode.md`

Usa exactamente esta estructura, para que pueda leerla sin ambigüedad:

````markdown
# Respuesta de OpenCode

- Versión instalada: …
- Fecha: …

## A. Tabla de respuestas

| # | Tema | Respuesta corta | Ruta exacta | Origen |
|---|------|-----------------|-------------|--------|
| 1 | Instrucciones de proyecto | … | … | [DOC]/[OBS]/[NO SÉ] |
| 2 | Skills | … | … | … |
| 3 | Workflows o comandos | … | … | … |
| 4 | Subagentes | … | … | … |
| 5 | MCP | … | … | … |
| 6 | Ganchos o eventos | … | … | … |
| 7 | Permisos | … | … | … |
| 8 | Portabilidad | … | … | … |

## B. Ejemplos mínimos que funcionan

Solo de lo que SÍ soportes, cada uno en un bloque de código con su ruta completa como título. **No los crees en
mis proyectos.**

1. Una skill `demo` con su `SKILL.md`.
2. Un workflow o comando `demo`.
3. Un subagente `demo` (si existe).
4. La entrada de un servidor MCP de ejemplo.

## C. Límites

Lista de cosas que no puedes hacer y que afectarían a un orquestador que reparte trabajo entre subagentes.

## D. Dudas y contradicciones

Lo que no pudiste confirmar y por qué.
````

Cuando termines, dime solo: «Respuesta escrita en `docs/design/consultas/respuesta-opencode.md`».
