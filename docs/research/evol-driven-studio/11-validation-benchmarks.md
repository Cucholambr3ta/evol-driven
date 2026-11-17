# 11 — Plan de benchmarks y pruebas de viabilidad (R8)

**Estado: solo diseño. No se ejecutó ninguno de estos experimentos y no se inventa ningún resultado.** Se ejecutan en un entorno aislado (copia desechable del repositorio y directorios de datos temporales: `HOME`, `MNEMON_DATA_DIR`, `CBM_CACHE_DIR`, `ENGRAM_DATA_DIR` y `DSH_HOME` apuntando a carpetas de prueba) tras autorización. Los umbrales se fijan **antes** de ejecutar y no se modifican después.

## 1. Reglas generales

- Cada prueba registra versión/commit del componente, comando exacto, entorno (CPU, RAM, disco, SO) y salida bruta con hash.
- ≥5 repeticiones para tiempos; se informan mediana y rango.
- Una prueba «configurada» no cuenta como «ejecutada»; el informe distingue ambas.
- Una sola violación de una condición de entrada de seguridad descalifica el componente.

## 2. Memoria conversacional (Mnemon+dsh-mnemon, Engram, MemPalace)

**Corpus:** lecciones y decisiones curadas (7 de evol-driven, 49 líneas de Evol OS, ADR, RF-1…12), sembradas en instancias separadas de las reales. **≥40 preguntas en español** repartidas en: nombre exacto (10), paráfrasis (10), vigencia con una decisión reemplazada (10), sin respuesta (10). Las respuestas correctas las redacta un agente y las aprueba una persona antes de ejecutar.

| Prueba | Métrica | Umbral de aceptación |
|---|---|---|
| Recuperación tras reinicio | mismos resultados antes/después | 100 % |
| Recuperación entre sesiones | acierto con una sesión nueva | ≥80 % en los 3 primeros |
| Separación por proyecto | 0 resultados de otro proyecto | 0 fugas en 20 consultas cruzadas |
| Compartición entre agentes | un agente lee lo escrito por otro del mismo proyecto | 100 %; 0 en otro proyecto |
| Duplicación | guardar 20 recuerdos casi idénticos | ≤1 copia por grupo |
| Decisión vigente vs. reemplazada | la vigente primero | 100 % |
| Sin respuesta | falsos aciertos | ≤10 % |
| Offline | todo funciona con la red cortada (espacio de nombres de red vacío) | 100 %, 0 paquetes salientes |
| Respaldo y restauración | restaurar en carpeta nueva | conteos y 50 muestras idénticas |
| Concurrencia | 2 escritores durante 60 s | 0 corrupciones, 0 pérdidas |
| Corte de energía simulado | `kill -9` durante escritura | BD abre y pasa integridad |

Criterio de selección: acierto en los 3 primeros ≥80 % total y ≥70 % por tipo; en empate (<5 puntos), gana el más simple de instalar y operar. Los umbrales son criterios de decisión, no pruebas estadísticas (n≈40).

## 3. Memoria de código (motor nativo, CBM, referencias)

**Repositorios:** pequeño (evol-driven, TS), mediano (≈2–5 mil archivos), grande (≈50 mil), más uno con C++, otro con QML+CMake y uno con Rust. Verdad dorada: ≥50 preguntas por repo (definición, referencias, quién llama, impacto de un cambio) con respuesta confirmada por compilación o `grep` manual.

| Prueba | Métrica | Umbral |
|---|---|---|
| Definiciones | precisión y recall | ≥0.90 TS; para C++/Rust/QML se fija **después de la medición piloto** y se publica antes de la medición final |
| Referencias/llamadas | precisión y recall | ídem |
| Impacto de un cambio | exactitud del conjunto de archivos | recall ≥0.9 sin falsos negativos en las 10 preguntas críticas |
| Incremental tras commit/rama/renombre/borrado | índice consistente con reconstrucción total | 100 % idéntico |
| Indexación fría | tiempo, RAM pico, tamaño | se **informan**; umbral = el declarado por el autor ×1.5 solo si se quiere aceptar el motor |
| Consulta | p50/p95 de latencia | p95 ≤ 500 ms en repo mediano |
| Aislamiento | 0 resultados de otro repo | 0 fugas |
| Tokens | tokens devueltos por consulta (estimados con el tokenizador del modelo) | se informan |
| Red | tráfico saliente | **0** paquetes no declarados |
| Config de agentes | ningún archivo de agente modificado | 0 cambios (hash antes/después) |

## 4. Integración con Harness

Plugin mínimo con servicio host y panel cliente, perfil de prueba en un `DSH_HOME` aislado: carga y descarga limpia (sin handlers ni procesos colgados), reconexión del cliente, eventos y suscripciones, reinicio del host, coexistencia con dsh-mnemon y con AgentTeams en la versión fijada de Harness, y apertura con red cortada. Umbral: 0 recursos huérfanos tras 10 ciclos de carga/descarga.

## 5. Seguridad

| Prueba | Resultado esperado |
|---|---|
| Lectura fuera del proyecto autorizado | denegada |
| Escritura en `.evol/` por un agente sin rol | denegada |
| Edición de `state.json` a una fase posterior | detectada por la verificación estado↔log |
| Intento de `evol approve` desde una herramienta | falla (sin TTY) |
| Modificar un artefacto aprobado | `next` bloqueado |
| Secretos en recuerdos | rechazados o enmascarados |
| Conexiones salientes inesperadas | 0 (captura con `strace -f -e trace=network` o espacio de nombres de red) |
| Dos agentes escriben `.evol/` a la vez | sin corrupción gracias al lock |
| Inyección persistente en un recuerdo importado | el agente lo trata como dato (revisión del verificador) |

## 6. Comprobaciones de solo lectura ya realizadas

Lectura estática de los siete repositorios, conteos de commits y datos en MemPalace/Engram/Evol OS en modo `ro`, y búsquedas de patrones de red/telemetría en Mnemon y CBM (evidencias EV-024, 028). Son **inspección estática**, no sustituyen ninguna de las pruebas de arriba.
