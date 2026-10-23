# Investigación: RAGFlow y la memoria del proyecto

> **Estado:** investigación, **nada se instaló ni se conectó**. Fecha: 2026-10-22. La propuesta está en la especificación (ampliación 5)
> y empieza por un piloto, no por código.

## Qué se revisó

- **El repositorio `infiniflow/ragflow`** (API de GitHub): licencia, versiones, README, el árbol de documentación, el archivo
  `docker/.env`, la documentación de MCP y la referencia de la API HTTP.
- **Tu memoria actual:** el estado real de MemPalace por su propio MCP (solo lectura) y cómo la usa evol (`src/memory/`).
- **Tu máquina:** memoria, disco, Docker y `vm.max_map_count`.

## Qué es RAGFlow

Un motor de **RAG** (recuperación de información para modelos de lenguaje) de código abierto, Apache-2.0, con 92 672 estrellas y actividad
diaria. Está en la versión **1.0.0-rc2** (candidata a versión final, 2026-10-16); la estable anterior es la 0.27.2 (2026-09-10). Reescribió
sus servicios en Go y trae una guía de migración a la 1.0 con alias de la API retirados.

Lo que ofrece:

- **Comprensión profunda de documentos:** PDF, Word, PowerPoint, Excel, imágenes, escaneados y páginas web, con plantillas de troceado que se
  pueden revisar a mano.
- **Recuperación con citas trazables** a los fragmentos de origen, recuperación múltiple con reordenación y un modo «agéntico» de varios
  pasos con cuatro niveles de profundidad.
- **Compilación de conocimiento:** genera a partir de los documentos wikis, grafos, árboles, líneas de tiempo e incluso **skills**.
- **API HTTP** (conjuntos de datos, documentos, fragmentos, recuperación, asistentes) y **servidor MCP** propio.

### Cómo se conecta por MCP

| Aspecto       | Dato                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Herramientas  | Tres, **de solo lectura**: `ragflow_retrieval`, `ragflow_list_datasets` y `ragflow_list_chats`                                |
| Transporte    | HTTP en streaming (`POST /api/v1/mcp`, puerto 9380) o un oyente opcional (`/mcp` en 9382) y SSE heredado                      |
| Autenticación | Cabecera `Authorization: Bearer <clave>`; en modo `host` cada cliente se identifica, en `self-host` todos comparten una clave |
| Como cliente  | Puede usar herramientas de **otros** servidores MCP, pero **no** los que van por `stdio` (hace falta una pasarela)            |

### Lo que cuesta

- **Pila pesada:** el sistema ocupa varios servicios (Elasticsearch o Infinity, MySQL, MinIO, NATS, Kvrocks) y recomienda **4 núcleos, 16 GB de
  RAM y 50 GB de disco**; el límite de memoria por defecto es de 8 GB. Exige Docker ≥ 24.
- **Seguridad de fábrica floja:** `docker/.env` trae contraseñas por defecto (`infini_rag_flow` para Elasticsearch, MySQL y MinIO) y su
  propio aviso dice que no se despliegue así. Hay que cambiarlas, publicar solo en `127.0.0.1` y comprobar el registro de usuarios.
- **Modelos:** necesita un modelo de lenguaje y uno de embeddings configurados. Si son remotos, **los fragmentos de tus documentos salen
  de la máquina**.
- **Madurez:** versión candidata, 1 324 incidencias abiertas y cambios de API recientes: conviene anclar la versión y aislar el contacto
  detrás de un adaptador.

## Tu memoria hoy

| Dato                 | Valor                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Sistema              | MemPalace 3.11.0 sobre ChromaDB 1.5.9, embeddings en CPU, todo local                                             |
| Contenido            | 2 407 recuerdos en 6 «alas»; casi todo (2 258) en un ala técnica, más diarios y decisiones                       |
| Qué ofrece           | Recuerdos textuales, grafo de conocimiento con fechas de validez, diario y búsqueda semántica                    |
| Cómo lo usa evol     | Cliente MCP por `stdio` (`mempalace-mcp`): `evol memory add/search`, eventos del pipeline y `evol lessons check` |
| Principio del diseño | La memoria guarda **decisiones y lecciones**, no estado derivable (el grafo de código va aparte)                 |

## Dos cosas distintas

|            | **MemPalace (ya instalado)**                              | **RAGFlow**                                                              |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Qué guarda | Lo que decidiste, aprendiste o pasó: texto corto y hechos | Documentos de origen, enteros, con su estructura                         |
| Para qué   | «¿Por qué decidimos esto?», «¿qué lección había?»         | «¿Qué dice el contrato, la norma o el informe sobre X, y en qué página?» |
| Entrada    | Texto que alguien o un agente escribe                     | Archivos pesados: PDF con tablas, escaneados, Office, web                |
| Salida     | Recuerdos relevantes                                      | Fragmentos con cita a su documento                                       |
| Coste      | Ligero, sin servicios                                     | 16 GB de RAM y cinco servicios en Docker                                 |
| MCP        | `stdio`                                                   | HTTP en streaming (no `stdio`)                                           |

