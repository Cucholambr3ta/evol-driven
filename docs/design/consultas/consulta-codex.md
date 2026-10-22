# Consulta para el agente de Codex

> **Cómo usar este archivo.** Abre la carpeta `/home/cucholambreta/Projects/evol-driven` en Codex y pega al
> agente: «Lee `docs/design/consultas/consulta-codex.md` y haz lo que pide». El agente escribirá su respuesta en
> `docs/design/consultas/respuesta-codex.md`, y yo la leeré de ahí.
>
> Para otro IDE, copia este archivo cambiando «Codex» y «codex» por su nombre.

---

## Instrucciones para el agente

Necesito que investigues **tu propia instalación** y respondas con datos verificables. Es una consulta de
**solo lectura**:

- No modifiques archivos, ajustes ni configuración del IDE ni de ningún proyecto.
- **La única excepción** es el archivo de respuesta: `docs/design/consultas/respuesta-codex.md`
  (créalo; si existe, reemplázalo).
- Si necesitas probar algo, hazlo dentro de una carpeta temporal nueva y bórrala al terminar.

### Contexto

Estoy diseñando un adaptador para que un orquestador llamado `/evol` funcione en varios IDE. El orquestador lee el
estado de un proyecto, divide el trabajo y lo reparte entre subagentes que aplican «skills» (carpetas con un
`SKILL.md`). Necesito saber qué ofrece Codex y cómo se configura, sin suposiciones.

### Reglas de respuesta

- Para cada dato indica su origen:
  - **[DOC]** documentación oficial (con el enlace),
  - **[OBS]** lo observaste en tu instalación (con la ruta del archivo o la salida del comando),
  - **[NO SÉ]** si no puedes confirmarlo.
- No rellenes huecos con lo que «suele ser». Si dos fuentes se contradicen, di cuáles y por qué dudas.
- Indica la **versión** de Codex instalada y la **fecha** de hoy.

### Preguntas

1. **Instrucciones de proyecto.** ¿Lees `AGENTS.md`? ¿Dónde (proyecto, carpetas anidadas, `~/.codex`) y con qué
   prioridad se combinan? ¿Hay un límite de tamaño? ¿Lees también `CLAUDE.md` o `GEMINI.md`?
2. **Skills.** ¿Soportas carpetas con `SKILL.md`? ¿En qué rutas, a nivel de proyecto y global (`~/.codex/skills`,
   `.agents/skills`, otras)? ¿Qué campos del frontmatter reconoces? ¿Cómo decides activar una: automáticamente por la
   descripción, por invocación explícita o ambas? ¿Cargas el contenido completo solo cuando la eliges?
3. **Comandos propios.** ¿Cómo expongo un punto de entrada tipo `/evol`: prompts personalizados, skills u otro
   mecanismo? ¿En qué carpeta se define, cómo se invoca, acepta argumentos y puede llamar a otros agentes o skills?
4. **Subagentes.** ¿Tienes subagentes? ¿Dónde y con qué formato se definen (por ejemplo `.codex/agents/*.toml`: ruta,
   claves y tipos)? ¿Puede el agente principal delegar en varios a la vez? ¿Qué topes existen (hilos, profundidad)?
   ¿Cada subagente tiene contexto aislado, herramientas restringidas y modelo propio? ¿Puede un subagente crear otros?
5. **MCP.** ¿Cómo se configura en `config.toml` (a nivel de usuario y de proyecto), con qué formato y transportes
   (stdio, HTTP)? ¿Cómo apruebas o restringes las herramientas de un servidor?
6. **Ganchos o eventos.** ¿Hay hooks al iniciar la sesión o antes y después de una herramienta, para inyectar el estado
   del proyecto en el contexto? ¿Y notificaciones al terminar un turno?
7. **Permisos.** ¿Puedo impedir que el agente ejecute un comando concreto, por ejemplo `evol approve`, aunque yo no lo
   vea? ¿Cómo interactúan la política de aprobación, el sandbox y las reglas de comandos? ¿Dónde se configura la lista
   de bloqueo y cómo se comporta (pide confirmación, deniega o ignora)?
8. **Portabilidad.** ¿Compartes carpeta o configuración con otras herramientas (por ejemplo `.agents/skills` con
   Antigravity u OpenCode, o `AGENTS.md` con todas)? ¿Qué conflictos podrían aparecer?

### Qué debe contener `respuesta-codex.md`

Usa exactamente esta estructura, para que pueda leerla sin ambigüedad:

````markdown
# Respuesta de Codex

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

Cuando termines, dime solo: «Respuesta escrita en `docs/design/consultas/respuesta-codex.md`».
