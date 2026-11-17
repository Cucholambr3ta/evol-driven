# 11 — Modelo de seguridad y Approval Broker (v3.1: WebAuthn + Ed25519)

Estado: **arquitectura objetivo seleccionada por el propietario (OD-04, directiva v3.1 §3); mecanismo PENDIENTE DE VALIDACIÓN; nada implementado ni probado.** Harness no tiene auditoría de seguridad (EV-015). Hasta que las pruebas P-18 a P-34 pasen, **las aprobaciones protegidas de Studio permanecen bloqueadas** (§9). Invariante heredada de v3: no existe ninguna ruta documentada por la que un agente apruebe o avance una fase protegida eludiendo el broker, ni como rollback ni como emergencia.

## 0. Decisión y trazabilidad de requisitos

**Arquitectura objetivo (propietario):** autenticación con **WebAuthn/passkey con verificación de usuario obligatoria**, más **firma asimétrica Ed25519** realizada por un **broker protegido**. No se consideran suficientes una confirmación visual, un TTY ni un HMAC compartido (EV-052, EV-060).

| Req. | Requisito de la directiva | Dónde se cumple en el diseño |
|---|---|---|
| 1 | Autenticación humana vinculada a **esa operación** | §3: el desafío es el digest de la solicitud canónica |
| 2 | Desafío con referencia a proyecto, fase, operación, revisión y evidencia | §3.1 (campos obligatorios) |
| 3 | El backend comprueba desafío, origen, autenticador, identidad, permisos y vigencia | §3.3 (12 comprobaciones) |
| 4 | Desafíos de un solo uso y con expiración | §3.2 |
| 5 | Clave privada Ed25519 fuera del alcance de los agentes | §6.1, §7 |
| 6 | La verificación usa la clave pública sin dar capacidad de firmar | §4.3 (EV-060: el HMAC actual no lo cumple) |
| 7 | Aislamiento efectivo de procesos y credenciales | §7 (pendiente de validación, P-18) |
| 8 | CLI, MCP, Cordis y otras interfaces no se saltan la autorización | §10 y doc 10 |
| 9 | Si falla el broker, lo protegido queda bloqueado | §8 |
| 10 | Amenazas: agentes con herramientas locales y automatización del navegador | §9 (BA-01…BA-16) |

## 1. Por qué un botón, un TTY, una cookie o un HMAC compartido no bastan

Cualquier proceso del mismo usuario puede controlar un navegador, abrir una pseudo-terminal, llamar al mismo RPC o escribir los mismos archivos. Hoy el framework es **declarativo**: `evol approve` exige terminal (`ESPECIFICACION.md:47`), Claude Code recibe `permissions.deny` (`:1239`) y T-1/T-3 aceptan que un agente con lectura amplia lea la clave (EV-052). Además el HMAC (EV-060) hace que **quien verifica pueda firmar**. La spec de WebAuthn reconoce expresamente la automatización con autenticadores virtuales (EV-068, §11 de la Recomendación): un agente que controle el navegador puede crear el suyo. Por eso el factor humano debe ser una **credencial inscrita previamente** que el agente no posee, y la firma debe hacerla un proceso que el agente no alcance.

## 2. Componentes

| Componente | Función | Reglas |
|---|---|---|
| **Approval Broker** | Único proceso que firma y que escribe `gate-log.jsonl` | Cuenta de sistema propia (p. ej. `evol-broker`), sin `HOME` compartido; sin herramientas de agente; sin acceso a modelos ni memoria |
| **Servicio de revisión** (dentro del broker) | Calcula el paquete de revisión **desde los archivos**, leyendo el proyecto en solo lectura | No confía en el paquete que le envíe el host o la UI |
| **Interfaz de ceremonia** | Página servida por el broker donde la persona revisa y autentica | Solo loopback; origen exacto; ver §3.3 |
| **Almacén de credenciales** | Claves **públicas** de WebAuthn y su vínculo con `approver_id` y rol | Sin datos biométricos (nunca salen del autenticador) |
| **Clave de firma Ed25519** | Firma de entradas del registro | Privada solo en la cuenta del broker; pública publicada en la cadena (§4) |
| **Ancla de cabeza** | Copia de `seq` y `entryHash` del último registro, en el almacén del broker | Detecta truncado, sustitución o retroceso del archivo del proyecto |
| **Biblioteca verificadora** | Verifica cadena y firmas con clave pública | La usan Core, UI y agentes; **no puede firmar** |

