# 10 — Inventario CLI → UI

Fuente: `evol --help` (36 comandos, EV-042) y `src/cli.ts`. Los **subcomandos y opciones** de cada comando no se recorrieron uno a uno (un intento masivo de `--help` fue denegado por el clasificador de permisos); donde se citan, vienen del texto de ayuda y quedan **por confirmar contra el código** en H8. Clases: B = botón · F = formulario · A = asistente · P = panel informativo · T = tabla/explorador · X = acción avanzada · I = interna, no expuesta. Permisos: R = Reader, O = Operator, V = Reviewer, P = Approver, A = Administrator.

| Comando | Capacidad | Operación backend (propuesta) | Perm. | Acción visual | Módulo | Clase |
|---|---|---|---|---|---|---|
| `new` | crear proyecto TS con pipeline y memoria | `project.create` | O | asistente «Nuevo proyecto» | Project Manager | A |
| `init` | adoptar proyecto existente | `project.adopt` | O | asistente «Incorporar proyecto» | Project Manager | A |
| `status` | fase, disciplinas, artefactos | `pipeline.status` | R | panel de pipeline | Pipeline Explorer / Dashboard | P |
| `prerequisites` | qué falta de la fase anterior | `pipeline.prerequisites` | R | lista de prerrequisitos | Pipeline Explorer | P |
| `verify` (+`--inicio`) | veredicto PASS/WARN/BLOCK | `pipeline.verify` | R | botón «Verificar fase» con resultado | Pipeline Explorer / Quality | B + T |
| `interrogate` | registrar plan interrogado | `plan.interrogate.record` | V | formulario en el plan | Pipeline Explorer | F |
| `approve` | **registrar aprobación humana** | `approval.authorize` | **P** | botón «Autorizar avance» (Approval Broker) | Approval Center | A (OD-04) |
| `next` | avanzar de fase si hay aprobación | `pipeline.advance` | **P/O** (separada de aprobar) | botón «Avanzar» tras aprobación vigente | Approval Center / Pipeline | B (no accesible a agentes) |
| `ciclo nuevo` | abrir ciclo | `pipeline.cycle.open` | **P** | asistente con confirmación humana | Pipeline Explorer | A |
| `memory add \| search` | guardar/consultar memoria | `memory.propose`, `memory.search` | O / R | formulario + buscador | Memory Center | F + T |
| `index` | construir/actualizar grafo | `code.index` | O | botón «Actualizar índice» con frescura | Code Intelligence | B |
| `impact` | qué depende de un símbolo | `code.impact` | R | explorador de impacto | Code Intelligence | T |
| `trace` | cadena de llamadas | `code.trace` | R | explorador de llamadas | Code Intelligence | T |
| `coverage` | matriz CA→escenario→prueba | `quality.coverage` | R | matriz con estados de evidencia | Quality & Evidence | T |
| `risk` | archivos por riesgo | `quality.risk` | R | tabla ordenable | Quality & Evidence | T |
| `export` | dataset JSON versionado | `project.export` | R | botón «Exportar» | Project Manager | B |
| `report` | informe DOCX/PDF/MD con diagramas | `report.build` | O | formulario de opciones + descarga | Quality & Evidence | F |
| `diagrams` | diagramas UML SVG | `diagrams.build` | O | botón + visor | Quality & Evidence | B |
| `lessons` | lecciones de otros proyectos | `memory.lessons.search` | R | buscador | Memory Center | T |
| `disciplines` (`list/profiles/suggest/enable/disable`) | disciplinas por módulo | `disciplines.*` | R / A | tabla + interruptores (cambio con confirmación; invalida aprobaciones) | Settings & Diagnostics | T + X |
| `skills` (`list/check/export/audit/approve/install/uninstall`) | biblioteca de skills | `skills.*` | R / A / **P** (approve) | tabla con auditoría y aprobación humana | Plugin Manager | T + A |
| `security scan` (`--solo`, `--ci`) | escaneo de seguridad | `security.scan` | O | botón + lista de hallazgos (sin valores de secretos) | Quality & Evidence | B + T |
| `knowledge` (`source/review/search`) | documentación de referencia | `knowledge.*` | R / A | buscador y revisión de fuentes | Memory Center | T |
| `agents` | integración con IDE y MCP | `agents.refresh` | A | asistente (con vista previa de archivos que cambiarán) | Settings & Diagnostics | A |
| `checkpoint` (`--nota`, `--verificar`) | guardar estado | `checkpoint.save` | O | botón «Guardar punto de control» (sección calculada, nota opcional) | Dashboard / Work Manager | B |
| `handoff` | traspaso con verificación | `handoff.create` | O | botón/diálogo | Agent Center | F |
| `hook` | salida para hooks del IDE | — | — | no se expone | — | I |
| `mcp` | servidor MCP | `mcp.status` | A | estado y herramientas expuestas con su anotación | Settings & Diagnostics | P |
| `mejora` (`add/list/hecha/descartar`) | buzón de mejoras del framework | `improve.*` | O | lista con formulario | Settings & Diagnostics | T + F |
| `docs` (`check/evidencia`) | comprobar documentación | `docs.check` | R | botón + hallazgos | Quality & Evidence | B + T |
| `sprint` (`check/estado`) | historias y sprints | `sprint.*` | R | tablero de solo lectura | Work Manager | T |
| `update` (`--comprobar`, `--volver`) | actualizar framework firmado | `framework.update` | A | asistente con versión, firma, rollback | Plugin Manager / Settings | A |
| `release` | publicar versión (no sube) | `framework.release` | A | solo avanzado | Settings & Diagnostics | X |
| `version` | identidad/integridad | `framework.version` | R | tarjeta | Settings & Diagnostics | P |
| `setup` | instalar dependencias y biblioteca | `setup.run` | A | asistente de instalación | Settings & Diagnostics | A |
| `doctor` | comprobar Node, Git, MemPalace y proyecto | `diagnostics.run` | R | botón «Diagnosticar» | Settings & Diagnostics | B + P |

## Observaciones

1. **Frecuentes que deben ser visuales primero:** `status`, `verify`, `approve`/`next`, `impact`, `coverage`, `checkpoint`, `doctor`, `index`, `security scan`, `memory`.
2. **`approve` y `next` no pasan a ser operaciones accesibles a agentes** aunque la UI las exponga: se publican solo al Approval Broker y a la interfaz humana autenticada (doc 11). Su equivalente CLI debe seguir existiendo sólo para el broker/persona; el servidor MCP no los registra.
3. **MCP:** las herramientas actuales (`evol_status`, `evol_verify`, `evol_prerequisites`, `evol_disciplines`, `evol_lessons`, `evol_find_symbol`, `evol_impact`, `evol_trace`, `evol_index`, `evol_memory_search`, `evol_memory_add`, `evol_checkpoint`, `evol_knowledge_search`) se separan en lectura y escritura con anotaciones; `evol_index`, `evol_memory_add` y `evol_checkpoint` pasan a «escritura» (EV-004).
4. **Misma lógica:** cada fila se implementa **una vez** (`core`) y la consumen UI, CLI y MCP; una prueba de equivalencia compara salida y registro entre las tres vías.
5. **Pendiente (H8):** recorrer subcomandos y opciones reales en el código, completar las filas con `--json`, y clasificar los flujos poco frecuentes como «acción avanzada».
