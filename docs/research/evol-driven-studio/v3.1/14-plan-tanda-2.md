# 14 — Plan de Tanda 2: integración de Evol-Driven (v3.1)

Responsable del plan técnico: Claude Code. **No comienza sin el informe de handoff verificable de Tanda 1** (OD-22). Este documento es el plan; no autoriza implementar.

## 1. Entradas obligatorias (del informe de Tanda 1)

Versión de Harness y plugins fijados; rutas; capacidades verificadas y no verificadas; decisión sobre qué fuentes de la jerarquía del doc 12 §2 se usaron (C-01 resuelta a nivel de diseño); resultados de red; procedimiento de restauración; skill `evol-studio-plugin-development` instalada y validada.

## 2. Alcance

| Bloque | Contenido | Hito |
|---|---|---|
| Contratos y núcleo | paquete `core` y CLI `--json` versionados; separación lectura/escritura; verificación estado↔log; lock; `verifier_version`; trailer `CA:` | H0 |
| Adaptador mínimo | plugin Cordis host + puente a Core | H1 |
| Lectura | Project Manager, Pipeline Explorer, Dashboard | H2 |
| Equipos | `agentTeamsAdapter`, Work Manager, Agent Center, `TaskRef` | H3 |
| Memoria y código | adaptadores `ContextMemory`/`CodeIntel`/`SessionHistory`, workers | H4 |
| Modelos | Model Routing por fase/rol | H5 |
| Calidad | Quality & Evidence con estados de evidencia | H6 |
| Autorización | **Approval Broker (WebAuthn + Ed25519)**, **Approval Checklist (OD-26)** y Centro de revisión | H7 |
| Resto de CLI | inventario CLI→UI completo | H8 |
| Repositorio | **Evol Repository Explorer** (OD-27, solo lectura) | H8b |
| Distribución | Plugin Edition reproducible, luego Desktop | H9, H10 |

## 2 bis. Correcciones del núcleo necesarias (entran en H0)

- Conciliación estado↔log en `verify`, `approve`, `next` (bloqueo), no solo en `doctor` (EV-045).
- Separar y anotar las herramientas MCP por efecto real; dividir `evol_verify` (EV-048); enmendar el criterio 22 y la ayuda (doc 19 N-01).
- Tabla única de permisos por efectos (doc 10) consumida por CLI, MCP y UI; prueba de equivalencia P-14.
- Lock de `.evol/`; `verifier_version` en lo firmado; sección calculada de checkpoint.
- **Firma asimétrica (OD-04):** formato de entrada v2 con Ed25519, verificación solo con clave pública, migración `epoch-start` del tramo HMAC (doc 11 §4); la firma sale del proceso del agente (hoy `requireKey` y `sign` corren en proceso, EV-061) conservando el punto de inyección `Confirm`.
- **Interfaz `MemoryProvider`** (AMD-04) con pruebas de contrato para `mempalace` y `mnemon`.
- **Anotación de las herramientas MCP por efecto** (AMD-01) y retirada del modo `fin` de `evol_verify`.
- **Almacén de eventos del checklist** y `evol review list|show|export` (doc 21); sección «repositorio» de `evol export --json` (doc 22).
- Contrato con el broker: `approve`, `next` y `ciclo nuevo` solo invocables por el broker/persona; **ninguna ruta alterna**; fallo cerrado cuando el broker no esté disponible (doc 11 §6).

## 3. Reglas

1. El núcleo permanece independiente; el plugin usa interfaces versionadas.
2. Una sola autoridad por responsabilidad (doc 03).
3. Cada módulo se entrega con contrato, permisos, pruebas con fixture identificable, diagnóstico y rollback; cada hito es uno o varios ciclos del pipeline de Evol.
4. Ninguna integración se da por buena sin prueba ejecutada; no hay PASS por inferencia.
5. Primero lectura, después escritura; **la operación de aprobar es la última** en habilitarse (H7), con sus pruebas negativas; **si el broker falla, las operaciones protegidas permanecen bloqueadas** y no existe retorno a `evol approve` por terminal ni a ningún comando histórico sin las mismas garantías.
6. **El mecanismo del broker permanece «pendiente de validación»** hasta superar P-18…P-34; mientras tanto las aprobaciones protegidas de Studio están **bloqueadas** (doc 11 §7).
7. Cualquier cambio a `gate.ts`, `coverage.ts` o `verify.ts` se prueba con `evol` y con `evol-dev` (verificador auto-hospedado).

## 4. Riesgos propios de la tanda

Deriva de contratos entre repos (`evol-driven` y `evol-driven-studio`); API pre-stable de Harness; compatibilidad de AgentTeams; falsos positivos de gates (WARN dos semanas antes de BLOCK); sobreingeniería (no HTTP, no microservicios).

## 5. Criterios de salida de la tanda

Todos los hitos H0–H9 (incluido H8b) con sus condiciones de aceptación ejecutadas; benchmarks de memoria y código ejecutados; **pruebas P-01…P-34 del doc 11 y AC-CL-01…16 (doc 21) y RE-01…12 (doc 22)** en verde; enmiendas AMD-01…08 incorporadas al texto normativo con aprobación humana; matriz de compatibilidad con combinaciones «probadas»; decisión sobre Desktop (H10) tomada.