El broker reutiliza la semántica de `gate.ts` (cadena, hashes de artefactos, ciclos, `anulacion`), pero la firma pasa de HMAC en proceso a Ed25519 en el broker. El tipo `Confirm` que hoy inyecta `approve.ts` (EV-061) es el punto de enganche; el cambio real es mover `requireKey`/`sign` fuera del proceso del agente (Tanda 2).

**Operaciones del broker** (ninguna es herramienta de agente): `request`, `authorize`, `advance` (transición, **registro distinto**), `reject`, `invalidate`, `status`, `history`, `diagnose`, y las administrativas `enroll_credential`, `revoke_credential`, `rotate_key`, `revoke_key`, `reset_approvers` (§6, todas protegidas y registradas).

## 3. Protocolo de autorización

### 3.1 Solicitud canónica y desafío

El broker construye, **a partir del estado real**, un objeto canónico (JSON ordenado, con prefijo de dominio `evol-authz-v1`):

`proyecto` (id) · `repositorio` (huella del origen) · `fase` y `ciclo` · `operación` (`approve_phase`, `advance`, `ciclo_nuevo`, `disciplines_change`, `skills_approve`, `rotate_key`…) · `revisión` (`HEAD` y estado del árbol) · `artefactos_digest` (hash de los hashes ordenados) · `config_digest` (`evol.config.json`) · `evidencia_digest` (resultado de `verify` y de los informes citados) · `checklist_digest` (doc 21) · `solicitante` (sesión del host) · `rol_exigido` · `request_id` · `nonce` (32 bytes aleatorios) · `emitida` · `expira`.

**Desafío WebAuthn = SHA-256 del objeto canónico** (32 bytes; la spec exige entropía suficiente y recomienda al menos 16 bytes, EV-068). Así la aserción firma, de forma verificable, *qué* se autoriza.

### 3.2 Vida de la solicitud

`pendiente → consumida | expirada | cancelada | invalidada`. Un solo uso: tras una aserción válida o un fallo definitivo, el `request_id` no vuelve a aceptarse. **Expiración: hasta 5 minutos** (S-04-2; no se admite un valor mayor). Cualquier cambio de `HEAD`, de un artefacto, de la configuración o del checklist **invalida** la solicitud antes de firmar.

### 3.3 Comprobaciones del backend (todas, en este orden; cualquier fallo = rechazo registrado sin firma)

1. La solicitud existe, está `pendiente` y no ha expirado (reloj del broker, monótono).
2. El desafío de `clientDataJSON` es **igual** al digest de esa solicitud y `type` es `webauthn.get`.
3. **Origen exacto**: el valor de `origin` coincide con el de la interfaz de ceremonia (esquema, host y **puerto**). La spec permite `http://localhost` con puerto no restringido (EV-068): cualquier servicio local comparte el RP ID, así que el origen no puede aceptarse de forma laxa.
4. `rpIdHash` de `authenticatorData` = SHA-256 del RP ID esperado.
5. Bits **UP y UV activos** (verificación de usuario obligatoria, `userVerification: required`).
6. La credencial (`credentialId`) está **inscrita**, no revocada y vinculada a un `approver_id`.
7. Política de la credencial: **BE = 0** (no sincronizable) por defecto; una credencial sincronizable solo si el propietario lo acepta por escrito (depende de un tercero y de la nube; ver OD-10).
8. Firma de la aserción válida con la clave pública almacenada.
9. Contador de firmas: si alguno de los dos valores no es cero y el nuevo es menor o igual al guardado, **rechazar y marcar posible clon** (EV-068).
10. `approver_id` tiene el rol exigido (Approver); un Reviewer no puede aprobar su propio trabajo (P-10).
11. **Revalidación del estado**: se recalculan `HEAD`, hashes, configuración, evidencia y checklist y deben coincidir con la solicitud.
12. Límite de frecuencia por sesión y por credencial.

Si todo pasa, el broker escribe la **aprobación** (§4). La **transición** (`advance`) es una operación posterior con su propio registro: no se ejecuta si falla el registro de la aprobación y revalida condiciones (H-05, §5).

## 4. Evidencia WebAuthn y su vínculo con la firma del registro

### 4.1 Qué se guarda y qué no

