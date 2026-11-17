# 11 — Modelo de seguridad y Approval Broker (v3, corrige H-01 y H-05)

Estado: **diseño; nada probado**. Harness no tiene auditoría de seguridad (EV-015); las defensas deben ser propias y verificables. Invariante nueva de v3: **no existe ninguna ruta documentada por la que un agente pueda aprobar o avanzar una fase protegida eludiendo el Approval Broker, tampoco como rollback ni como emergencia.**

## 1. Por qué un botón, un TTY o una cookie no bastan

Cualquier proceso del mismo usuario puede controlar un navegador, abrir una pseudo-terminal, llamar al mismo RPC o escribir los mismos archivos. La autorización necesita una credencial que el agente no posea y un proceso que no pueda impersonar. **El estado actual del framework es declarativo:** `evol approve` exige terminal interactiva (`ESPECIFICACION.md:47`), Claude Code recibe `permissions.deny` para `approve` y `next` (`:1239`), y las amenazas T-1 y T-3 admiten que un agente con lectura amplia puede leer la clave del gate (`~/.config/evol/keys/<id>.key`) o credenciales por un script, con una regla de bloqueo del IDE como única mitigación (EV-052). Eso es una **regla de configuración del IDE, no una frontera de proceso**; el Broker no debe heredarla como garantía.

## 2. Approval Broker mínimo

Proceso local pequeño, **separado** del host de Harness y de los agentes, con acceso de escritura exclusivo a la clave de firma y a `gate-log.jsonl`. Reutiliza `gate.ts` (cadena, hashes de artefactos, ciclo); no crea un segundo sistema de aprobaciones.

**Operaciones** (solo estas, y ninguna es herramienta de agente):
1. `request(fase, ciclo)` → paquete de revisión (fase, artefactos con hash, `verify`, evidencias, bloqueos) + `request_id` + `nonce` de un solo uso.
2. `authorize(request_id, prueba_humana)` → revalida hashes y `HEAD` y añade la entrada firmada (aprobación).
3. `advance(request_id)` → **operación distinta**: llama a Core solo si hay aprobación vigente (transición).
4. `reject(request_id, motivo)` y `invalidate(...)` → registran rechazo/invalidación.
5. `status()` y `history()` → lectura del registro.
6. `diagnose()` → estado del propio broker (sin secretos).

**Qué no hace:** ejecutar trabajo, hablar con modelos, leer memoria, aceptar peticiones de herramientas de agentes.

**Decisión pendiente sobre la firma (sin resolver, requiere aprobación porque cambia el formato del registro):** el gate usa HMAC con clave simétrica; **quien verifica puede falsificar**. Para que Core, la UI y los agentes verifiquen sin poder firmar hace falta o bien (a) que la verificación de la cadena la ofrezca solo el broker, o bien (b) firmas **asimétricas** (clave privada en el broker, pública para verificar), conservando compatibilidad de lectura con entradas HMAC antiguas. Se registra como sub-decisión de OD-04 (ver doc 02).

## 3. Prueba de presencia humana (a decidir; ninguna opción se da por suficiente sin prueba)

| Opción | Resiste a un agente del mismo usuario | Comentario |
|---|---|---|
| B. Llave de hardware (FIDO2/WebAuthn) | **sí** | recomendada como factor principal |
| C. Broker en otra cuenta de sistema, con socket de permisos estrictos | **sí** (según permisos) | protege la clave de firma |
| A. PIN/contraseña ante el broker | parcial | un agente que controle terminal o navegador puede capturarla; solo como factor adicional |
| D. TTY | **no por sí sola** | **nunca sustituto automático** de la autenticación humana protegida; a lo sumo, un factor adicional o una vista |
| E. Sesión web | no | insuficiente por sí sola |

**Recomendación (sin probar):** C + B. Elección y viabilidad en Arch Linux requieren aprobación y prueba (OD-04 sigue abierta en este punto).

## 4. Roles y cumplimiento

| Rol | Puede | No puede | Cumplimiento real |
|---|---|---|---|
| Reader | consultar estado, resultados registrados, evidencias, historial | ejecutar verificaciones, escribir | tabla de permisos en `core`, aplicada en backend |
| Operator | ejecutar verificaciones, indexar, diagnosticar, guardar checkpoint/memoria con fuente | aprobar, avanzar, editar el log | idem + sandbox de Harness |
| Reviewer | emitir veredicto independiente, registrar interrogación del plan | aprobar; revisar su propio trabajo | sesión separada de solo lectura |
| Approver | autorizar mediante el broker | alterar artefactos tras autorizar (invalida) | prueba humana del broker |
| Administrator | configuración, plugins, disciplinas, proveedores | falsificar el log | cambios registrados, con respaldo y, si invalidan aprobaciones, vía broker |

