# 03 — Panorama de memoria conversacional (R2, parte 1)

Candidatos: **dsh-mnemon + Mnemon Native**, **Engram**, **MemPalace** (el actual). Evidencia: EV-012, 013, 023, 024, 025. Ninguno se ejecutó en esta investigación; las respuestas son lectura de código y documentación, y el benchmark (doc 11) las confirmará o refutará.

## 1. Qué es cada uno

| | MemPalace 3.11.0 (instalado; 3.12.0 publicada) | Engram 3.6.0 (instalado; 3.7.2 publicada) | Mnemon Native (Go, Apache-2.0) | dsh-mnemon 0.5.46 (MIT) |
|---|---|---|---|---|
| Rol | memoria actual de evol, vía MCP | memoria para agentes de código, MCP/CLI | motor de memoria local de 4 grafos | plugin DSH: estrategia, fuentes y UI sobre uno o más proveedores |
| Almacén | Chroma + SQLite (`~/.mempalace/palace`) | SQLite + FTS5 (`~/.engram/engram.db`) | SQLite `modernc` en `~/.mnemon` | delega en el proveedor; global, por workspace o carpeta propia; copia ZIP |
| Búsqueda | semántica (embeddings) + léxica | léxica (FTS5) | léxica y de grafo; embeddings **opcionales** (Ollama local u OpenAI-compatible) | según proveedor + «Project Documents» |
| Estado de recuerdos | grafo temporal (`kg_supersede`, `invalidate`) separado de los cajones | tipos, `topic_key`, versiones, relaciones, `review_after`, anclado | decaimiento de importancia, deduplicación exacta, GC, recibos hash | edición en UI, un clic «guardar en memoria» con agente de tarea que deduplica |
| Integración | MCP | MCP, CLI, HTTP, TUI | CLI, `mnemon web`, API de admin/inspección | plugin Cordis host+client; UI «Memory System» |
| Instalación | Python/uv, descarga de modelos | un binario Go | un binario Go (también por npm) | npm + el CLI de Mnemon para Mnemon Native |

## 2. Preguntas obligatorias (§9.1)

| # | Pregunta | Respuesta con evidencia | Clase |
|---|---|---|---|
| 1 | ¿Evol puede leer/escribir por API pública sin la UI de Harness? | **Mnemon**: sí, por su CLI y su API de admin/inspección (`docs/admin-api.md`, `inspect-api.md`); es independiente de DSH. **dsh-mnemon**: su contrato público son «SDKs públicos» para plugins DSH; no se verificó una API fuera de DSH. **Engram**: sí (CLI, MCP, HTTP). **MemPalace**: sí (MCP, ya integrado) | VERIFIED (Mnemon, Engram) / UNVERIFIED (dsh-mnemon) |
| 2 | ¿Varios agentes comparten recuerdos? | Mnemon: un único `~/.mnemon` compartido por defecto; almacenes con nombre por proceso (`MNEMON_STORE`) | DOCUMENTED |
| 3 | ¿Cómo se separan los proyectos? | Mnemon: almacenes con nombre; dsh-mnemon: almacenamiento por workspace; Engram: campo `project`; MemPalace: wing (en esta máquina, **tres nombres para el mismo proyecto**) | DOCUMENTED / VERIFIED (MemPalace) |
| 4 | ¿Escrituras simultáneas? | SQLite en los tres motores locales; no se verificó política de bloqueo ni `busy_timeout` | UNVERIFIED |
| 5 | ¿Conflictos? | Engram: `memory_relations` y juicio de conflictos (`mem_judge`); Mnemon: deduplicación exacta + sugerencias de similitud; MemPalace: `kg_supersede` | DOCUMENTED |
| 6 | ¿Actualizar, invalidar, eliminar? | Los tres ofrecen operaciones de actualización/borrado; Engram borrado lógico por defecto; Mnemon GC por retención | DOCUMENTED |
| 7 | ¿Recuperación tras interrupción? | SQLite WAL; Engram `migrate-copy`/`compatibility` (lectura sin abrir). Sin prueba de corte de energía | UNVERIFIED |
| 8 | ¿Duplicados? | Mnemon: exactos; dsh-mnemon: agente de tarea; MemPalace: duplicados observados en el wing de Evol | VERIFIED (MemPalace) |
| 9 | ¿Obsolescencia? | Engram `review_after`; Mnemon decaimiento por importancia; MemPalace sin estado en cajones | DOCUMENTED |
| 10 | ¿Falla del proveedor? | dsh-mnemon: varios proveedores y estrategias; cómo degrada: no verificado | UNVERIFIED |
| 11 | ¿Qué ocurre al cerrar/desinstalar Harness? | Los datos de Mnemon viven en `~/.mnemon` (fuera de Harness); copia ZIP en dsh-mnemon | DOCUMENTED |
| 12 | ¿Se recupera desde otro cliente autorizado? | Mnemon sí (CLI independiente del host); Engram sí | DOCUMENTED |
| 13 | ¿Requiere servicios externos? | Engram: no; comprobación de versión contra `api.github.com` activa por defecto (`ENGRAM_NO_UPDATE_CHECK` la desactiva) y Cloud opcional (EV-031). Mnemon: no; embeddings opcionales con endpoint configurable (por defecto `localhost:11434`); dsh-mnemon: comprobación de versiones contra el registro npm (acción «Check versions»; automatismo no verificado) | VERIFIED / UNVERIFIED |
| 14 | ¿Embeddings/modelos? | Mnemon: ninguno obligatorio; MemPalace: EmbeddingGemma local en CPU (descarga) | DOCUMENTED |

## 3. Observaciones críticas

1. **«LLM-supervised» no es determinista.** En Mnemon el LLM anfitrión decide qué recordar. Eso encaja mal con una gobernanza que exige evidencia: la memoria sirve de contexto, **no** de prueba (invariante §13). La calidad de lo que se guarda depende del agente; hay que auditarla.
2. **dsh-mnemon es una capa de UI y estrategia**, no un motor. La lectura correcta es «dsh-mnemon (interfaz y estrategias en Harness) + Mnemon Native (motor)». Evol puede usar el motor sin la UI.
3. **Compatibilidad de versiones.** dsh-mnemon declara soporte de DSH `0.2.2-rc.1` y rangos 0.2.x; el HEAD de Harness es `0.2.2-rc.3`. Fijar versión y probar.
4. **MemPalace hoy** cumple local-first pero acumula transcripciones sin curar (≈90 % del wing) y no tiene estado por recuerdo; su valor es la búsqueda semántica.
5. **Engram** tiene el mejor modelo de ciclo de vida de recuerdos (tipos, versiones, relaciones, `review_after`) pero su búsqueda es solo léxica.

## 4. Conclusión provisional (sujeta al benchmark del doc 11)

No hay evidencia suficiente para declarar un ganador. Para el escenario Studio (local, multi-agente, UI dentro de Harness) la combinación **Mnemon Native como motor + dsh-mnemon como superficie** reduce el trabajo de interfaz; **Engram** gana en modelo de recuerdos y es lo más sencillo de instalar y auditar. La decisión se toma tras ejecutar el benchmark con umbrales fijados de antemano (doc 11, ADR-004).
