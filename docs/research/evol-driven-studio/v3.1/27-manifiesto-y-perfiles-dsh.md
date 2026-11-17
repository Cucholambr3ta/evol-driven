# 27 — Manifiesto reproducible, perfiles DSH aislados y prueba de instaladores

Estado: **preparación documental de la Tanda 1; no se instala nada.** Cubre lo autorizado en la directiva v3.1 §1 (baseline fijada y manifiesto reproducible, sin actualización automática) y §5 (perfiles aislados; revisión de efectos de Codebase Memory y deja-vu; prueba en entorno desechable).

## 1. Baseline ratificada (OD-09)

| Componente | Versión exacta | Procedencia conocida (doc 16, a completar al fijar) |
|---|---|---|
| DeepSeek Harness | **0.2.1-rc.2** | commit `687f282e8625c6b8d11ff58211a90524be2e4317` (2026-10-17); npm exacta, no `latest` (EV-073) |
| dsh-agent-teams (AgentTeams) | **0.1.30** | commit `4354b0f` |

Esto **no certifica** compatibilidad con los demás plugins. Cualquier otra versión (incluidas `0.2.2-rc.*` y `latest`) queda **fuera** de la baseline hasta una propuesta de cambio aprobada (§5).

## 2. Manifiesto reproducible (`studio.lock.json`, formato propuesto)

Un archivo versionado, **de solo lectura para los agentes**, que describe exactamente qué se instala. Cualquier diferencia entre lo instalado y el manifiesto es un hallazgo de `Diagnósticos`.

| Campo | Contenido | Regla |
|---|---|---|
| `schema` | versión del formato | versionado |
| `baseline` | `{ harness: {version, fuente, commit(40), integridad}, agentteams: {…} }` | versión exacta; **sin rangos ni `latest`** |
| `entorno` | Node, SO, arquitectura, gestor de paquetes y su versión | reproducible |
| `plugins[]` | `{nombre, versión exacta, fuente (registro o repositorio), commit(40) o integridad (sha512/sha256), licencia SPDX, peerDependencies, compatibilidad declarada, probada_aquí: sí/no, salida de datos declarada, instalador: {modifica_config_de_agentes: sí/no, opciones seguras}}` | un hash verificado en la instalación; sin hash, no se instala |
| `perfil` | ruta del `DSH_HOME` dedicado y del perfil `evol-studio` | aislado (§3) |
| `enrutamiento_de_modelos` | huella de la configuración (doc 06) | opcional |
| `politicas` | red, telemetría, escritura automática de memoria | por componente |
| `huella_del_manifiesto` | hash del propio archivo | cambia solo mediante propuesta aprobada |

**Entradas ya conocidas (a completar con hashes al instalar; no se inventan aquí):** dsh-mnemon 0.5.46 (`048972f`), Mnemon (motor, `7313b92`, Apache-2.0), Codebase Memory MCP (`cdfdf26`) y su puente `dsh-codebase-memory-mcp` 0.1.10 (`533c6ca`), deja-vu / `dsh-deja` (`6cda100`). **Opcionales fuera de baseline:** `@baseland/dsh-evidence` (beta), skills comunitarias de AgentTeams y Engram/MemPalace como alternativas históricas.

**Prueba de reproducibilidad (a ejecutar en la Tanda 1):** dos instalaciones limpias desde el manifiesto producen el mismo árbol de código (hash) y las mismas versiones resueltas; si no, el manifiesto es insuficiente.

## 3. Perfiles de DSH aislados

| Elemento | Regla |
|---|---|
| `DSH_HOME` | **dedicado** a Studio; nunca el de uso personal |
| Perfil | `evol-studio`, creado desde cero; sin importar configuración de otros agentes |
| Configuración de otros agentes (`~/.claude`, `~/.config/opencode`, `~/.codex`, `~/.hermes`, etc.) | **no se modifica**; lo que un instalador quiera escribir allí se imprime, no se escribe (spec `:1237`) |
| Datos | almacenes por proyecto; sin compartir entre proyectos |
| Red | desactivada por defecto para cada plugin hasta declarar y probar su salida (OD-10) |
| Procesos | los *daemons* se enumeran, se registran sus PID y se cierran limpiamente (prueba en doc 11 §9) |
| Desinstalación | borrar el perfil y el `DSH_HOME` deja el sistema como estaba (prueba §4) |
| Promoción a perfil persistente | solo tras superar la prueba de §4 con veredicto PASS |

## 4. Prueba de instaladores en entorno desechable (Codebase Memory, deja-vu y cualquier plugin)

