# 11 — Modelo de seguridad y Approval Broker (OD-04, OD-11)

Estado: **diseño; nada probado**. Harness declara que no tiene auditoría de seguridad (EV-015): las defensas de este documento deben ser propias y verificables, no delegadas a Harness.

## 1. Qué prohíbe OD-04 y por qué un botón no basta

Un clic en un navegador es una acción de **un proceso de usuario**: cualquier agente que corra bajo el mismo usuario puede, en principio, abrir ese navegador, controlarlo (automatización), llamar al mismo RPC o escribir los mismos archivos. Un TTY tampoco prueba presencia humana (un agente puede abrir una pseudo-terminal). Por tanto la autorización necesita **una credencial que el agente no posea y un proceso que el agente no pueda impersonar**.

## 2. Approval Broker mínimo

**Qué es:** un proceso local pequeño, **separado** del host de Harness y de los agentes, único con acceso de escritura a la clave de firma y a `gate-log.jsonl`. Reutiliza el mecanismo existente (`gate.ts`: HMAC encadenado, hashes de artefactos, ciclo); no crea un segundo sistema de aprobaciones.

**Operaciones expuestas** (solo estas):
1. `request(fase, ciclo)` → calcula un *paquete de revisión* (fase, artefactos con hash, resultado de `verify`, evidencias, bloqueos) y le asigna `request_id` + `nonce` de un solo uso.
2. `authorize(request_id, prueba_humana)` → revalida (hashes y `HEAD` iguales), añade la entrada firmada.
3. `reject(request_id, motivo)` → registra rechazo (hoy no existe: fortalece la medición de rechazos).
4. `advance(request_id)` → **operación distinta** que solo llama a Core si hay aprobación vigente.

**Qué no hace:** no ejecuta trabajo, no habla con modelos, no lee memoria, no acepta peticiones de herramientas del agente.

## 3. Prueba de presencia humana (opciones a decidir; ninguna se da por suficiente sin prueba)

| Opción | Cómo funciona | Resiste a agente del mismo usuario | Costo | Nota |
|---|---|---|---|---|
| A. Credencial humana fuera del alcance del agente (contraseña/PIN en el broker, no almacenada en archivos legibles por el agente) | el broker pide el secreto en su propia ventana/pantalla | parcialmente: un agente podría capturar entrada si controla el terminal/navegador | bajo | combinar con B |
| B. **Llave de hardware / WebAuthn/FIDO2** | gesto físico del usuario | **sí** (el agente no puede tocar la llave) | medio | recomendada como factor principal |
| C. Cuenta de sistema distinta (el broker corre como otro usuario; sockets con permisos) | separación por SO | **sí** (según permisos) | medio-alto | evita que el agente lea la clave de firma |
| D. TTY | pide en terminal | no por sí sola | bajo | solo como factor adicional |
| E. Sesión web autenticada | cookie/token | no | bajo | **insuficiente por sí sola** |

**Recomendación:** C + B (broker en cuenta distinta, con confirmación por llave física), con D/E como interfaz de presentación. Es una propuesta; la elección y su viabilidad en Arch Linux requieren aprobación y prueba (OD-04 queda abierta en este punto).

## 4. Roles y cómo se hacen cumplir

| Rol | Puede | No puede | Cumplimiento real |
|---|---|---|---|
| Reader | leer estado, memoria, grafo | escribir | operaciones de lectura en `studioBridge`; MCP de lectura separado |
| Operator | crear/cancelar trabajos, indexar, proponer memoria | aprobar, editar el log | autorización por operación en el backend; sandbox/guard de Harness |
| Reviewer | emitir veredicto independiente | aprobar, modificar lo revisado | sesión separada, solo lectura; veredicto firmado por el verificador |
| Approver | autorizar avance | alterar artefactos tras autorizar (invalida) | prueba humana del broker |
| Administrator | configurar perfiles, plugins, proveedores | falsificar el log | cambios registrados y con respaldo |

**Un rol visual no es un control de seguridad**: todo se valida otra vez en el backend, con identidad del solicitante verificada; la identidad la provee el broker/host, no el cliente.

## 5. Amenazas y controles

| Amenaza | Vector | Control |
|---|---|---|
| Autoaprobación por CLI/MCP/RPC | herramienta que invoque `evol approve`/RPC del broker | `approve` y `advance` **no** se registran como herramientas MCP ni como `@Remote` del host; el broker no escucha en red; prueba negativa obligatoria |
| Suplantación de la persona | agente controla navegador/UI | llave física (B) y proceso aparte (C) |
| Reutilización de autorización | replay | `nonce` de un solo uso + hashes y `HEAD` revalidados |
| Modificación directa del log | escritura en `.evol/` | permisos: solo el broker escribe `gate-log`; Core verifica la cadena en cada lectura |
| Salto de fase por `state.json` | edición de estado | verificación estado↔log; bloqueo (OD-16, EV-006) |
| Elusión por una operación alternativa | `next`, `ciclo nuevo`, `disciplines disable`, edición de config | todas las operaciones protegidas pasan por el broker; cambios de disciplinas invalidan aprobaciones |
| Prompt injection (documentos, memoria, repos) | contenido hostil | tratar como dato; el agente no tiene capacidad de aprobar aunque «quiera» |
| Procesos huérfanos / servicios locales | daemons de CBM, `mnemon web`, UIs locales | solo loopback con token; registro de PIDs; cierre limpio probado |
| Credenciales locales | claves de modelo y de firma | almacén de credenciales de DSH para proveedores; clave de firma fuera del alcance del agente |
| Plugins de terceros | código al instalar | hashes, lista de permitidos, revisión previa, sin `latest` |
| Subprocesos del agente | shell/PTC/browser-use | sandbox de Harness como capa adicional, no única |
| Exposición accidental de código | inferencia remota | indicador visible de flujo remoto y política explícita |

## 6. Secuencia de autorización (contractual)

```
Studio UI ── request(fase) ──► Broker ── calcula paquete + nonce ──► UI muestra revisión
persona ── confirma con llave física ──► Broker ── revalida hashes/HEAD ──► añade entrada firmada
persona ── "Avanzar" (operación separada) ──► Broker ── comprueba aprobación vigente ──► Core.advance
```
Rechazo, invalidación (cambio de artefacto o de `HEAD`) y recuperación (broker reiniciado: la cadena se reverifica; las solicitudes sin confirmar caducan) están especificadas; los plazos de caducidad son parámetro por decidir.

## 7. Pruebas (todas pendientes, ninguna ejecutada)

1. Un agente intenta `approve` por CLI, MCP, RPC y herramienta: **debe fallar** (≥4 vías).
2. Replay de una autorización: rechazado.
3. Cambio de un byte en un artefacto tras autorizar: `advance` bloqueado.
4. Edición de `state.json` a una fase posterior: detectada y bloqueada.
5. Proceso del agente intenta leer la clave de firma: denegado.
6. Dos autorizaciones simultáneas: una sola entrada, sin corrupción.
7. Prompt injection en un artefacto pidiendo aprobar: ninguna entrada creada.
8. Broker caído: la UI muestra «no disponible», no aprueba por otra vía.
9. Sesión web robada (cookie) sin llave física: autorización imposible.

## 8. Riesgos residuales

Un agente con **control del usuario humano local** (mismo usuario, misma pantalla, sin cuenta ni llave separadas) puede imitar la presencia humana; las opciones B y C reducen pero no eliminan el riesgo. La seguridad de Harness no está auditada. El diseño asume un adversario «agente defectuoso o manipulado», **no** un adversario con control root del equipo.
