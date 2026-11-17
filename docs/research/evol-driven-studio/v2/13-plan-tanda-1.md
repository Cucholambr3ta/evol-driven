# 13 — Plan de Tanda 1: preparación de DSH

Responsable de los prompts: ChatGPT (según el encargo). Esta tanda **no migra Evol-Driven**. Este documento fija prerrequisitos, alcance, pruebas y el **contrato de entrega**; no instala nada.

## 1. Objetivo

Un entorno DSH independiente y reproducible, con perfil aislado de Studio, listo para recibir la integración de Tanda 2.

## 2. Decisiones previas (bloquean el inicio)

| Decisión | Por qué bloquea |
|---|---|
| **OD-09 / C-01:** versión exacta de Harness y de la skill `dsh-doc` | 0.2.1-rc.2 no trae la skill de runtime (EV-035); 0.2.2-rc.3 no está en la matriz de AgentTeams (EV-036) |
| OD-03: ratificar proveedor de memoria (o aceptar la baseline para nuevas instalaciones) | define qué plugin se instala |
| OD-10: política de red | define qué conexiones se desactivan y se prueban |
| Directorio de pruebas y usuario/cuenta del entorno | aislamiento |

## 3. Alcance

1. Instalación de DSH en versión fijada (sin `latest`), en un **`DSH_HOME` dedicado** y un perfil `evol-studio` aislado (no el del usuario).
2. AgentTeams `0.1.30` en versión exacta.
3. Memoria contextual local (dsh-mnemon + Mnemon Native) con almacenes por proyecto.
4. Codebase Memory MCP y su puente DSH, **sin hooks de agentes** (`--no-hooks`) y sin tocar configuración de otros agentes.
5. deja-vu (`dsh-deja`) con lista cerrada de directorios.
6. Configuración de modelos (modo automático; rutas autorizadas; pruebas de esfuerzo).
7. Skills base y la skill `evol-studio-plugin-development` (OD-21).
8. Reglas de comportamiento y políticas de permisos de herramientas (aprobaciones de DSH, sandbox, guard).
9. Diagnósticos y pruebas de compatibilidad.

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
| Skill fundacional | casos de activación/no activación; no inventa APIs |
| Restauración | restaurar copia de `DSH_HOME` y de los almacenes y repetir pruebas |

## 5. Contrato de entrega (informe verificable, OD-22)

El informe debe contener, cada dato con el comando que lo produjo y su salida:

1. Host y versión exacta (commit/etiqueta).
2. Plugins instalados con versiones exactas, hashes y licencias.
3. Configuración activa (perfil, parches), sin secretos.
4. Capacidades verificadas (lista con resultado) y **capacidades no verificadas**.
5. Rutas de ejecución y de almacenamiento (por componente).
6. Dependencias del sistema.
7. Modelos disponibles y rutas autorizadas.
8. Skills disponibles.
9. Pruebas realizadas, resultados, errores, limitaciones.
10. Procedimiento de inicio y de **restauración**.
11. Resultado de la captura de red.
12. Decisión sobre C-01 y sobre qué referencias de `dsh-doc` se usan.

**Regla:** un plugin instalado no se considera funcional sin su prueba. Un elemento sin prueba aparece como «no verificado».

## 6. No incluye

Migración de Evol-Driven, escritura en MemPalace o Engram, cambios en el perfil o en la configuración del usuario, instalación en el sistema de producción, publicación.

## 7. Condiciones de bloqueo

C-01 sin resolver; AgentTeams no carga en la versión elegida; algún componente falla la prueba de red o modifica configuración ajena; no es posible aislar `DSH_HOME`.

## 8. Rollback

Todo vive en directorios dedicados (`DSH_HOME`, almacenes, cachés); la reversión es eliminar esos directorios y las entradas de PATH que se hubieran añadido; se verifica con un inventario de archivos antes/después.