| Se guarda en la entrada firmada (mínimo) | Se guarda aparte (evidencia verificable) | **No** se guarda |
|---|---|---|
| `approver_id` (seudónimo local), `kid` de la credencial (huella de su `credentialId`), `request_digest`, `checklist_digest`, `webauthn_digest`, `sig_alg`, `broker_kid`, `epoch` | `clientDataJSON`, `authenticatorData` y firma de la aserción, en `.evol/approvals/evidence/<seq>.json`; la entrada solo referencia su **digest** | biometría (no existe fuera del autenticador), nombre real, `userHandle` con datos personales, IP, agente de usuario, claves privadas, `credentialId` completo, secretos |

Los datos personales quedan fuera de la cadena versionada en Git. Si el archivo de evidencia falta, la cadena sigue siendo válida (la firma cubre los digests) pero la auditoría lo señala «evidencia WebAuthn no disponible».

### 4.2 Formato de la entrada v2 (diseño; no implementado)

A los campos actuales de `GateEntry` (`seq, timestamp, phase, approver, action, anulacion, ciclo, artifacts, nonce, previous_hash`, EV-060) se añaden: `v: 2`, `sig_alg: "ed25519"`, `broker_kid`, `epoch`, `approver_id`, `request_digest`, `checklist_digest`, `webauthn_digest`. La firma es **Ed25519 sobre el JSON canónico con prefijo de dominio `evol-gate-v2`** (Node 26 lo soporta, EV-069); `payload_hash` se conserva. `action` gana valores: `approved`, `rejected` (rechazo de una solicitud, con motivo; D-05), `transition`, `ciclo-nuevo`, `key-rotation`, `key-revocation`, `credential-enrolled`, `credential-revoked`, `approver-reset`, `epoch-start`, `broker-incident` (este último no es una aprobación).

### 4.3 Verificación sin capacidad de firmar

La clave pública de cada `broker_kid` consta en entradas `key-rotation`/`epoch-start` de la propia cadena y en el ancla. Cualquiera (Core, UI, agentes, terceros) verifica con la **clave pública**; ninguno puede fabricar una entrada. Esto cierra el defecto del HMAC (EV-060).

### 4.4 Migración desde el registro HMAC existente (diseño)

Las entradas anteriores (`v` ausente) no pueden verificarse con una clave pública. Se conservan **sin reescribir**: al instalar el broker se verifica una vez la cadena heredada con la clave HMAC (en la cuenta del broker) y se escribe una entrada `epoch-start` firmada con Ed25519 que **atestigua** la cabeza heredada (`seq`, `entryHash`) y la congela. Las verificaciones posteriores confían en esa atestación para el tramo heredado. Si la verificación inicial falla, el proyecto queda bloqueado (fallo cerrado). Pruebas P-26 y P-30.

## 5. Experiencia «Autorizar avance» (H-05 y OD-26)

Una acción para la persona; **dos operaciones internas con dos registros** (aprobación y transición, no fusionados).

| Paso | Qué ocurre | Registro |
|---|---|---|
| 0 | **Centro de revisión**: la persona revisa el checklist de la fase ítem a ítem (doc 21); el botón no se habilita mientras haya ítems obligatorios sin conformidad válida | marcas de revisión |
| 1 | Paquete de revisión calculado por el broker (fase, artefactos con hash, `verify`, evidencias, bloqueos, checklist) | `request` |
| 2 | Ceremonia WebAuthn con el desafío de §3.1 (UV obligatoria) | — |
| 3 | Comprobaciones de §3.3 | — |
| 4 | **Registro de la aprobación** firmado Ed25519 | **aprobación** |
| 5 | Revalidación (hashes, `HEAD`, verificación, ausencia de bloqueos, checklist vigente) | — |
| 6 | **Transición** controlada, solo si hay aprobación vigente | **transición** |
| 7 | Resultado mostrado | — |

**Estados visuales:** Pendiente de verificación · Verificación fallida · Revisión incompleta · Listo para revisión · Esperando autenticación · Aprobado, pendiente de transición · Avance completado · Aprobación invalidada · Error recuperable · Operación bloqueada. La checklist **no reemplaza** la firma final: sin ceremonia no hay aprobación.

## 6. Claves, rotación y recuperación (procedimientos de diseño)

