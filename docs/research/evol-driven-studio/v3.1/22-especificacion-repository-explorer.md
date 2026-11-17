# 22 — Especificación del Evol Repository Explorer (OD-27)

Estado: **especificación documental; ningún código.** Decisión **OD-27 confirmada por el propietario** (directiva v3.1 §7). Nombre provisional: **Evol Repository Explorer**. Ubicación propuesta en el Control Center: **Proyectos → Repositorio**.

## 1. Alcance del MVP

**Solo lectura.** Visualiza el historial Git y la actividad GitHub del proyecto y los relaciona con Pipeline, tareas, criterios de aceptación y evidencias. **No** crea un motor Git; **no** hace `push`, `merge`, `rebase`, `reset`, `checkout` ni borrado de ramas; **no** guarda tokens en lugares accesibles a los agentes.

| Fuente | Rol | Disponibilidad |
|---|---|---|
| **Git local** | Fuente primaria de historial: commits, ramas, etiquetas, diferencias, autores | **Sin conexión**; siempre disponible |
| **GitHub API** | Complemento **opcional**: PR, issues, Actions, releases, contribuidores y actividad | Requiere red y, si el repositorio es privado o se necesitan más cuotas, un token |

Sin red o sin token, la vista funciona con Git local y marca el complemento como «no disponible» (nunca presenta datos simulados como reales).

## 2. Pantallas

| Pantalla | Contenido | Fuente |
|---|---|---|
| Resumen del repositorio | rama actual, `HEAD`, estado limpio/sucio, remotos (solo lectura), último release, actividad reciente | Git local; GitHub opcional |
| README | render saneado del README del proyecto | Git local |
| Historial de commits | lista paginada con autor, fecha, mensaje, **trailer `CA:`** (OD-12), verificación de firma si existe | Git local |
| Ramas y comparaciones | ramas, divergencia, comparación entre dos revisiones (lista de archivos y diff de solo lectura) | Git local |
| Pull requests | estado, revisiones, checks, vínculo con tareas | GitHub opcional |
| Issues | lista y etiquetas, vínculo con CA | GitHub opcional |
| GitHub Actions | ejecuciones, resultado, duración | GitHub opcional |
| Releases y tags | etiquetas locales y releases remotos; **firma de etiquetas** (alineado con CA-142/143) | Git local; GitHub opcional |
| Contribuidores | autores y volumen (sin datos personales innecesarios) | Git local; GitHub opcional |
| Historial de actividad | línea de tiempo combinada | ambos, con la procedencia visible de cada dato |
| **Relación commit ↔ tarea ↔ CA ↔ evidencia** | para un commit: sus tareas de AgentTeams, los CA que cita, las pruebas y la evidencia de verificación asociadas | Git + registros de Evol (ver §4) |

## 3. Arquitectura

- **Plugin propio** del Control Center (doc 09), módulo `repository`. Consume **contratos JSON versionados** (OD-15); no lee directamente bases de terceros ni archivos protegidos (OD-17).
- **Conector Git local:** ejecuta el binario `git` instalado con una **lista de permitidos de subcomandos y argumentos de solo lectura** (`log`, `show`, `diff`, `branch --list`, `tag --list`, `for-each-ref`, `rev-parse`, `status --porcelain`, `shortlog`, `cat-file -p`), sin shell, con tiempo máximo y salida acotada. **No** se usa ningún subcomando que escriba (`add`, `commit`, `push`, `fetch` con escritura de referencias, `gc`, `config --global`…). `git fetch` queda fuera del MVP (modificaría referencias).
- **Conector GitHub:** cliente HTTP de solo lectura con una lista de **endpoints permitidos** (métodos `GET`), paginación y límites de frecuencia, caché con vigencia visible. Todos los textos remotos (títulos, cuerpos, comentarios) son **datos no confiables**: se sanean al mostrarse (T-14…T-20 aplican).
- **Contrato de datos:** sección «repositorio» de `evol export --json` (esquema versionado, EV-066) y consultas del plugin con su propio esquema `repo-view/1`.
- **Permisos por efectos (doc 10):** lectura de Git local = **LS** (lanza un proceso de solo consulta) → **Operator** hasta probar su aislamiento; la vista guardada puede ser Reader; GitHub = **LS con red** → Operator, con indicador de salida de datos.

## 4. Relación con Pipeline, tareas, CA y evidencias

