# Consulta para el agente de Antigravity

> **Cómo usar este archivo.** Abre la carpeta `/home/cucholambreta/Projects/evol-driven` en Antigravity y pega al
> agente: «Lee `docs/design/consultas/consulta-antigravity.md` y haz lo que pide». El agente escribirá su respuesta en
> `docs/design/consultas/respuesta-antigravity.md`, y yo la leeré de ahí.
>
> Para otro IDE, copia este archivo cambiando «Antigravity» y «antigravity» por su nombre.

---

## Instrucciones para el agente

Necesito que investigues **tu propia instalación** y respondas con datos verificables. Es una consulta de
**solo lectura**:

- No modifiques archivos, ajustes ni configuración del IDE ni de ningún proyecto.
- **La única excepción** es el archivo de respuesta: `docs/design/consultas/respuesta-antigravity.md`
  (créalo; si existe, reemplázalo).
- Si necesitas probar algo, hazlo dentro de una carpeta temporal nueva y bórrala al terminar.

### Contexto

Estoy diseñando un adaptador para que un orquestador llamado `/evol` funcione en varios IDE. El orquestador lee el
estado de un proyecto, divide el trabajo y lo reparte entre subagentes que aplican «skills» (carpetas con un
`SKILL.md`). Necesito saber qué ofrece Antigravity y cómo se configura, sin suposiciones.

### Reglas de respuesta

- Para cada dato indica su origen:
  - **[DOC]** documentación oficial (con el enlace),
  - **[OBS]** lo observaste en tu instalación (con la ruta del archivo o la salida del comando),
  - **[NO SÉ]** si no puedes confirmarlo.
- No rellenes huecos con lo que «suele ser». Si dos fuentes se contradicen, di cuáles y por qué dudas.
- Indica la **versión** de Antigravity instalada y la **fecha** de hoy.

### Preguntas

1. **Instrucciones de proyecto.** ¿Lees `AGENTS.md`, `GEMINI.md` o ambos? ¿Dónde viven las reglas (carpeta exacta:
   `.agent` o `.agents`, y si es `rules`)? ¿Cuál tiene prioridad si hay varios, y cómo se reparte el nivel global frente
   al de proyecto?
2. **Skills.** ¿Soportas carpetas con `SKILL.md`? ¿En qué rutas, a nivel de proyecto y global? ¿Qué campos del
   frontmatter reconoces (`name`, `description`, otros)? ¿Cómo decides activar una: automáticamente por la descripción,
   por invocación explícita o ambas? ¿Cargas el contenido completo solo cuando la eliges?
3. **Workflows o comandos.** ¿Existe algo equivalente a un comando propio como `/evol`? ¿En qué carpeta se define, cómo
   se invoca, acepta argumentos y puede encadenar pasos o llamar a otros agentes o skills?
4. **Subagentes.** ¿Tienes subagentes o agentes personalizados? ¿Dónde y con qué formato se definen (ruta y campos del
   frontmatter)? ¿Puede un agente principal delegar en varios a la vez? ¿Hay un tope de concurrencia? ¿Cada subagente
   tiene contexto aislado y herramientas restringidas? ¿Puede un subagente crear otros?
5. **MCP.** ¿Dónde se configura (archivo y formato) a nivel de proyecto y global? ¿Qué transportes aceptas (stdio,
   HTTP)? ¿Cómo apruebas o restringes las herramientas de un servidor?
6. **Ganchos o eventos.** ¿Hay algo que se ejecute al empezar una sesión, o antes y después de una herramienta
   (hooks), para inyectar el estado del proyecto en el contexto?
7. **Permisos.** ¿Puedo impedir que el agente ejecute un comando concreto de terminal, por ejemplo `evol approve`, aunque
   yo no lo vea? ¿Dónde se configura esa lista de bloqueo y cómo se comporta (pide confirmación, deniega o ignora)?
8. **Portabilidad.** ¿Compartes carpeta o configuración con otras herramientas (por ejemplo `.agents/skills` con Codex u
   OpenCode)? ¿Qué conflictos podrían aparecer?

### Qué debe contener `respuesta-antigravity.md`

Usa exactamente esta estructura, para que pueda leerla sin ambigüedad:

````markdown
# Respuesta de Antigravity

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

Cuando termines, dime solo: «Respuesta escrita en `docs/design/consultas/respuesta-antigravity.md`».