La asignación de cada operación a un rol sale de **efectos reales** (doc 10). Un rol visual no es un control de seguridad: toda operación se valida otra vez en el backend con la identidad provista por el broker/host, no por el cliente.

## 5. Experiencia unificada «Autorizar avance» (H-05)

**Una sola acción para la persona; dos operaciones internas, dos registros.** El botón **Autorizar avance** inicia una operación supervisada:

| Paso | Qué ocurre | Registro |
|---|---|---|
| 1 | Paquete de revisión: fase, artefactos y hashes, resultado de verificación, pruebas, evidencias, bloqueos, solicitud, historial | `request` |
| 2 | Solicitud de autorización humana (factor B/C) | — |
| 3 | Validación de identidad y rol Approver | — |
| 4 | **Registro de la aprobación** en `gate-log` | **aprobación** (entrada firmada) |
| 5 | **Revalidación** de condiciones (hashes, `HEAD`, verificación, ausencia de bloqueos) | — |
| 6 | **Transición** controlada | **transición** (evento en journal/estado) |
| 7 | Resultado mostrado | — |

Reglas: la transición **no se ejecuta si falla el registro de la aprobación**; no se asume que una aprobación previa siga vigente si cambiaron artefactos o `HEAD`; los registros de aprobación y de transición **no se fusionan**; la separación transaccional se conserva. La interfaz puede ofrecer, en controles avanzados, consultar aprobaciones y transiciones por separado.

**Estados visuales:** Pendiente de verificación · Verificación fallida · Listo para revisión · Esperando autenticación · Aprobado, pendiente de transición · Avance completado · Aprobación invalidada · Error recuperable · Operación bloqueada.

## 6. Política de fallo y recuperación (H-01)

**Si el Approval Broker falla, las operaciones protegidas permanecen bloqueadas hasta recuperar un mecanismo de autorización equivalente y verificado.**

| Se permite durante el fallo | No se permite |
|---|---|
| consultar estado | firmar aprobaciones por una ruta menos protegida |
| revisar evidencias | avanzar fases protegidas |
| ejecutar diagnósticos autorizados | exponer herramientas de aprobación a agentes |
| inspeccionar logs (sin secretos) | usar `evol approve` por terminal como sustituto automático |
| recuperar servicios, restaurar configuración validada | usar una confirmación TTY como autenticación humana protegida |
| consultar el historial de aprobaciones | un bypass genérico o una «puerta de emergencia» general |

**Procedimiento de recuperación administrativa (diseño):**
1. **Detección:** el host sondea `diagnose()`; fallo de socket, de integridad o de credencial.
2. **Bloqueo:** el host marca *protegido = bloqueado*; el Approval Center muestra «Operación bloqueada»; cualquier `request/authorize/advance` responde «broker no disponible».
3. **Diagnóstico:** solo lectura (proceso del broker, permisos del socket, integridad de la cadena, estado de la clave, hora).
4. **Recuperación del broker:** reinicio por el Administrador desde su cuenta; no desde una sesión de agente.
5. **Verificación de credenciales:** el factor de presencia (llave) se verifica con una operación de prueba que no firma; la clave de firma se comprueba por huella, sin mostrarla.
6. **Conciliación del estado:** `state.json` ↔ registro firmado (`expectedPhase`); cualquier discrepancia mantiene el bloqueo y se documenta (OD-16).
7. **Revalidación de evidencia:** las solicitudes pendientes **caducan**; los paquetes de revisión se recalculan (hashes y `HEAD`).
8. **Restauración del servicio:** se levanta el bloqueo solo cuando las pruebas P-15 y la conciliación pasan.
9. **Registro del incidente:** entrada no firmada de aprobación (no es una aprobación) con causa, duración y acciones; conservada en el journal.

**Vía de emergencia:** no se habilita por defecto. Solo podría existir si (i) ofrece garantías equivalentes (mismo factor de presencia y mismo proceso aislado), (ii) está aislada del agente (otra cuenta, sin alcance desde sesiones de agente), (iii) requiere autorización explícita y previa del propietario registrada, y (iv) queda registrada como incidente. **Documentalmente no se define ningún bypass.**

## 7. Amenazas y controles

