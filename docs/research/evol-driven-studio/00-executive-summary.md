# 00 — Resumen ejecutivo: Evol-Driven Studio

Investigación EVOL-STUDIO-RESEARCH-001 · fecha de evidencia 2026-11-16 · rama `feat/evol-driven-studio` · commit base `47a93c8` · Harness inspeccionado `39163dd3` (0.2.2-rc.3). **Documentos sin commit.** Todo lo aquí dicho es recomendación para revisión; nada está aprobado ni implementado.

## Conclusión en seis líneas

1. Es viable y razonable convertir Evol-Driven en el núcleo de un producto sobre DeepSeek Harness, **si el núcleo sigue siendo independiente** y Harness se trata como host sustituible: está en pre-release, con APIs «pre-stable» y **sin auditoría de seguridad** según su propio SAFETY.md.
2. Arquitectura recomendada: **A→C** (puntuación cualitativa 77.6 y 75.0 frente a 45.0 de reconstruir todo como plugins Cordis).
3. Evol ya tiene lo que Harness no (pipeline, aprobaciones firmadas, verificación); Harness tiene lo que Evol no (UI, sesiones, equipos de agentes, sandbox). **Duplicar tareas o aprobaciones sería el error principal.**
4. Hay brechas reales de Evol que deben cerrarse **antes** de exponerlo en una UI: estado no conciliado con el registro firmado, MCP que escribe sin anotar, consultas del grafo que escriben, sin bloqueo de concurrencia, cobertura por referencia.
5. **Desktop en Linux no existe en Harness** (solo macOS y Windows). La primera edición debe ser Plugin Edition sobre `dsh web`.
6. Memoria: **no hay evidencia para elegir un proveedor**; se decide con un benchmark de umbrales fijados de antemano. Memoria de código: motor nativo para gobernanza + CBM como adaptador condicionado a seguridad.

## Primera implementación vertical

Pipeline Explorer de solo lectura (plugin `evolBridge` + panel) que muestre **fase declarada vs. fase verificada** y la validez de la cadena de aprobaciones. Precedida por las correcciones de lectura segura (docs 10 y 13).

## Índice

| Doc | Contenido |
|---|---|
| 01 | Estado actual de Evol-Driven (R0) |
| 02 | Arquitectura de Harness (R1) |
| 03–05 | Memoria conversacional, diseño local, code intelligence (R2) |
| 06 | Control Center (R3) |
| 07 | Agentes y orquestación (R4) |
| 08 | Distribución (R5) |
| 09 | Seguridad y gobernanza (R6) |
| 10 | Plan de migración (R7) |
| 11 | Benchmarks y pruebas de viabilidad (R8) |
| 12 | Comparación de arquitecturas (R9) |
| 13 | Roadmap (R10) |
| 14–16 | Riesgos, compatibilidad, decisiones abiertas |
| 17 | Recomendación final (las 16 preguntas) |
| `evidence/EVIDENCE.md` | EV-STUDIO-EV-001 … 031 |
| `adr/` | ADR-001 … 006 (todos sin aprobar) |

## Validación contra los criterios del encargo (§20)

| Criterio | Estado | Observación |
|---|---|---|
| Repositorio actual de Evol-Driven inspeccionado | **Cumplido (estático)** | commit, versión, módulos, brechas; suite no ejecutada |
| Versión concreta de Harness | **Cumplido** | `39163dd3`, 0.2.2-rc.3, 2026-11-13 |
| Mecanismos de extensibilidad verificados | **Parcial** | verificados en código y documentación; **ningún plugin se cargó** |
| Sistema de memoria existente evaluado | **Cumplido** | MemPalace y Engram en modo solo lectura |
| Candidatos de memoria local comparados | **Parcial** | comparación por lectura de código; **sin benchmark** |
| Duplicación de Code Intelligence | **Cumplido (diseño)** | alternativas A–E; sin medición |
| AgentTeams investigado | **Cumplido (lectura)** | compatibilidad con 0.2.2-rc.3 sin confirmar |
| Control Center diseñado | **Cumplido (conceptual)** | contratos y módulos; sin prototipo |
| Separación de responsabilidades | **Cumplido** | docs 07, 09 |
| Ambas distribuciones evaluadas | **Cumplido** | hallazgo: Desktop Linux inexistente en origen |
| Análisis de amenazas | **Cumplido (diseño)** | sin pruebas de seguridad ejecutadas |
| Contratos definidos | **Cumplido (conceptual)** | docs 06, 10 |
| Plan de migración reversible | **Cumplido** | doc 10 |
| Matriz de compatibilidad | **Cumplido (declarada)** | **ninguna combinación probada** |
| Plan de validación | **Cumplido** | doc 11 |
| Arquitectura seleccionada con criterios explícitos | **Cumplido** | recomendación, sin aprobación |
| Riesgos, incertidumbres y bloqueos | **Cumplido** | docs 14, 16 |
| Roadmap ejecutable | **Cumplido** | estimaciones relativas |

**La investigación documental está completa; la validación empírica no.** Los criterios que dependen de ejecutar algo (plugin cargado, benchmarks, pruebas de seguridad, compatibilidad AgentTeams↔Harness, reproducir cifras de CBM) están **pendientes**, no aprobados.

## Limitaciones

- Solo inspección estática; cero resultados de rendimiento ni de seguridad.
- Los siete repositorios externos (más Engram) se leyeron parcialmente: README, manifiestos, docs clave y búsquedas de patrones; no su totalidad.
- Las cifras de CBM y las afirmaciones de calidad de los autores se citan como DOCUMENTED, no verificadas.
- Las puntuaciones de las matrices son juicios cualitativos.
- La estimación de reutilización de código de Evol es cualitativa.
- No se revisaron `src/agents/*` ni `coverage.ts` en detalle en esta etapa.

## Efectos secundarios de la sesión (declarados)

El hook de MemPalace auto-minó las transcripciones de esta sesión (el wing `evol_driven` pasó de 2786 a 3027 cajones); Engram no se escribió; se crearon documentos nuevos solo en `docs/research/evol-driven-studio/` y clones superficiales en el scratchpad; sin commits. La ejecución **no fue estrictamente de solo lectura** por el auto-minado.
