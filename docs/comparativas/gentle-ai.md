# evol frente a gentle-ai

Escrito para: quien mantiene evol (para decidir qué mejorar), no para quien lo usa.

**Fuentes.** De gentle-ai: su README, `docs/components.md`, `docs/intended-usage.md`, `docs/telemetry.md`, `go.mod`, la licencia y el árbol de archivos de un clon
(`v4.2.0` más 252 commits, último commit del 2026-10-24). De evol: este repositorio. **No se leyó** el código de la revisión RDD, de la lista de bloqueo ni del script
de instalación de gentle-ai, y no se ejecutó nada suyo. Sus cifras de coste y calidad son suyas (una sola ejecución por caso). Lo que no consta se marca «no consta».

## 1. Comparación neutral

| Aspecto                           | evol                                                                                                              | gentle-ai                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qué es                            | Pipeline de seis fases con aprobación humana, 31 disciplinas y una biblioteca de skills auditadas                 | «Entorno de ingeniería determinista» para el agente que ya usas: memoria, flujo, revisión y skills                                                 |
| Lenguaje y reparto                | TypeScript, Node 24. Una copia estable de solo lectura y un origen separados                                      | Go, un binario. Brew, `curl \| bash` o `go install`                                                                                                |
| Licencia y madurez                | Privado (`UNLICENSED`), un mantenedor, serie 0.3, ~1.080 pruebas                                                  | MIT, muchos colaboradores, v4.2.0, 1.898 archivos de Go                                                                                            |
| Agentes que configura             | 5 (Claude Code, Codex, Antigravity, OpenCode, Hermes)                                                             | 17, entre ellos Pi, Cursor, Gemini CLI, Kiro y Windsurf                                                                                            |
| Flujo de trabajo                  | Seis fases (briefing a retro), cada una con artefactos que verifica `evol verify` y que aprueba una persona       | ODD: las peticiones pequeñas van directas; las grandes llevan un documento de tarea; preguntas y revisiones son de solo lectura                    |
| Aprobación                        | Registro firmado; `evol approve` y `evol next` exigen una persona en una terminal; el agente los tiene bloqueados | La entrega (commit, push, release) es siempre decisión de la persona; la revisión es informativa                                                   |
| Memoria                           | MemPalace (externo): hitos del pipeline y lo que el agente guarda a mano; más `evol checkpoint`                   | Engram: el agente guarda lo que aprende sobre la marcha; busca ahí antes de preguntarte                                                            |
| Continuar tras cortarse un agente | `evol checkpoint` y `evol handoff` (sin modelo): fase, git, archivos sin commit y nota                            | Documento de tarea `odd/tasks/<x>.md` escrito antes de tocar código, y una copia en Engram                                                         |
| Revisión                          | `evol verify` determinista (PASS, WARN o BLOCK) y un agente auditor aparte                                        | RDD: congela el cambio, evalúa el riesgo y revisa con subagentes (4R). Usa el modelo, es informativa                                               |
| Delegación                        | Roles con subagentes de solo lectura; el tope de concurrencia por proyecto **no está construido**                 | Solo con una razón nombrada (exploración, escritores en paralelo, contexto, verificador); la regla salió de benchmarks                             |
| Skills                            | 60, auditadas por reglas (semgrep, gitleaks) y una segunda lectura, y **aprobadas una a una** por una persona     | Biblioteca curada embebida en el binario; registro de skills con disparadores                                                                      |
| Seguridad del proyecto            | `evol security scan` con siete áreas (secretos, código, dependencias, contenedores, licencias, API, TLS)          | Lista de bloqueo de rutas sensibles (`~/.ssh`, `.env*`, `*.pem`…) en Claude Code y OpenCode; reconoce que leer un secreto por `bash` no se bloquea |
| Conocimiento externo              | `evol knowledge`: fuentes con origen, licencia y fecha, índice local con embeddings locales                       | Context7: documentación viva, consultada en un servicio remoto (opcional)                                                                          |
| Copias de seguridad               | Una skill reemplazada se aparta (nunca se borra). `evol agents` **no** copia antes de fusionar tus archivos       | Copia de la configuración antes de cada escritura                                                                                                  |
| Actualización                     | `evol update` desde una etiqueta firmada con SSH, con confirmación y vuelta atrás; lista lo que pierde aprobación | `update`, `sync --dry-run` y `rollback`; versiones firmadas con minisign                                                                           |
| Telemetría                        | Ninguna                                                                                                           | Sí, con opt-out: instalaciones vivas y métricas de ejecución (modelo, tokens)                                                                      |
| Sistemas operativos               | Linux (el único probado)                                                                                          | macOS, Linux y Windows                                                                                                                             |