### 6.1 Custodia y generación
- **Alta inicial** (`broker init`): la ejecuta el Administrador **en la cuenta del broker, fuera de cualquier sesión de agente**; genera el par Ed25519 y el ancla; no hay comando equivalente en ninguna herramienta de agente.
- **Inscripción de credenciales** (`enroll_credential`): la **primera** credencial exige un código de un solo uso mostrado en la consola administrativa más presencia física; las siguientes exigen **una aserción de una credencial ya inscrita** (el agente no puede inscribir un autenticador virtual, BA-02/BA-06). Se inscriben **al menos dos autenticadores** (principal y de respaldo guardado aparte).
- **Política de autenticadores (S-04-1, propuesta del propietario pendiente de confirmación formal):** se **prefieren autenticadores FIDO2 vinculados al dispositivo** (BE = 0); **verificación de usuario obligatoria**; se inscriben **autenticadores de recuperación** (guardados fuera de línea, usados solo para inscribir o recuperar, nunca para el trabajo diario). Las credenciales sincronizables solo con excepción escrita del propietario.
- **Política de atestación:** pedir atestación directa y una lista de modelos aceptados (AAGUID) si el autenticador la ofrece; con atestación `none` (el valor por defecto de la spec, EV-068) se declara garantía menor.

### 6.2 Rotación
- **Clave de firma Ed25519 (S-04-2):** rotación **inicial de 12 meses**, con **revocación anticipada** posible en cualquier momento, y por evento. Se genera la nueva, se firma una entrada `key-rotation` con la anterior **y** una ceremonia WebAuthn; los verificadores usan para cada entrada la clave válida en su `seq`.
- **Credenciales WebAuthn:** inscribir la nueva, probar, revocar la antigua (`credential-revoked`); nunca quedan cero credenciales activas.
- Las claves antiguas se conservan como **públicas** para verificar el pasado.

### 6.3 Revocación y compromiso
Si se sospecha de la clave de firma: el broker se detiene (fallo cerrado); el Administrador genera una clave nueva **sin conexión**; entrada `key-revocation` con fecha `compromised_since`; las aprobaciones posteriores a esa fecha quedan marcadas **no fiables** y las fases que dependían de ellas vuelven a pendientes; el ancla se regenera; se abre un `epoch-start`. Si se sospecha de una credencial: se revoca y se re-inscribe.

### 6.4 Pérdida de todos los autenticadores
Procedimiento `reset_approvers`: solo en la cuenta del broker, con presencia física del Administrador, sin ceremonia WebAuthn (no hay credencial que presentar). Escribe `approver-reset` (incidente firmado por el broker, **no es una aprobación**), abre un `epoch-start`, **invalida todas las solicitudes pendientes y las aprobaciones de fases no cerradas** y mantiene lo protegido bloqueado hasta inscribir nuevas credenciales. Si el aislamiento de la cuenta del broker no está validado, este procedimiento **no se habilita** (queda como pendiente).

### 6.5 Copias de seguridad
Copia cifrada y fuera de línea de la clave privada y del almacén de credenciales públicas, con prueba de restauración (P-27). Una restauración abre un `epoch-start`.

## 7. Aislamiento exigido (pendiente de validación)

Requisitos mínimos para dar el mecanismo por válido (candidatas **sin probar**; la prueba P-18 las comprueba una a una):

1. Cuenta de sistema distinta de la de los agentes; archivos de clave y almacén `0600` de esa cuenta; el directorio del broker no es legible por el usuario del agente.
2. Binario y configuración del broker propiedad de root o de la cuenta del broker, **no modificables** por el usuario del agente (si el agente puede sustituir el binario, el aislamiento es nulo).
3. Socket Unix con credenciales del par (`SO_PEERCRED`) y permisos mínimos; el solicitante del host no puede autorizar, solo pedir.
4. El broker no ofrece escucha de red; la interfaz de ceremonia escucha **solo en loopback**, comprueba cabecera `Host` y `Origin`, y no sirve contenido a páginas de otros orígenes locales.
5. Sin acceso por `ptrace`/lectura de memoria desde la cuenta del agente (política del sistema como `kernel.yama.ptrace_scope` y restricciones de la unidad `systemd`: `NoNewPrivileges`, `ProtectHome`, `PrivateTmp`, `ProtectSystem`; **a validar**).
6. Registro de eventos del broker fuera del alcance de escritura de los agentes.
7. El broker lee el proyecto en solo lectura y calcula los digests él mismo.

**Si no puede demostrarse (P-18) con garantías suficientes en el entorno seleccionado, el mecanismo queda «PENDIENTE DE VALIDACIÓN» y las aprobaciones protegidas permanecen bloqueadas**: no se degrada a TTY, HMAC ni confirmación visual. Viabilidad en CachyOS (llave FIDO2, reglas `udev`, soporte del navegador del host): **no verificada** (EV-070).