| Amenaza | Vector | Control |
|---|---|---|
| Autoaprobación por CLI/MCP/RPC/TTY | herramienta o proceso del agente | `approve`, `next` y `ciclo nuevo` no existen como herramienta MCP ni como `@Remote`; el broker no escucha en red y verifica el factor humano; P-03 |
| Rollback inseguro (H-01) | recuperar usando el comando histórico | **prohibido**; política de fallo cerrado de §6; el roadmap ya no lo menciona |
| Suplantación de la persona | agente controla navegador/UI | llave física y proceso aparte |
| Reutilización de autorización | replay | `nonce` único; hashes y `HEAD` revalidados; P-04 |
| Lectura de la clave del gate | agente con permiso de lectura amplio (T-1) | clave bajo la cuenta del broker; las reglas de bloqueo del IDE quedan como capa adicional, **no** como control principal |
| Modificación directa del registro | escritura en `.evol/` | solo el broker escribe `gate-log`; Core verifica la cadena en cada lectura |
| Salto de fase por `state.json` (T-2) | edición manual | `doctor` ya lo detecta (CA-134, EV-045); v3 exige que `verify`, `approve` y `advance` **bloqueen** ante discrepancia (OD-16); P-06 |
| Ejecución de comandos de config vía verificación | agente edita `comandos` y llama a `evol_verify` | la configuración es artefacto con hash: un cambio invalida la aprobación; la UI muestra los comandos antes de ejecutarlos; `verify` fin = Operator (doc 10) |
| Elusión por operación alternativa | `disciplines disable`, edición de config, `skills approve`, `ciclo nuevo` | todas las operaciones OP/MC protegidas pasan por el broker |
| Prompt injection | documentos, memoria, repositorios | contenido como dato; el agente no tiene capacidad de aprobar aunque «quiera» |
| Procesos huérfanos y servicios locales | daemons, UIs locales | solo loopback con token; registro de PIDs; cierre limpio probado |
| Plugins de terceros | código al instalar | hashes, lista de permitidos, revisión previa; sin `latest` |
| Exposición de código a inferencia remota | modelos remotos | indicador visible y política explícita |

## 8. Revisión de rutas indirectas de aprobación (búsqueda en toda la documentación v2)

| Documento | Referencia encontrada | Resolución v3 |
|---|---|---|
| 15-roadmap H7 | «Rollback: volver a `evol approve` por terminal humano» | **eliminada**; rollback = bloqueo y recuperación del §6 |
| 10-inventario | `approve`/`next` con «solo CLI para el broker/persona» | `approve` y `next` solo vía broker; no hay equivalente CLI accesible a agentes |
| 09-módulos | botón «Autorizar» y operaciones `approval.*` | flujo unificado; sin ruta alternativa |
| 07-contratos | «Cerrar tarea para Evol» | no aprueba fases |
| 14-tanda-2 | «la operación de aprobar es la última en habilitarse» | se conserva y se añade política de fallo cerrado |
| 11 v2 §8 | «volver a terminal humano» (riesgos residuales) | reescrito |

## 9. Pruebas (todas pendientes; ninguna ejecutada)

| ID | Prueba | Resultado esperado |
|---|---|---|
| P-01 | Reader intenta escribir/ejecutar por UI, wrapper de CLI y MCP | denegado; las lecturas permitidas funcionan |
| P-02 | Reader intenta operaciones de clase XP/EP/ED (verify fin, doctor, index, security scan, checkpoint, memory add) | denegado en las tres vías |
| P-03 | Un agente intenta `approve`, `next`, `ciclo nuevo`, `disciplines`, `skills approve` por CLI, MCP, RPC, herramienta, TTY y automatización de navegador | **todas fallan** |
| P-04 | Replay de una autorización | rechazado |
| P-05 | Un byte cambiado en un artefacto tras autorizar | transición bloqueada |
| P-06 | `state.json` editado a una fase posterior | detectado y operaciones protegidas bloqueadas |
| P-07 | Un agente intenta leer la clave del broker | denegado |
| P-08 | Dos autorizaciones simultáneas | una entrada, sin corrupción |
| P-09 | Prompt injection pide aprobar | ninguna entrada creada |
| P-10 | El autor del plan intenta registrar su interrogación | denegado |
| P-11 | Operaciones de Administrator sin rol / sin vista previa | denegadas; reversibles |
| P-12 | Operaciones *provisional* Reader: hash antes/después de `.evol/`, el árbol y el HOME de config | sin cambios |
| P-13 | Operaciones LS: tráfico saliente y alcance de proyecto | 0 conexiones no declaradas; sin resultados de otro proyecto |
| P-14 | Equivalencia UI/CLI/MCP | mismo permiso y mismo registro |
| P-15 | **Broker caído**: intentar `approve` por cualquier vía, avanzar, usar `evol approve` | todo bloqueado; consultas, diagnósticos e historial funcionan; ninguna ruta alterna |
| P-16 | Cookie de sesión web robada sin factor | autorización imposible |
| P-17 | Vía de emergencia (si existiera) accesible desde una sesión de agente | inaccesible |

## 10. Riesgos residuales

Un agente con control del usuario local (misma cuenta, misma pantalla, sin cuenta separada ni llave) puede imitar la presencia humana; las opciones B y C lo reducen sin eliminarlo. La seguridad de Harness no está auditada. El diseño asume un adversario «agente defectuoso o manipulado», no un atacante con root. Hasta que P-03 y P-15 se ejecuten, **la garantía de ausencia de bypass es de diseño, no demostrada**.
