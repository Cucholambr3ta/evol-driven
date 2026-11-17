# 08 — Contratos de memoria, indexación y workers

## 1. Configuración objetivo inicial

| Responsabilidad | Implementación | Estado | Alternativas / notas |
|---|---|---|---|
| Memoria contextual | dsh-mnemon + Mnemon Native | baseline propuesta (OD-03) | MemPalace y Engram para instalaciones existentes; sin migrar |
| Memoria de código | Codebase Memory MCP (+ puente `dsh-codebase-memory-mcp`) | baseline propuesta (OD-05) | motor nativo de Evol conservado para el vínculo código↔tarea↔prueba↔CA |
| Historial de sesiones | `dsh-deja` / deja-vu (MIT) | propuesta; **alcance limitado** (EV-040) | — |
| Documentos | *Project Documents* de dsh-mnemon | propuesta | — |
| Evidencia documental especializada | «dsh-evidence» | **no encontrado (EV-041); fuera de baseline** | la evidencia la gobierna Evol |
| Gobernanza | Evol-Driven Core | vigente | — |

Una responsabilidad = un proveedor. **Sin escritura duplicada** y sin captura automática concurrente de varios sistemas (MemPalace tiene auto-minado en este equipo: debe desactivarse para el proyecto o excluirse el directorio).

## 2. Contrato mínimo común (campos)

`project_id, workspace_id, repository_id, agent_id, session_id, task_id, phase, commit_sha, source_ref, evidence_ref, updated_at, freshness`.

| Campo | Para qué | Quién lo fija |
|---|---|---|
| `project_id` / `workspace_id` / `repository_id` | aislamiento y filtros **aplicados en el backend** | Studio |
| `agent_id` / `session_id` / `task_id` | autoría y trazabilidad | AgentTeams/DSH |
| `phase` | contexto de la fase | Core |
| `commit_sha` | revisión del código al guardar/indexar | Git |
| `source_ref` | de dónde sale el dato (archivo:línea, URL, id de sesión) | adaptador |
| `evidence_ref` | enlace a evidencia **ejecutada** (nunca texto libre) | Core |
| `updated_at`, `freshness` | vigencia; `freshness` ∈ {actual, obsoleta, desconocida} calculada contra `HEAD` y mtime | adaptador |

**No se crea una base de datos que duplique los almacenes.** El adaptador guarda solo punteros y metadatos de enlace, y delega contenido al proveedor.

## 3. Operaciones por contrato

**ContextMemory** (proveedor contextual): `search(query, filtros, max_tokens)`, `get(id)`, `propose(item)` (escritura con permiso y política), `supersede(id, nuevo)`, `invalidate(id, motivo)`, `health()`, `backup()/restore()`. Cada elemento lleva `fuente`, `estado ∈ {propuesto, vigente, reemplazado}`, `fecha`, `revisar_después`.
**CodeIntel** (motor de código): `index(repo, modo)`, `status(repo) → {commit_sha, freshness}`, `find_symbol`, `callers/callees`, `impact(symbol|file)`, `search(text|semántica)`; **solo lectura salvo `index`**.
**SessionHistory**: `search(query, ámbito)`; ámbito = lista cerrada de directorios/sesiones autorizadas.

Separación lectura/escritura: las operaciones de lectura se exponen a Reader; `propose`, `supersede`, `invalidate`, `index` requieren Operator y quedan registradas.

## 4. Política de escritura de memoria

1. Los agentes **proponen**; la persona o un revisor autorizado promueve a «vigente».
2. Todo elemento requiere `fuente` (commit, `seq`, archivo, URL, sesión) y `tipo`.
3. Se separa: **observado**, **hipótesis**, **validado**, **obsoleto**. Solo «validado» entra por defecto en el contexto de un prompt.
4. Filtro de secretos antes de guardar; rechazo o enmascarado.
5. Deduplicación al guardar; reemplazo con `supersede`.
6. La memoria **nunca** sustituye evidencia de verificación (invariante).
7. Las lecciones de retro entran con procedencia y permisos (doc 04, fase retro).

## 5. Recuperación contextual (no volcar memoria en el prompt)

Orden: id exacto → coincidencia por nombre/clave → búsqueda del proveedor con `max_tokens` → vecindad de grafo. Límite de contexto por tarea fijado en la spec; al 80 % se emite checkpoint calculado. Los índices **no sustituyen** al código fuente: para modificar, el agente lee el archivo.

## 6. Aislamiento (controles efectivos, no nombres)

- Un almacén/instancia **por proyecto** (Mnemon: `MNEMON_STORE`/`MNEMON_DATA_DIR` distintos; CBM: caché por proyecto y **no** daemon compartido por cuenta, o aislamiento demostrado — riesgo EV-027).
- El filtrado por `project_id` ocurre en `studioBridge` y se prueba con consultas cruzadas (0 fugas).
- Un nombre de wing o namespace **no autoriza** nada (lo muestra el estado actual: 3 wings del mismo proyecto en MemPalace).

## 7. Funcionamiento local y flujo de datos

| Flujo | Local | Observación |
|---|---|---|
| Almacenamiento, índice, recuperación | sí | requisito |
| Embeddings | opcionales; Ollama/servidor local; endpoint explícito | Mnemon por defecto `localhost:11434` |
| Actualizaciones/versiones | **desactivadas** (`ENGRAM_NO_UPDATE_CHECK`, comprobación de versiones de dsh-mnemon solo manual, actualización de deja-vu desactivada) | EV-025, 031, 040 |
| Inferencia con contexto recuperado | local o **remota explícita** | la UI muestra «inferencia remota» cuando aplique; no equivale a privacidad integral |

## 8. Workers y política operacional (OD-23)

Ver doc 05 §2. Resumen operativo:
- **Eventos que disparan indexación:** proyecto incorporado, índice ausente, cambio de `HEAD`/rama, solicitud explícita, consulta que exige datos recientes y el índice es obsoleto.
- **Agrupación:** solicitudes redundantes se fusionan (clave `repo+commit`).
- **Concurrencia:** cola con límite; sin dos indexaciones del mismo repositorio.
- **Cancelación y reintento:** disponibles; los fallos se registran y se muestran como frescura obsoleta.
- **Frescura visible** en Code Intelligence, Memory Center y Dashboard.

## 9. Riesgos

Inyección persistente por recuerdos o documentos indexados (tratar como datos); deja-vu lee transcripciones de otros agentes (lista cerrada obligatoria); doble captura entre MemPalace y dsh-mnemon; CBM escribe configuración de agentes en su instalación; recuerdos sin fuente.

## 10. Pruebas necesarias

Aislamiento por proyecto (consultas cruzadas), sin red durante indexación y recuperación (captura de tráfico), reinicio y restauración de copias, deduplicación, vigencia (decisión reemplazada), frescura tras cambio de rama, secretos rechazados, ningún recuerdo sin fuente.