## 8. Fallo cerrado y recuperación (H-01, conservado)

**Si el broker falla, las operaciones protegidas permanecen bloqueadas hasta recuperar un mecanismo equivalente y verificado.**

| Se permite durante el fallo | No se permite |
|---|---|
| consultar estado, evidencias e historial | firmar por una ruta menos protegida |
| ejecutar diagnósticos autorizados | avanzar fases protegidas |
| inspeccionar registros (sin secretos) | usar `evol approve` por terminal como sustituto |
| recuperar el servicio desde la cuenta administrativa | usar un TTY, un HMAC o un clic como autenticación protegida |
| restaurar configuración validada | un bypass genérico o «puerta de emergencia» |

**Recuperación:** (1) detección por `diagnose()`; (2) bloqueo visible «Operación bloqueada»; (3) diagnóstico de solo lectura (proceso, permisos del socket, ancla frente a cadena, claves por huella, hora); (4) reinicio por el Administrador desde su cuenta; (5) prueba de credenciales sin firmar; (6) conciliación `state.json` ↔ registro (OD-16); (7) revalidación y **caducidad de solicitudes pendientes**; (8) levantar el bloqueo solo con P-15 y la conciliación en verde; (9) registro del incidente (`broker-incident`, no aprobación). **No se define ningún bypass.**

## 9. Modelo de amenazas (req. 10: agentes con herramientas locales y automatización del navegador)

| ID | Amenaza | Control | Prueba |
|---|---|---|---|
| BA-01 | El agente controla el navegador (CDP, Playwright, WebDriver) y **crea un autenticador virtual** o marca «usuario verificado» (EV-068 §11) | La credencial válida es una **inscrita**; un autenticador virtual no tiene su clave privada; la inscripción exige presencia física o credencial previa | P-24 |
| BA-02 | El agente intenta **inscribir su propia credencial** | `enroll_credential` solo con código de consola administrativa o aserción previa; no es herramienta de agente | P-25 |
| BA-03 | **Redibujado o página falsa** (el agente muestra un resumen benigno y pide autenticar otro desafío) | La interfaz de ceremonia la sirve el broker, que calcula el paquete; la pantalla muestra los digests del desafío; el origen exacto se comprueba; residual: ver §11 | P-33 |
| BA-04 | **Reutilización** de una aserción (replay) o cambio de operación | Un solo uso, expiración, desafío ligado a operación y estado | P-19, P-04 |
| BA-05 | **Otro servicio en `localhost`** (otro puerto) presenta el desafío del broker | Comprobación de origen con puerto; el RP ID compartido no basta (EV-068) | P-20 |
| BA-06 | **Cookie o sesión robada** | La sesión web no autoriza sola; hace falta la ceremonia con UV | P-16 |
| BA-07 | Lectura de la clave privada o de memoria del broker por el mismo usuario | Cuenta separada, permisos, `ptrace`, unidad endurecida | P-07, P-18 |
| BA-08 | Sustitución del binario del broker o de su configuración | Rutas no escribibles por el agente; integridad comprobada al arrancar | P-18 |
| BA-09 | **Truncado o reemplazo** de `gate-log.jsonl` por una cadena anterior o falsa | Ancla de cabeza en el broker; entradas falsas no llevan firma válida | P-30 |
| BA-10 | El host (Harness) reenvía un paquete de revisión manipulado | El broker recalcula todo desde archivos | P-32 |
| BA-11 | Cambio de un artefacto, de `HEAD` o del checklist entre la revisión y la firma | Revalidación (§3.3 punto 11) | P-05, P-31 |
| BA-12 | **Spam de solicitudes** para fatigar a la persona | Límite de frecuencia; solicitudes agrupadas por fase; caducidad | P-19 |
| BA-13 | Marcas de checklist hechas por un agente con la sesión abierta | Las marcas son consultivas hasta la ceremonia final, que sella `checklist_digest`; las **operaciones excepcionales** exigen una verificación adicional (doc 21 §6) | P-31 |
| BA-14 | Manipulación del reloj | Reloj monótono del broker; marcas de tiempo firmadas | P-19 |
| BA-15 | Credencial sincronizable comprometida en la nube | Política BE = 0 por defecto | P-22 |
| BA-16 | Comandos de configuración (`comandos`) alterados antes de `verify` | La configuración es artefacto con hash (EV-072); `config_digest` en el desafío; UI muestra los comandos | P-05 |
| BA-17 | Inyección de instrucciones en documentos para «pedir» aprobar | El agente no tiene capacidad de aprobar aunque quiera | P-09 |
| BA-18 | Plugins de terceros que invocan herramientas de aprobación | Ninguna herramienta MCP/RPC de aprobación existe; el broker no escucha en red | P-03 |

