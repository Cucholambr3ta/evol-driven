# 13 — Plan de Tanda 1: preparación de DSH (v3.1)

**v3.1:** baseline **ratificada** (OD-09: DSH `0.2.1-rc.2` + AgentTeams `0.1.30`, fijadas en un manifiesto reproducible) y OD-03 ratificada; se añaden el manifiesto, los perfiles aislados y la prueba de instaladores en entorno desechable (doc 27) y las pruebas C-T1-01…10. Sigue sin instalar nada.

Responsable de los prompts: ChatGPT (según el encargo). Esta tanda **no migra Evol-Driven**. Este documento fija prerrequisitos, alcance, pruebas y el **contrato de entrega**; no instala nada.

## 1. Objetivo

Un entorno DSH independiente y reproducible, con perfil aislado de Studio, listo para recibir la integración de Tanda 2.

## 2. Prerequisitos clasificados (H-03: ya no hay un bloqueo único)

**A. Para iniciar la Tanda 1** (entorno, versión y aislamiento):

| Prerequisito | Estado |
|---|---|
| Versión de Harness: **0.2.1-rc.2 + AgentTeams 0.1.30, ratificadas por el propietario como baseline inicial (OD-09, v3.1)**; se fijan en `studio.lock.json` (doc 27 §2); **no certifica** compatibilidad con los demás plugins; **sin actualización automática** | **decidido**; manifiesto por redactar |
| Directorio y cuenta de pruebas; `DSH_HOME` dedicado y perfil `evol-studio` aislado | por definir |
| Política de aislamiento y de red (OD-10) para decidir qué conexiones se desactivan y se prueban | propuesta |
| OD-03: **ratificada** (dsh-mnemon + Mnemon Native por defecto en instalaciones nuevas; condiciones de offline, aislamiento, procedencia y captura controlada se **comprueban** en la tanda) | decidido; condiciones por probar |

**La ausencia de `dsh-doc` de runtime en 0.2.1-rc.2 (EV-035) NO bloquea nada de A.**

**B. Para crear plugins propios (OD-21):** `evol-studio-plugin-development` preparada y validada (doc 12), con la jerarquía de fuentes de §2 de ese documento. Se prepara **dentro** de la Tanda 1, después del entorno y antes de cualquier plugin propio.

**C. Para distribución estable:** pruebas de compatibilidad del conjunto completo (doc 16).

## 3. Alcance

1. Instalación de DSH en versión fijada (sin `latest`), en un **`DSH_HOME` dedicado** y un perfil `evol-studio` aislado (no el del usuario).
2. AgentTeams `0.1.30` en versión exacta.
3. Memoria contextual local (dsh-mnemon + Mnemon Native) con almacenes por proyecto.
4. Codebase Memory MCP y su puente DSH, **sin hooks de agentes** (`--no-hooks`) y sin tocar configuración de otros agentes. **Antes** de usar su instalador en un perfil persistente se prueba en un **entorno desechable** (doc 27 §4); lo mismo para deja-vu.
5. deja-vu (`dsh-deja`) con lista cerrada de directorios.
6. Configuración de modelos (modo automático; rutas autorizadas; pruebas de esfuerzo).
7. Skills base y la skill `evol-studio-plugin-development` (OD-21), **después** de verificar las fuentes 1–3 del doc 12 en el host elegido y con referencias complementarias de procedencia verificada (sin instalarlas automáticamente).
8. Reglas de comportamiento y políticas de permisos de herramientas (aprobaciones de DSH, sandbox, guard).
9. Diagnósticos y pruebas de compatibilidad.
10. **Manifiesto reproducible** `studio.lock.json` y perfiles aislados (doc 27 §2–3); si una prueba revela una incompatibilidad bloqueante, **propuesta de cambio** documentada antes de tocar la baseline (doc 27 §5).

## 4. Verificaciones obligatorias antes de dar la tanda por hecha

