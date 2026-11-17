# 13 — Roadmap de renovación (R10)

Estimaciones **relativas** (S/M/L/XL); no existe una base medible para tiempos ni costos. Cada hito exige aprobación humana de sus artefactos y respeta el pipeline de Evol (cada hito es uno o varios ciclos). Ajustes frente a la secuencia provisional del encargo: se añade un **Hito 0** de línea base y experimentos; la elección de motores de memoria y código se **mueve después** de los benchmarks; el Desktop Linux queda condicionado a una decisión nueva (no existe objetivo en Harness, EV-018).

| Hito | Objetivo | Prerrequisitos | Componentes | Tamaño |
|---|---|---|---|---|
| 0 — Línea base y experimentos | convertir inferencias en hechos; pruebas de caracterización | autorización de entorno aislado | copia desechable, fixtures | M |
| 1 — Estabilización de Evol-Driven | cerrar brechas EV-003…008 y RF-1/3/5/7/12 | 0 | `core/pipeline`, `gate`, `verify`, `coverage`, MCP, grafo, lock | L |
| 2 — Contratos de integración | API pública estable y versionada (proyectos, pipeline, aprobaciones, evidencias, memoria, símbolos) | 1 | paquete `core`, esquemas `--json`, anotaciones MCP | M |
| 3 — Prototipo Cordis (tajada vertical) | plugin host+cliente que muestra el **Pipeline Explorer** de solo lectura sobre un proyecto real | 2, versión de Harness fijada | `evolBridge`, panel en un slot | M |
| 4 — Memoria local | decidir y adaptar proveedores de memoria conversacional y de código con los benchmarks | 0, 2 | `MemoryProvider`, `CodeIntelProvider`, adaptadores | L |
| 5 — Control Center | módulos por orden de valor: Pipeline → Aprobaciones → Calidad/Evidencias → Memoria → Código → Agentes → Diagnóstico | 3, 4 | plugins de cliente | XL |
| 6 — Coordinación multiagente | integrar AgentTeams (o `team` nativo) con puente de evidencia y gate de cierre | 2, 3 | adaptador de tareas↔CA | L |
| 7 — Plugin Edition | bundle reproducible, instalación/reversión | 3 | `evol-studio` plugin y perfil | M |
| 8 — Desktop Edition | Electron para macOS/Windows con los mismos componentes; Linux solo tras ADR de empaquetado | 7, decisión OD-06 | empaquetado propio | XL |
| 9 — Validación integral | seguridad, red, recuperación, compatibilidad multiagente, instalación limpia | todos | suite de pruebas del doc 11 | L |

## Detalle por hito

**Hito 0.** *Entradas:* autorización; *salidas:* informe con los resultados de las pruebas del doc 11 §2–§5 que no requieren instalar nada en el sistema real. *Bloqueo:* sin entorno aislado. *Rollback:* borrar la copia.

**Hito 1.** *Entregables:* (a) verificación estado↔log (EV-006); (b) consultas del grafo de solo lectura con `freshness`; (c) anotaciones MCP y separación lectura/escritura; (d) lock de `.evol/`; (e) `verifier_version` en lo firmado; (f) sección calculada del checkpoint (RF-1); (g) estados de evidencia mínimos (RF-3, RF-12); (h) trailer `CA:` por commit con hook de verificación. *Pruebas:* aceptación por la puerta pública con fixture identificable; entradas hostiles; correr con `evol` y `evol-dev`. *Salida:* suite verde, `verify` PASS, aprobación humana. *Bloqueo:* regresión en caracterización. *Rollback:* interruptores de configuración y revert por commit.

**Hito 2.** *Entregables:* paquete `core` con tipos, esquemas JSON y versión de contrato; CLI `--json` congelado. *Salida:* pruebas de contrato y de compatibilidad hacia atrás.

**Hito 3 (primera implementación vertical).** Plugin `evolBridge` con una lectura (`status`, `verify`, validez de la cadena) y un panel «Pipeline Explorer» que muestra **fase declarada vs. fase verificada**, aprobaciones vigentes y hashes. *Criterios de salida:* carga y descarga limpias 10 veces (0 recursos huérfanos); funciona con red cortada; ningún acceso a `.evol/` desde el cliente; el plugin no puede aprobar. *Bloqueo:* si un plugin host no puede aislar el acceso al log, replantear el proceso del núcleo. *Rollback:* quitar el plugin del perfil.

**Hito 4.** Ejecuta el benchmark de memoria y de código, redacta ADR-004/005, implementa adaptadores detrás de interfaces, migra memoria si procede (doc 04 §3). *Entrada:* umbrales fijados. *Bloqueo:* ningún candidato cumple las condiciones de entrada de seguridad.

**Hito 5.** Cada módulo se entrega por separado con sus contratos (doc 06); no se aprueba un módulo sin las pruebas de permisos del doc 09. *Salida:* operaciones de escritura solo con rol y registro.

**Hito 6.** *Entrada:* matriz de compatibilidad AgentTeams↔Harness fijada. *Salida:* una tarea de AgentTeams no figura «completada» para Evol hasta que `verify` y revisor independiente cumplan; dos agentes no pueden escribir `.evol/` a la vez (prueba).

**Hito 7.** *Salida:* instalación y desinstalación probadas en un `DSH_HOME` limpio; ninguna configuración existente reemplazada sin `--dry-run` aprobado; escaneo de secretos del paquete en verde.

**Hito 8.** Depende de decidir si se produce un objetivo Linux (fork del empaquetado, no del núcleo), con ADR propio.

**Hito 9.** Ejecuta el plan completo y publica evidencia reproducible; bloquea la liberación ante cualquier fallo P0 del registro de riesgos.

## Qué debería hacerse primero

La **primera tajada vertical** es el Hito 3 (Pipeline Explorer de solo lectura), precedida por la parte del Hito 1 que habilita lectura segura (a, b, c). Es la prueba más barata de la integración host/client y de la separación entre estado declarado y verificado.
