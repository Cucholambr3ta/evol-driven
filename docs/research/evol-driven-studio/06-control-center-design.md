# 06 — Arquitectura del Evol-Driven Control Center (R3)

Principio rector: **el Control Center es una vista y un canal de órdenes; no es una fuente de verdad.** La autoridad de pipeline, aprobaciones y evidencias sigue en Evol-Driven (`.evol/`, Git). Harness aporta host, cliente y sesiones (doc 02).

## 1. Arquitectura host/client

```
Cliente (plugins de UI en slots)         Host (servicios Cordis)                 Núcleo Evol (proceso/libería)
ui-evol-pipeline  ─┐                      evolBridge  (TypertRemoteService)        .evol/, Git, MCP evol_*
ui-evol-approvals ─┼─ RPC @Remote ──────► ├─ lecturas (status, verify, log, trace)  ◄── API TypeScript / CLI --json
ui-evol-memory    ─┤                      ├─ operaciones autorizadas (cola)
ui-evol-code      ─┘  eventos/proyección  └─ evolEvents (proyección de solo lectura)
```
- Un **único** plugin host (`evolBridge`) conoce a Evol-Driven; el cliente nunca toca archivos de `.evol/`.
- Cada operación pasa por un **gate de autorización** del host (rol del operador, doc 09) antes de llegar al núcleo.
- Aprobar sigue requiriendo una persona: el Control Center *presenta* la solicitud (artefactos, hashes, evidencia) y delega la firma en un canal que el agente no puede usar (terminal TTY o confirmación del operador con credencial local). No se firma desde un clic accesible por herramientas del modelo. Esto es una decisión abierta (OD-04).

## 2. Contratos mínimos (propuestos)

```
Project   { id, ruta, nombre, perfil, fase, ciclo, salud }
Pipeline  { fase_declarada, fase_verificada, aprobaciones[], bloqueos[], versión_verificador }
Approval  { seq, fase, ciclo, aprobador, artefactos{ruta→hash}, vigente:boolean, motivo_invalidez? }
Evidence  { id, tipo(prueba|revisión|escaneo), resultado, comando, commit, fecha, hash_salida }
MemoryItem{ id, tipo, texto, fuente, estado, fecha, proveedor }
Symbol    { id, tipo, ruta, línea, frescura{commit, índice_ts} }
WorkItem  { id, título, estado, depende_de[], responsable, evidencia[] }   // ver §3
```
Todas las respuestas incluyen `frescura` (qué commit y cuándo) para distinguir «estado declarado», «verificado» y «evidencia disponible».

## 3. Módulos

| Módulo | Fuente autoritativa | APIs existentes | Operaciones | Permisos | Disponibilidad | Riesgo | Trabajo |
|---|---|---|---|---|---|---|---|
| Project Manager | `evol.config.json`, `.evol/state.json`, home de Harness | `evol status --json`, workspace de Harness | listar/seleccionar proyecto, diagnóstico | Reader | alta (CLI) | descubrimiento de rutas no autorizadas | S |
| Work Manager | **no existe en Evol** (EV-008): hoy solo sprints de documentación | AgentTeams/`team` (tablero y DAG de tareas, dentro de Harness) | crear/consultar trabajos y dependencias | Operator | **requiere decidir la fuente** (doc 07) | duplicar sistema de tareas | L |
| Pipeline Explorer | `state.json` + `gate-log.jsonl` | `evol status/verify/prerequisites --json` | leer fases, gates, historial; comparar declarado vs verificado | Reader | alta; **requiere conciliar estado y log** (EV-006) | mostrar «verde» no verificado | M |
| Memory Control Center | proveedor de memoria | UI propia de dsh-mnemon (reutilizar, no reconstruir) o `MemoryProvider` | buscar, listar, estados, respaldos | Reader/Operator | media | exponer secretos en recuerdos | M |
| Code Intelligence | motor(es) de código | `evol_find_symbol/impact/trace`; CBM por MCP | símbolos, impacto, frescura | Reader | media; hoy **escribe al consultar** (EV-003) | índice obsoleto | M |
| Agent Workspace | sesiones/subagentes de Harness | `ctx.agents`, `session/event`, `ui-subagent` | ver agentes, sesiones, handoffs | Reader/Operator | alta (nativo de Harness) | mezclar proyectos | S |
| Quality & Evidence | informes de `verify`, `coverage`, QA | `evol verify/coverage --json` | pruebas, hallazgos, trazabilidad CA→prueba | Reader | media | cobertura por referencia ≠ cumplimiento (EV-011) | M |
| Approval Center | `gate-log.jsonl` | `evol status`; `ui-approval` de Harness como patrón | solicitudes pendientes, vigencia, historial | Reader/Approver | media; la firma no se delega a la UI | suplantación del aprobador | M |
| System Diagnostics | Harness (`plugin-inventory`), `evol doctor` | `evol doctor`, `evol version --json` | versiones, plugins, servicios, salud | Reader/Admin | alta | — | S |

Tamaños relativos: S < M < L; no hay estimaciones de tiempo (no existe base medible).

## 4. Navegación propuesta

Barra lateral «Evol»: Proyectos → Pipeline → Trabajo → Calidad y evidencias → Aprobaciones → Memoria → Código → Agentes → Sistema. Cada vista muestra arriba el proyecto activo y la **frescura** del dato (commit y hora). Un banner permanente indica «inferencia local: sí/no» (doc 04, §2).

## 5. Qué NO se reconstruye

- La interfaz de memoria de dsh-mnemon (si es el proveedor): se enlaza o se monta su extensión pública.
- El panel de equipos de agentes de AgentTeams: se reutiliza.
- El visor de grafos de CBM (si se adopta): se enlaza (`localhost:9749`) con las salvedades de seguridad del doc 09.

## 6. Comprobaciones pendientes

Prototipar `evolBridge` con una sola lectura (`status`) y un panel de cliente; medir arranque, descarga limpia y comportamiento con dos proyectos. Verificar que el cliente puede suscribirse a cambios del log sin sondeo.
