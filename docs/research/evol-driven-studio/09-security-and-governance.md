# 09 — Seguridad y gobernanza (R6)

Evidencia: EV-004, 005, 006, 007, 015, 019, 021, 022, 027. **Punto de partida:** Harness declara que no ha tenido auditoría de seguridad (EV-015). Ningún control de este documento se ha probado en ejecución.

## 1. Modelo de amenazas (STRIDE resumido)

| Activo | Amenaza | Vector | Control actual | Control propuesto |
|---|---|---|---|---|
| Registro de aprobaciones (`gate-log`) | Manipulación | agente con escritura en `.evol/` | HMAC encadenado (EV-005) | proteger la clave fuera del proyecto; ejecutar `verifyChain` al arrancar y en cada lectura del Control Center |
| Estado (`state.json`) | **Salto de fase** | edición directa (EV-006) | ninguno | derivar la fase del log o firmar el estado; alerta de discrepancia |
| Aprobación | Suplantación del aprobador / autoaprobación | herramienta del modelo que invoque `evol approve` | TTY en terminal | el Control Center no ofrece firma accesible al modelo; prueba de que el agente no puede abrir un TTY de aprobación |
| Herramientas MCP mutantes | Escritura no autorizada | `evol_memory_add`, `evol_checkpoint`, `evol_index` sin anotación (EV-004) | ninguno | anotaciones + gate de rol; separar herramientas de lectura |
| Memoria | Inyección persistente (prompt injection almacenado) | recuerdos importados o texto de repositorios | tratar como datos (norma del CLAUDE.md) | etiquetar origen y estado; no recuperar por defecto transcripciones; filtro de secretos al guardar |
| Código y secretos | Exposición | agente lee fuera del proyecto; embeddings/LLM remotos | sandbox de Harness (parcial) | política de rutas por proyecto; declarar si la inferencia es local |
| Plugins de terceros | Código arbitrario | `dsh plugin add` ejecuta código del paquete | ninguno propio | lista de permitidos con hash; revisión previa con las skills de auditoría de Evol; versiones fijadas |
| Servicios HTTP locales | Acceso desde otros procesos/navegador | UI de CBM en `localhost:9749`, `mnemon web` en 8484, Harness web | auth por token en Harness; resto sin verificar | enlazar solo a loopback, puerto fijo, token y comprobar `Origin`/DNS rebinding |
| Daemon de CBM | Estado compartido entre proyectos y clientes | un daemon por cuenta (EV-027) | — | un proceso por proyecto o aislamiento demostrado antes de adoptarlo |
| Actualizaciones | Cadena de suministro | scripts de instalación remotos, `npx` | hashes y firmas de Evol | no ejecutar scripts remotos; instalar desde artefactos verificados (hash, firma) |
| Procesos huérfanos | Sobreviven al host | daemons (CBM), servidores | — | prueba de cierre limpio; registro de PIDs por proyecto |
| Verificaciones | Manipulación del resultado | el agente reescribe la salida | `verify` determinista | el veredicto lo ejecuta quien revisa; versión del verificador en lo firmado (lección CA-146) |

## 2. Modelo de permisos (propuesta; no existe hoy)

| Rol | Puede | No puede | Mecanismo real necesario |
|---|---|---|---|
| **Reader** | consultar estado, memoria, grafo | escribir | herramientas anotadas como solo lectura + servidor MCP de lectura separado |
| **Operator** | crear trabajos, ejecutar herramientas autorizadas, guardar memoria con fuente | aprobar, editar el log | gate en `evolBridge` por rol; sandbox de Harness |
| **Reviewer** | emitir veredicto independiente | aprobar; modificar lo revisado | sesión distinta con permisos de lectura, resultado firmado por el verificador |
| **Approver** | aprobar una fase | modificar artefactos tras aprobar (invalida) | TTY humano con clave local |
| **Administrator** | configurar perfiles, plugins, proveedores | falsificar el log | configuración con respaldo; cambios registrados |

**No existe hoy ningún mecanismo que haga cumplir estos roles** a nivel de Evol. Harness aporta aprobaciones de herramientas, `guard`, sandbox por proceso (bwrap/Landlock en Linux, con cumplimiento «full/partial») y sesiones aisladas, pero su SAFETY.md aclara que no son una garantía de aislamiento. **Una instrucción de sistema al agente no es una frontera de seguridad**: las prohibiciones deben ser técnicas (permisos de archivo y de proceso, herramientas no expuestas, verificación en el host).

## 3. Invariantes y cómo se harían cumplir

| Invariante | Mecanismo propuesto | Prueba |
|---|---|---|
| Agentes no se autoaprueban | `approve` solo con TTY humano; ninguna herramienta MCP lo expone; el proceso del agente corre sin TTY ni acceso a la clave | intentar aprobar desde una herramienta debe fallar |
| Un cambio documental invalida aprobaciones | ya existe (`findValidApproval`, hashes de artefactos) | cambiar un byte y verificar `next` bloqueado |
| El Control Center no edita registros firmados | `evolBridge` solo expone `appendApproval` interno desde TTY; el log está fuera del alcance de escritura del plugin | permisos de archivo + prueba |
| La memoria no sustituye evidencia | `MemoryItem.fuente` obligatoria; las verificaciones solo cuentan si provienen de un comando registrado | prueba de contrato |
| Un resumen de agente no sustituye el estado | secciones calculadas de checkpoint (RF-1) | comparación con `git diff` |
| Aislamiento por proyecto | un lock, un almacén y un wing/store por proyecto; rutas canónicas verificadas | pruebas de rutas cruzadas |
| La recuperación no reejecuta acciones antiguas sin revalidar | tareas con precondiciones comprobables; reintento solo si el hash de artefactos sigue igual | prueba de reinicio |

## 4. Política de actualizaciones y red

Por defecto sin tráfico saliente salvo el proveedor de modelos elegido; actualizaciones solo por acción explícita, con verificación de hash y firma. Cada componente adoptado pasa un **escaneo de red** (doc 11) antes de entrar al perfil estable.
