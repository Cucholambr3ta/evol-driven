# 04 — Diseño de memoria local (R2, §9.4–9.5)

## 1. Principio

Un **proveedor responsable por ámbito**, sin doble escritura:

| Ámbito | Responsable | Fuente de verdad |
|---|---|---|
| Aprobaciones, estados, evidencias de verificación | Evol-Driven (`.evol/`) | `gate-log.jsonl` firmado |
| Historial de cambios | Git | repositorio |
| Memoria conversacional curada (decisiones, lecciones, preferencias, handoffs) | **un** proveedor (por decidir: ADR-004) | su almacén local |
| Memoria de código (símbolos, relaciones, impacto) | un motor de código (doc 05) | su índice local, **derivable** del código |
| Transcripciones de sesión | archivo, **no** memoria recuperable por defecto | log de sesión de Harness |

Regla: la memoria **nunca sustituye** evidencia de verificación; un recuerdo puede *referenciar* un `seq` del gate-log o un commit, no copiar su contenido.

## 2. Política local-first (qué hay que comprobar, no solo declarar)

Privacidad de memoria = los datos de los subsistemas de memoria no salen del equipo. Privacidad de inferencia = además el modelo corre local. **Son requisitos distintos**: el producto garantiza el primero; el segundo exige un proveedor de modelos local configurado y se informa como estado, no como promesa.

Flujo de datos a revisar para cada componente (resultados actuales):

| Componente | Salidas de red encontradas en el código | Evidencia |
|---|---|---|
| Mnemon | solo embeddings (endpoint configurable, por defecto local), `/health` local, vigilancia y agente de memoria con endpoint configurable; sin telemetría en esa búsqueda | EV-024 |
| dsh-mnemon | `fetch` al registro npm para comprobar versiones y para instalar plugins | EV-025 |
| Codebase Memory MCP | sin telemetría en la búsqueda; actualizaciones por script de instalación; UI en `localhost:9749`; chat opcional con modelo local (descarga de ≈567 MB por WebGPU) | EV-026, 027, 028 |
| Harness Desktop | analítica de producto, Platform API, actualizaciones | EV-021 |
| MemPalace | embeddings locales; descarga inicial de modelos | EV-012 |

**Requisitos propuestos para la edición Evol**: bloqueo explícito de conexiones salientes por defecto (lista de permitidos), desactivar analítica y comprobación automática de versiones, y una prueba de red (doc 11) que falle si hay tráfico no declarado. Estado: diseño, sin implementar.

## 3. Migración MemPalace → otro proveedor (si ADR-004 lo decide)

1. **Congelar** y respaldar el palacio (copia de `~/.mempalace/palace` y `knowledge_graph.sqlite3`; no se toca el original).
2. **Exportar** solo lo curado (`lecciones`, `decisiones`, `aprobaciones`, `pipeline`, `contexto`, `diary`), con `drawer_id`, `source_file`, fecha y wing.
3. **Transformar** a un formato intermedio JSONL: `{id_origen, tipo, texto, fecha, fuente, proyecto, estado}`; los recuerdos sin fuente quedan en cuarentena.
4. **Importar** con el importador del destino, conservando `id_origen` como referencia de procedencia.
5. **Verificar**: conteos por tipo, muestreo de ≥50 recuerdos comparados texto a texto, y las preguntas del benchmark sobre ambos almacenes.
6. **Detectar pérdidas**: informe de los elementos no importados y su razón.
7. **Reversión**: el almacén original no se altera; se vuelve a apuntar la configuración.
Las transcripciones no se migran.

## 4. Diseño de contrato (`MemoryProvider`)

Interfaz mínima, justificada porque habrá ≥2 implementaciones reales durante la evaluación: `save(item)`, `search(query, filtros)`, `get(id)`, `supersede(id, nuevo)`, `invalidate(id, motivo)`, `list(estado)`, `export()`, `health()`. Cada elemento lleva `proyecto`, `tipo`, `fuente` (commit, `seq`, archivo), `estado` (propuesto/vigente/reemplazado), `fecha` y `revisar_después`. Se implementa como adaptador por CLI/MCP; no se expone a los agentes más que a través de herramientas de Evol, para poder aplicar permisos.

## 5. Acceso compartido entre agentes

Lectura compartida por proyecto; escritura solo mediante la herramienta de Evol, que anota autor (agente/sesión) y exige tipo y fuente. Un agente no puede borrar ni reemplazar recuerdos de otro; eso requiere rol Operator o superior (doc 09).