| Vínculo | Cómo se obtiene | Estado |
|---|---|---|
| Commit → CA | trailer `CA:` (OD-12; propuesta, hook y excepciones pendientes) | pendiente de OD-12 |
| Commit → tarea | metadatos de la tarea de AgentTeams con el `sha` del commit que produjo; o trailer `Task:` propuesto | **propuesta**; depende de la prueba de AgentTeams en Tanda 1 |
| CA → pruebas | `evol coverage` (criterio→escenario→prueba) | existe |
| Fase → aprobación | `gate-log` (cadena verificada por la biblioteca de verificación, doc 11) | existe; mejora con Ed25519 |
| Commit → evidencia | resultado de `verify`/escaneos asociado al `HEAD` del momento | por definir en Tanda 2 |

Cuando un vínculo no existe, la pantalla dice «sin vínculo registrado» y **no lo infiere**.

## 5. Seguridad

1. **Tokens de GitHub (S-27-1, propuesta del propietario pendiente de confirmación formal): GitHub público sin token; repositorios privados mediante un servicio protegido y permisos mínimos.** No se guardan en el proyecto, en `.evol/`, en la memoria ni en archivos legibles por los agentes. Custodia propuesta: **almacén de credenciales gestionado por el broker/servicio protegido** (cuenta separada, doc 11 §7), que **realiza las llamadas** de la lista permitida y devuelve solo los datos; el plugin nunca recibe el token. Alternativa mínima: usar solo repositorios públicos sin token. Un token con permisos de escritura **se rechaza** (se piden permisos de solo lectura; se detectan y se avisa). Viabilidad del almacén protegido: **pendiente de validación** (misma condición que el aislamiento del broker).
2. **Sin escritura.** Pruebas: el plugin no contiene ni expone operaciones de escritura (`push`, `merge`, `delete`); el conector rechaza cualquier subcomando fuera de la lista.
3. **Saneado.** README y textos remotos se muestran sin HTML activo ni enlaces automáticos peligrosos; nombres de ramas y autores se sanean como los demás nombres (T-20).
4. **Datos personales.** Correos y nombres de autores se muestran truncados y configurables; no se exportan por defecto en `evol export --json`.
5. **Salida de datos.** Cualquier llamada remota declara destino y se lista en Diagnósticos (N-15, N-22).
6. **Privacidad de repositorios privados.** La actividad de un repositorio privado no se muestra en una vista compartida sin permiso.

## 6. Criterios de aceptación (RE-n; pruebas pendientes)

| ID | Criterio |
|---|---|
| RE-01 | Con red cortada, todas las pantallas de Git local funcionan; las de GitHub dicen «no disponible» |
| RE-02 | Ningún subcomando de escritura de Git puede ejecutarse desde el plugin (prueba de lista de permitidos y de hash de `.git` antes/después) |
| RE-03 | Ningún endpoint de GitHub distinto de `GET` permitido se invoca |
| RE-04 | El token no aparece en el proyecto, en `.evol/`, en la memoria, en el entorno de un agente ni en los registros |
| RE-05 | El historial muestra el trailer `CA:` cuando existe y «sin vínculo» cuando no |
| RE-06 | Un commit con CA, tarea y evidencia enlazados navega a cada uno; los ausentes no se inventan |
| RE-07 | Los textos remotos hostiles (HTML, ANSI, bidi) se muestran saneados |
| RE-08 | Un repositorio grande (límites a medir) pagina sin bloquear la interfaz |
| RE-09 | Permisos: un Reader sin vista guardada no puede lanzar el conector; un agente no puede invocar el plugin con escritura |
| RE-10 | Cada dato se muestra con su procedencia (local, remota, caché con fecha) |
| RE-11 | Accesibilidad: navegación por teclado y lector de pantalla (doc 23) |
| RE-12 | `evol export --json` incluye la sección de repositorio sin datos personales por defecto |

## 7. Fuera de alcance del MVP

Cualquier escritura en Git o GitHub, creación de PR o issues, comentarios, `fetch` automático, análisis de código por `blame` en lote, integraciones con otros proveedores (GitLab, Gitea). Se registran como mejoras posteriores (doc 17, sección D).

## 8. Plan de entrega

No pertenece a la Tanda 1. Entra en la **Tanda 2 después del Control Center básico** (hito nuevo H8b en el doc 15), porque depende de contratos JSON de `core`, de la tabla única de permisos y, para los vínculos con tareas, de la prueba de AgentTeams. Una versión mínima (solo Git local) puede adelantarse a H8 si los contratos están listos.