| Prueba | Criterio |
|---|---|
| Carga de cada plugin | arranca y se descarga sin recursos huérfanos (10 ciclos) |
| Compatibilidad AgentTeams↔Harness | un equipo mínimo crea, ejecuta y cancela una tarea; reinicio con tarea `in_progress` |
| Selección de modelo y razonamiento | modelo por miembro funciona; el modelo global **no** cambia; se registra el esfuerzo efectivo |
| Memoria | guardar/recuperar tras reinicio; aislamiento entre dos proyectos (0 fugas) |
| Code intelligence | indexar un repositorio pequeño; frescura correcta tras un commit |
| Red | captura de tráfico durante arranque, indexación y recuperación: **0 conexiones no declaradas** |
| Configuración de agentes ajenos | **ningún** archivo de otros agentes modificado (hash antes/después) |
| Skill fundacional | casos de activación/no activación; no inventa APIs; **funciona sin `dsh-doc`** y con/sin `cordis_inspect_*`; no depende de una sola referencia externa (doc 12 §9) |
| Inspección en ejecución | comprobar si `cordis_inspect_list/query` existen en 0.2.1-rc.2 y si la documentación viaja con el paquete instalado |
| Plugins documentales candidatos (opcional) | `@baseland/dsh-evidence@beta` solo si se decide evaluarlo (doc 08 §1): licencia, dependencias, compatibilidad, offline, persistencia, aislamiento, desinstalación; **no es parte de la baseline** |
| Instaladores en entorno desechable | informe PASS/WARN/BLOCK por plugin; **solo PASS** (o WARN con opción segura repetida) habilita un perfil persistente (doc 27 §4) |
| Dos proveedores de escritura automática | sin duplicados o uno desactivado por política explícita (C-T1-06) |
| Condiciones de OD-03 | offline verificable, aislamiento por proyecto, procedencia, captura controlada, autoevolución de skills desactivada, sin dependencia cloud |
| Subagentes anidados (AMD-02, P-34) | un miembro no lanza otro miembro, o se documenta la limitación |
| Reproducibilidad del manifiesto | dos instalaciones limpias dan el mismo árbol (C-T1-10) |
| Restauración | restaurar copia de `DSH_HOME` y de los almacenes y repetir pruebas |

## 5. Contrato de entrega (informe verificable, OD-22)

El informe debe contener, cada dato con el comando que lo produjo y su salida:

1. Host y versión exacta (commit/etiqueta).
2. Plugins instalados con versiones exactas, hashes y licencias (el `studio.lock.json`).
3. Configuración activa (perfil, parches), sin secretos.
4. Capacidades verificadas (lista con resultado) y **capacidades no verificadas**.
5. Rutas de ejecución y de almacenamiento (por componente).
6. Dependencias del sistema.
7. Modelos disponibles y rutas autorizadas.
8. Skills disponibles.
9. Pruebas realizadas, resultados, errores, limitaciones.
10. Procedimiento de inicio y de **restauración**.
11. Resultado de la captura de red.
12. Qué fuentes de la jerarquía del doc 12 §2 estaban disponibles en el host y cuáles se usaron (C-01 queda **resuelta a nivel de diseño**; su verificación práctica es parte de la entrega).

**Regla:** un plugin instalado no se considera funcional sin su prueba. Un elemento sin prueba aparece como «no verificado».

## 6. No incluye

Migración de Evol-Driven, escritura en MemPalace o Engram, cambios en el perfil o en la configuración del usuario, instalación en el sistema de producción, publicación.

## 7. Condiciones de bloqueo

AgentTeams no carga en la versión elegida; algún componente falla la prueba de red o modifica configuración ajena; no es posible aislar `DSH_HOME`; un instalador comunitario obtiene **BLOCK** en el entorno desechable sin opción segura. En cualquier caso se redacta la **propuesta de cambio** (doc 27 §5); la baseline no se cambia por iniciativa propia.

## 8. Rollback

Todo vive en directorios dedicados (`DSH_HOME`, almacenes, cachés); la reversión es eliminar esos directorios y las entradas de PATH que se hubieran añadido; se verifica con un inventario de archivos antes/después.