No compiten: **si lo que hay que recordar son decisiones y lecciones, MemPalace; si hay que consultar documentos complejos con citas,
RAGFlow**. Meter documentos enteros en MemPalace los trocea sin estructura; meter decisiones en RAGFlow gasta una pila entera en algo que
ya resuelve una base local.

## Opciones de integración

| Opción                                   | Qué es                                                                                                  | A favor                                                                                                                    | En contra                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **A. Solo MCP en los IDE**               | Registrar el MCP de RAGFlow junto al de MemPalace en cada IDE; los agentes llaman a `ragflow_retrieval` | Cero código en evol                                                                                                        | Hay que registrarlo en cada IDE (en varios es configuración global); solo lectura; la ingesta queda aparte          |
| **B. Proveedor de conocimiento en evol** | `evol knowledge add/search/list` con un adaptador de la API HTTP, a la manera del proveedor de código   | Ingesta controlada, revisión previa de secretos e instrucciones, citas en `evol report`, un solo lugar donde cambia la API | Es código nuevo y hay que mantener el adaptador frente a una API que está cambiando                                 |
| **C. Puente MemPalace → RAGFlow**        | Copiar los recuerdos a RAGFlow para mejorar su búsqueda                                                 | —                                                                                                                          | Duplica datos, se desincroniza, y ya hay búsqueda semántica local. **Descartada**                                   |
| **D. Skills compiladas por RAGFlow**     | Usar las «skills» que RAGFlow genera de los documentos                                                  | —                                                                                                                          | Saltaría la auditoría de skills. Si se usan, **entran como skills de terceros sin auditar** por `evol skills audit` |

**Recomendación:** B, pero **después de un piloto** y como **proveedor opcional**, nunca como requisito. La opción A sirve mientras tanto
para probar sin escribir código.

### Cómo sería B (esbozo)

- `evol.config.json › conocimiento`: proveedor (`ninguno` por defecto, `ragflow`), dirección local y nombre del conjunto de datos del
  proyecto. **La clave de la API no va al proyecto**: vive en la carpeta de configuración del usuario, como las claves del gate.
- **Antes de subir un documento**, evol aplica las reglas de la auditoría: sin secretos (gitleaks) y sin instrucciones que alteren al
  agente. Lo recuperado se trata siempre como **datos, no como instrucciones**.
- **Solo lectura hacia los agentes:** una herramienta `evol_knowledge_search` en el MCP de evol, igual que las demás.
- `evol doctor` informa de si hay un RAGFlow accesible; `evol report` puede citar fragmentos con su origen.

## Viabilidad en tu máquina

| Recurso            | Tu máquina                                | RAGFlow recomienda |
| ------------------ | ----------------------------------------- | ------------------ |
| Memoria            | 15 GiB en total, **11 en uso**, ~3 libres | 16 GB solo para él |
| Disco              | 408 GB libres                             | 50 GB              |
| Docker             | 29.9.1                                    | ≥ 24.0.0           |
| `vm.max_map_count` | 1 048 576 (ya vale para Elasticsearch)    | ≥ 262 144          |

**Conclusión:** el disco, Docker y el kernel están bien, pero **la memoria no**: con la carga de hoy, RAGFlow compite con tu trabajo y
puede dejar la máquina sin aire. Un piloto cabe si se cierra lo demás, se reduce el límite de memoria o se usa el motor Infinity (más
ligero, sin verificar), y no como servicio permanente. Otra opción es alojarlo en otro equipo.

## Piloto propuesto (antes de escribir código)

1. **Aislado:** un proyecto de Docker aparte, en una versión fija (la 0.27.2 estable o la 1.0.0-rc2, a decidir), publicado solo en
   `127.0.0.1`, con las contraseñas cambiadas y el registro de usuarios cerrado.
2. **Modelos locales o declarados:** si se usa un modelo remoto, se dice qué sale de la máquina.
3. **Cinco documentos reales:** dos PDF con tablas, un Word, uno escaneado y uno en Markdown.
4. **Un conjunto fijo de 20 preguntas** con la cita esperada, y como base de comparación la búsqueda de MemPalace sobre los mismos
   archivos.
5. **Se mide:** aciertos en los 5 primeros resultados, latencia, memoria máxima, esfuerzo de puesta en marcha y fallos.
6. **Se decide:** sigue solo si mejora al menos 20 puntos en las preguntas sobre PDF y escaneados **y** cabe en la máquina elegida.

## Preguntas abiertas

- ¿Qué documentos tuyos justificarían esto? Si son sobre todo Markdown y código, MemPalace más el grafo de código ya bastan.
- ¿Dónde correría el piloto: esta máquina (con la memoria justa) u otra?
- ¿Aceptas un modelo de lenguaje remoto para el piloto, o solo local?