## 2. La comparación con sus propios criterios, y qué mejorar en evol

Cada fila toma un principio que gentle-ai defiende, mide cómo lo cumple hoy evol y propone una mejora. «Esfuerzo» es una estimación relativa, no un plazo.

| Principio de gentle-ai                                                         | Cómo está evol hoy                                                                                                                     | Mejora propuesta                                                                                                                                           | Esfuerzo |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Copia de seguridad antes de cada escritura**                                 | `evol agents` fusiona `.claude/settings.json`, `.mcp.json` y el bloque de `CLAUDE.md` sin dejar copia                                  | Guardar una copia en `.evol/respaldos/` antes de cada fusión y un `evol agents --deshacer`                                                                 | Bajo     |
| **Lista de bloqueo de rutas sensibles**                                        | Solo bloquea `evol approve`, `evol next` y editar la copia instalada                                                                   | Añadir por defecto al permiso de los agentes `~/.ssh`, `**/.env*`, `**/*.pem`, `**/*.key`, y decir con claridad que leer por `bash` no se bloquea          | Bajo     |
| **Limpiar lo retirado sin borrar lo editado** (como su paso de SDD a ODD)      | `evol update` aparta la skill cambiada, pero no revisa los archivos que `evol agents` generó en cada proyecto con una versión anterior | Al refrescar, comparar cada archivo con las plantillas de versiones publicadas: reemplazar solo el que no se editó e informar del resto como acción manual | Medio    |
| **Mantener pequeño el trabajo pequeño**                                        | Todo pasa por las seis fases y sus aprobaciones, incluso un cambio de una línea                                                        | Un modo ligero: los cambios pequeños y comprendidos van en línea, sin artefactos ni aprobación; el pipeline queda para lo sustancial                       | Alto     |
| **Profundidad de revisión según el riesgo**                                    | `evol verify` aplica lo mismo a todo, aunque `evol risk` ya calcula el riesgo de cada archivo                                          | Que la verificación y el auditor escalen: poca profundidad para lo de poco riesgo y la completa para lo crítico                                            | Medio    |
| **Evidencia atada al candidato exacto** (recibos RDD)                          | La aprobación queda obsoleta si cambian los artefactos, pero el informe del auditor no queda atado a un commit                         | Un recibo (commit, resultado de `evol verify` y huella) que escribe el auditor y que `evol approve` muestra                                                | Medio    |
| **Delegar solo con una razón, y medirlo**                                      | Los roles existen, pero sin reglas de cuándo delegar, y el tope de concurrencia por proyecto está sin construir                        | Escribir los disparadores y medir el coste por escenario (te importa el gasto en tokens)                                                                   | Medio    |
| **Memoria guardada sobre la marcha**                                           | Se guarda en hitos y a mano; `evol checkpoint` depende de que el agente lo llame, y OpenCode no tiene hook                             | Guardar el checkpoint de forma automática al cerrar o compactar la sesión de Claude Code; comprobar si un plugin de OpenCode puede hacer lo mismo          | Medio    |
| **Pruebas deterministas del propio agente** (benchmarks con aceptación oculta) | Hay 224 casos de evaluación de skills, pero no hay un banco que mida el coste y la calidad de un flujo completo                        | Un banco pequeño con escenarios fijos y pruebas ocultas, que se ejecute en cada versión                                                                    | Alto     |
| **Procedencia de las versiones**                                               | La etiqueta va firmada, pero no hay SBOM ni sumas de comprobación de lo que se publica                                                 | Generar con `syft` un SBOM y las sumas, firmarlos con la misma clave y verificarlos en `evol update`                                                       | Bajo     |

## 3. Lo que evol hace mejor o distinto, y se mantiene

- **La aprobación es de una persona y es verificable:** registro firmado, ligado al contenido de los artefactos.
- **Sin telemetría.** gentle-ai la documenta con mucho detalle, pero la envía por defecto.
- **Auditoría de skills con una persona que aprueba cada una,** frente a una biblioteca embebida en el binario.
- **Procedencia del conocimiento externo** (origen, licencia, fecha) y consulta local sin red.

## 4. Lo que no se debe copiar

- **El `curl | bash` como vía de instalación.**
- **La telemetría activada por defecto.**
- **Conectar un servicio remoto de documentación sin declarar qué consultas salen.**

## Qué falta para cerrar esta comparación

Leer el código de la revisión RDD y de la lista de bloqueo, y el script de instalación; probar su revisión sobre un proyecto de prueba (con la telemetría
desactivada y fuera de `Evol-OS`) y comparar sus hallazgos con los del auditor de evol sobre el mismo cambio.