**Objetivo:** conocer *antes* qué escribe un instalador, qué procesos deja y a qué se conecta.

1. **Entorno:** un `HOME` temporal y vacío y, preferiblemente, una jaula con aislamiento de sistema de archivos y **sin red** (la spec lista `bubblewrap` y `strace` como disponibles en la máquina actual, `:973-974`; en el equipo nuevo hay que comprobarlo); como alternativa, un contenedor o máquina virtual descartable.
2. **Línea base:** hash del árbol del `HOME` temporal, lista de configuraciones de agentes esperables, variables de entorno, *shims* en `PATH`, archivos de arranque del intérprete de órdenes, unidades de usuario.
3. **Ejecución:** el instalador con sus opciones más restrictivas (`--no-hooks` y equivalentes) y, por separado, con las opciones por defecto, **en dos ejecuciones distintas**.
4. **Captura:** archivos creados o modificados, procesos y *daemons* lanzados, intentos de conexión (con la red cortada se ven como fallos registrados) y variables escritas.
5. **Comparación:** diferencia contra la línea base; todo lo escrito **fuera del perfil de Studio** se lista.
6. **Veredicto:** **PASS** (nada fuera del perfil, sin red no declarada, desinstalación limpia), **WARN** (efectos fuera del perfil que se pueden evitar con una opción documentada), **BLOCK** (escribe configuración de agentes o abre red sin opción para impedirlo).
7. **Informe** `installer-report` por plugin: versión, hash, opciones, efectos, veredicto. Solo un PASS (o un WARN con la opción segura aplicada y repetida la prueba) habilita su uso en un perfil persistente.

Condiciones de entrada ya declaradas para Codebase Memory (OD-05): 0 conexiones salientes, 0 cambios en la configuración de agentes, aislamiento verificable.

## 5. Propuesta de cambio de baseline (si la compatibilidad falla)

Si una prueba de la Tanda 1 muestra una **incompatibilidad bloqueante**, no se cambia nada por iniciativa propia. Se redacta una propuesta con: identificador; componente y versiones; síntoma con **evidencia reproducible**; alcance e impacto en OD y en los planes; alternativas (otra versión fija, parche documentado, sustituir el plugin, esperar al autor); riesgos y esfuerzo; efecto en `studio.lock.json`; pruebas de regresión necesarias; **decisión del propietario**. Hasta entonces la baseline vigente es la del §1. **DSH no se actualiza automáticamente**: no hay `latest`, ni *auto-update*, ni resolución de rangos.

## 6. Pruebas de compatibilidad de la Tanda 1 (todas pendientes)

| ID | Prueba | Aceptación |
|---|---|---|
| C-T1-01 | AgentTeams 0.1.30 carga y ejecuta un equipo mínimo en DSH 0.2.1-rc.2 | carga limpia; estados y transiciones de tarea observables |
| C-T1-02 | Costuras privadas de subagentes de AgentTeams (EV-036) con esa versión | funcionan o se documenta la limitación |
| C-T1-03 | dsh-mnemon + Mnemon Native: captura y recuperación; sin red; aislamiento por proyecto | condiciones de OD-03 cumplidas |
| C-T1-04 | Codebase Memory + puente: indexación, consulta e impacto sin hooks | condiciones de entrada de OD-05 |
| C-T1-05 | deja-vu con lista cerrada de directorios | sin lectura fuera de la lista |
| C-T1-06 | **Dos proveedores de escritura automática** sobre las mismas sesiones | sin duplicados, o desactivado uno por política explícita |
| C-T1-07 | Selección de modelos, perfiles y razonamiento (EV-039) en 0.2.1-rc.2 | comportamiento documentado; sin atribuir reglas de 0.2.2 |
| C-T1-08 | Ausencia de `dsh-doc` de runtime: la skill propia funciona con la jerarquía de fuentes | sí / no, con evidencia |
| C-T1-09 | Un miembro de AgentTeams intenta lanzar otro miembro (AMD-02, P-34) | denegado o inexistente |
| C-T1-10 | Reproducibilidad del manifiesto (§2) | árbol idéntico |

## 7. Qué queda preparado y qué no

**Preparado:** versiones decididas, formato del manifiesto, reglas de perfil aislado, protocolo de prueba de instaladores, procedimiento de cambio de baseline, matriz de pruebas de Tanda 1. **No hecho:** instalar DSH o plugins; calcular los hashes (se obtienen al descargar); decidir el método exacto de instalación de DSH 0.2.1-rc.2 en el equipo de destino (depende de su documentación, a comprobar en la Tanda 1); verificar la viabilidad de la llave FIDO2 y de la cuenta del broker (EV-070).
