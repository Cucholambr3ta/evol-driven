# 31 — Metodología y umbrales de los benchmarks (asunto 18) — PROPUESTA

Estado: **SPECIFIED, no aprobada ni ejecutada.** Regla: la metodología y los umbrales se **aprueban antes de medir**; no se ajustan después de ver resultados. Los umbrales son propuestas del autor del documento (no del propietario) y se marcan para su aprobación. Precedente interno: la spec usa «recall@5 y MRR sobre un conjunto fijo de 30 preguntas» y exige una mejora de al menos 15 puntos para activar vectores (`ESPECIFICACION.md` Amp. 5).

## 1. Reglas comunes

1. Conjunto de preguntas o tareas **fijado y versionado antes** de medir; sin tocarlo después.
2. Cada medida se repite **5 veces**; se informa mediana y rango. Los modelos de lenguaje con resultados variables no cuentan como una medida única (lección de la spec sobre el Qwen local).
3. Misma máquina, mismos repositorios y mismo estado inicial; versiones exactas del `studio.lock.json`.
4. Se registra memoria RAM máxima, tiempo y tráfico de red de cada ejecución.
5. Un benchmark que no pueda ejecutarse queda `BLOCKED`, nunca `VERIFIED`.

## 2. Memoria contextual (dsh-mnemon + Mnemon frente a MemPalace; Engram de referencia)

| Aspecto | Método |
|---|---|
| Conjunto | 30 preguntas reales sobre decisiones y lecciones del propio proyecto, cada una con el recuerdo esperado, redactadas por la persona o validadas por ella |
| Métricas | recall@5, MRR, latencia de recuperación (mediana y p95), duplicados por 100 recuerdos, **fugas entre proyectos** (se siembran 2 proyectos con datos distintivos) |
| Offline | misma batería con red cortada |
| Procedencia | 100 % de los recuerdos devueltos con fuente, fecha y proyecto |

**Umbrales propuestos (a aprobar):** recall@5 de Mnemon **no inferior en más de 5 puntos** al de MemPalace; **0 fugas** entre proyectos; **0 conexiones no declaradas**; funcionamiento offline completo; **procedencia 100 %**; duplicados no peores que MemPalace. Cualquier fuga o conexión no declarada es BLOCK, sin compensación.

## 3. Code Intelligence (motor nativo frente a Codebase Memory)

| Aspecto | Método |
|---|---|
| Repositorios | `evol-driven` (TypeScript, referencia con verdad conocida por el motor nativo) y uno pequeño de otro lenguaje elegido por la persona |
| Tareas | 20 consultas fijas: definición de símbolo, llamadores, impacto transitivo, traza |
| Métricas | precisión y exhaustividad del conjunto de impacto frente al motor nativo en TypeScript; tiempo de indexación inicial e incremental; RAM; frescura tras un commit; ausencia de escrituras en las consultas de lectura (hash antes/después) |
| Entradas de seguridad | 0 conexiones salientes y 0 cambios en configuración de agentes durante indexar y consultar (condiciones de OD-05) |

**Umbrales propuestos (a aprobar):** en TypeScript, exhaustividad del impacto de Codebase Memory **≥ 95 %** respecto del motor nativo y precisión **≥ 90 %**; si no se cumple, se conserva el motor nativo para TypeScript y Codebase Memory solo para otros lenguajes (OD-05 es híbrido); incremental tras un commit **sin reindexar todo**; consultas de lectura **sin escribir**. Las cifras publicadas por los autores **no se aceptan** sin reproducirlas.

## 4. Aprobación y ejecución

Aprobación de la metodología y de los umbrales por el propietario → congelar el conjunto de preguntas (hash) → ejecutar en la Tanda 1 → informe con resultados, variabilidad y decisión. Hasta entonces el asunto 18 está `SPECIFIED`.