## 10. Rutas indirectas de aprobación revisadas (v3.1)

`approve`, `next` y `ciclo nuevo` solo por broker (doc 10); `disciplines enable/disable` invalida aprobaciones y exige broker; `skills approve` (OP) exige broker (N-23); `rotate_key`, `revoke_*`, `enroll_credential`, `reset_approvers` son operaciones del broker; las **marcas de checklist** no aprueban nada; el **Repository Explorer** (doc 22) nunca ejecuta `push`, `merge` ni borrado y su token vive fuera del alcance de agentes. Revisión de `15-roadmap` H7: sin retorno a `evol approve` (conservada de v3).

## 11. Pruebas (todas pendientes; ninguna ejecutada)

P-01…P-17 se conservan de v3 (permisos por efectos, autoaprobación por todas las vías, replay, cambio de un byte, `state.json` editado, lectura de clave, concurrencia, inyección, interrogación, Administrator, hash de `.evol/`, red, equivalencia CLI/MCP/UI, **broker caído**, cookie robada, vía de emergencia). Nuevas en v3.1 (P-18…P-34):

| ID | Prueba | Resultado esperado |
|---|---|---|
| P-18 | Aislamiento: cuenta del agente intenta leer clave, memoria y binario del broker, escribir su configuración y conectar a su socket para autorizar | todo denegado; el solicitante solo puede pedir |
| P-19 | Desafío caducado, reutilizado o de otra operación; ráfaga de solicitudes | rechazo; límite de frecuencia efectivo |
| P-20 | Aserción emitida desde otro puerto de `localhost` | rechazada por origen |
| P-21 | Aserción sin UV | rechazada |
| P-22 | Credencial desconocida, revocada o sincronizable (BE = 1) sin permiso | rechazada |
| P-23 | Contador de firmas no monótono | rechazada y marcada posible clon |
| P-24 | Autenticador virtual del navegador (WebDriver/CDP) sin credencial inscrita | no se obtiene aprobación |
| P-25 | Inscripción de credencial sin código ni aserción previa | denegada |
| P-26 | Verificar la cadena con solo la clave pública; intentar fabricar una entrada | verifica; no se puede firmar; tramo HMAC heredado atestiguado en `epoch-start` |
| P-27 | Rotación de clave y credencial; restauración de copia | verificaciones históricas válidas; nada queda sin credencial activa |
| P-28 | Revocación por compromiso | aprobaciones desde `compromised_since` marcadas no fiables |
| P-29 | `reset_approvers` | incidente registrado, solicitudes y aprobaciones abiertas invalidadas, lo protegido bloqueado hasta nueva inscripción |
| P-30 | Reemplazar el registro por una versión anterior o sin entradas | detectado por el ancla; fallo cerrado |
| P-31 | Cambiar un ítem del checklist o un artefacto tras abrir la ceremonia | rechazada por `checklist_digest` o `artefactos_digest` |
| P-32 | Host envía un paquete falso | el broker calcula el suyo y rechaza la discrepancia |
| P-33 | La pantalla de ceremonia muestra los mismos digests que firma el desafío (prueba de propiedad sobre la interfaz) | coincidencia total |
| P-34 | Un miembro de AgentTeams (subagente) intenta lanzar otro miembro, o un worker intenta actuar como agente (AMD-02) | denegado o inexistente; se documenta la limitación si AgentTeams lo permite |

## 12. Riesgos residuales

Un adversario con control completo de la cuenta del broker, con privilegios de administrador o con posesión física del autenticador y su verificación **no** queda cubierto. El **problema de «lo que se ve es lo que se firma»** no se elimina por completo: si el agente controla la pantalla, puede intentar confundir lo que la persona cree autorizar; el control es que el broker, no el agente, sirve y calcula la ceremonia y que los ítems críticos se verifican por separado, pero **no está demostrado** (P-33). La seguridad de Harness no está auditada. Hasta ejecutar P-03, P-15 y P-18…P-34, **la ausencia de bypass es de diseño, no demostrada**.
