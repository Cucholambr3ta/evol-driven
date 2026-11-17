# 05 — Code Intelligence: comparación (R2, §9.2–9.3)

Evidencia: EV-002, 003, 026–029. **No se ejecutó ningún benchmark**; las cifras de Codebase Memory MCP (CBM) son del autor y no se reprodujeron. Este documento compara capacidades y define qué medir.

## 1. Capacidades

| | Motor nativo de Evol (TS) | Codebase Memory MCP |
|---|---|---|
| Implementación | ts-morph + SQLite, ≈1 050 líneas | C nativo, daemon, 17 herramientas MCP, UI |
| Lenguajes con gramática | TS/JS (8 extensiones) | 164 gramáticas, incluidas `qml` y `cmake` |
| Resolución semántica | type checker de TypeScript (preciso para TS) | «Hybrid LSP» propio para Python, TS/JS, PHP, C#, Go, C/C++, Java, Kotlin, Rust, Perl; **QML y CMake solo tree-sitter** |
| Relaciones | IMPORTS, CALLS, EXTENDS, CONTAINS, EXPORTS, TESTS, MODIFIES | símbolos, llamadas, imports, rutas, hotspots, impacto de archivo, tests relacionados, ADR |
| Incrementalidad | por hash de archivo + cascada a importadores (cola en memoria) | vigilante por *polling* para proyectos git; manual para el resto |
| Git | `MODIFIES` del árbol sin commitear; sin commit ni rama en el índice | instantáneas comparables y «Smart CI» experimental (no verificado) |
| Consultas expuestas | `find_symbol`, `impact`, `trace` | búsqueda por símbolo/texto/semántica, trazas, Cypher, impacto |
| Escritura al consultar | sí (EV-003) | no verificado; auto-index off por defecto |
| Aislamiento | un `.evol/codegraph.sqlite` por proyecto | un daemon por cuenta compartido entre clientes (EV-027) |
| Instalación | dentro de evol | binario externo; instalador que toca configuración de agentes |

## 2. Alternativas (§9.3)

- **A. Solo el motor actual:** simple, pero ciego fuera de TS/JS. No sirve para Rust, C++, QML.
- **B. Sustituirlo por CBM:** gana lenguajes y UI, pero evol pierde `TESTS`/`MODIFIES`, que alimentan QA, y se acopla a un daemon externo con instalador invasivo. Riesgo de regresión alto.
- **C. Ambos con responsabilidades distintas (recomendada):** el motor nativo conserva lo que sirve a la **gobernanza** (símbolos modificados sin prueba, vínculo commit↔CA) y CBM actúa como **motor de navegación** para el agente y la UI en los lenguajes que cubre mejor. Un único punto de entrada `CodeIntelProvider` evita duplicar consultas.
- **D. Reutilizar componentes de uno y descartar otros:** viable para técnicas (índice por rama y hash, PageRank con presupuesto de tokens), no para componentes de código.
- **E. Adaptador hacia un motor compartido:** es la forma técnica de implementar C. El adaptador (`CbmProvider`) llama por MCP/CLI con permisos acotados y normaliza el resultado a `SymbolRef`.

**Recomendación provisional: C implementada con E**, sujeta al benchmark. No se adopta CBM si falla alguna de las condiciones de entrada (doc 11): sin red saliente, sin modificar configuración de agentes, sin daemon compartido entre proyectos o con aislamiento demostrado.

## 3. Cobertura por lenguaje (lo que se afirma y lo que no)

| Lenguaje | Parser | Relaciones semánticas | Observación |
|---|---|---|---|
| TypeScript/JavaScript | ambos | nativo (type checker) y CBM («Bueno» según el autor) | CBM no iguala al compilador en generics complejos: sin medir |
| Rust | CBM | Hybrid LSP (README) | sin verificación |
| C++ | CBM | Hybrid LSP (README); «Excelente» por el autor | **sin verificación**; plantillas, macros y `compile_commands.json` son los puntos débiles esperables |
| QML | CBM (gramática) | **ninguna** | solo estructura; qmlls (Qt) da definiciones/usos de ids/propiedades, pero necesita directorio de build y puede lanzar CMake |
| CMake | CBM (gramática) | **ninguna** | estructura de archivos y llamadas a comandos, no resolución de targets |
| Python | CBM | Hybrid LSP | — |

«Existe parser» no implica «relaciones útiles»: la tabla separa ambos.

## 4. Qué medir (resumen; el diseño completo está en doc 11)

Precisión y recall de definiciones y referencias contra un conjunto de verdad anotado a mano por repositorio y lenguaje; correctitud del impacto de un cambio (conjunto de archivos afectados contra el obtenido con compilación o `grep` confirmado); tiempo y RAM de indexación fría e incremental; comportamiento tras commit, cambio de rama, renombre y borrado; tráfico de red durante todo el ciclo.

## 5. Brechas de Evol que no cubre ningún motor externo

Vínculo commit↔criterio de aceptación; prueba↔requisito; estado de frescura expuesto al agente; control de permisos por proyecto. Son responsabilidad del núcleo de Evol y se diseñan en el doc 10.
