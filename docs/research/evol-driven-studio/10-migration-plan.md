# 10 — Plan de migración desde Evol-Driven (R7)

Regla: **ningún dato histórico se borra ni se transforma sin respaldo, criterio de integridad y vía de recuperación.** Cada paso es reversible y se aprueba por separado.

## 1. Clasificación de componentes

| Componente | Categoría | Función actual | Problema | Cambio | Pruebas de caracterización | Rollback |
|---|---|---|---|---|---|---|
| Pipeline, gate HMAC, ciclos | **KEEP** | fases, firma, vigencia | estado no conciliado (EV-006) | añadir verificación estado↔log y `verifier_version` (campo opcional) | cadena vieja valida; salto de fase detectado | campo opcional; interruptor |
| `verify`, disciplinas, skills | **KEEP** | verificación determinista | cobertura por referencia | estados de evidencia | mismo veredicto sobre fixtures previos | flag de configuración |
| CLI | **KEEP** | interfaz humana y de scripts | — | `--json` estable y versionado | salida actual congelada | — |
| MCP `evol_*` | **ADAPT** | herramientas de agentes | sin anotaciones, mezcla lectura/escritura | separar en servidor de lectura y de escritura; anotar | lista de herramientas con anotación obligatoria | mantener nombres |
| API TypeScript | **ADAPT** (nuevo) | — | no hay API pública | extraer funciones del núcleo a un paquete `core` con contratos versionados | pruebas de contrato | CLI sigue funcionando |
| Code Intelligence nativo | **ADAPT** | grafo TS | consultas que escriben, TS-only, sin frescura | `query` readonly + `freshness`; sigue alimentando `TESTS/MODIFIES` | pruebas de instantánea del grafo | reconstruir (derivable) |
| Motor de código externo (CBM) | **ADAPT** (adaptador) | navegación multilenguaje | acoplamiento y daemon | `CbmProvider` detrás de `CodeIntelProvider` | benchmark doc 11 | `codeIntel: native` |
| MemPalace | **DEPRECATE (condicional)** | memoria actual | duplicados, sin estado, wings repetidos | tras ADR-004: migrar curado a otro proveedor o gobernar el actual | doc 04 §3 | el almacén no se toca |
| Memoria: wing/duplicados | **REPLACE** (corrección interna) | nombres de wing | tres nombres | normalizar nombre con migración aprobada | conteos | no se reescriben recuerdos existentes |
| Checkpoint manual | **ADAPT** | traspaso | declarativo | sección calculada (RF-1) | comparación con git | — |
| Adaptadores a IDE | **ADAPT** | configurar agentes | garantías desiguales | documentar garantías; el Plugin Edition no los sustituye | pruebas existentes | — |
| Tablero de tareas propio | **no crear** | — | duplicaría Harness | usar `team`/AgentTeams | — | — |

## 2. Preservación de datos

| Dato | Tratamiento |
|---|---|
| Specs, planes, journal, checkpoints, gate-log | no se tocan; el Control Center los lee |
| Aprobaciones | solo anexar; los campos nuevos son opcionales y se ignoran en cadenas antiguas |
| Índice de código | derivable: se reconstruye; se versiona el esquema |
| Memoria | copia previa; migración por exportación/importación con verificación (doc 04) |
| Historial Git | intacto; los trailers `CA:` solo se añaden en commits nuevos |
| Configuración | `evol.config.json` conserva claves existentes; las nuevas tienen valores por defecto equivalentes al comportamiento actual |

## 3. Integración: API vs CLI vs MCP vs HTTP

| Opción | Seguridad | Contrato | Acoplamiento | Rendimiento | Ciclo de vida | Veredicto |
|---|---|---|---|---|---|---|
| API TypeScript embebida (paquete `core`) | proceso del host: mismo privilegio | tipado, versionable | alto con Node/TS | mejor | acoplado al host | **ideal para el plugin host** (mismo runtime Node ≥24) |
| CLI `--json` como adaptador | proceso hijo aislable | texto JSON versionado | bajo | arranque por llamada | independiente | **primer paso** (ya existe) |
| MCP | límite claro; falta anotar | herramientas | bajo | medio | proceso persistente | **para agentes externos** |
| HTTP local | superficie de red | OpenAPI | bajo | medio | servicio que gestionar | **evitar al inicio**: añade superficie |

Recomendación: **CLI `--json` ahora → paquete `core` TypeScript después → MCP para agentes; sin servicio HTTP**. No se convierte el framework en microservicios.

## 4. Orden y criterios

1. Línea base: congelar salidas actuales con pruebas de caracterización.
2. Estabilizar (Hito 1): solo lectura, anotaciones, estado↔log, lock.
3. Extraer `core`.
4. Adaptadores (memoria, código).
5. Plugin host/client.
Cada paso termina con la suite de caracterización en verde en la versión estable y en la de desarrollo (lección del verificador auto-hospedado).
