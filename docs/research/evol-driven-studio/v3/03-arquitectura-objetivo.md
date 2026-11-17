# 03 — Arquitectura objetivo y límites de autoridad (v3)

Estado: **diseño para revisión, nada implementado.** Principio: una autoridad por responsabilidad, cada integración verificable.

## 1. Componentes

```
┌────────────────────────── Evol-Driven Studio (repo evol-driven-studio) ──────────────────────────┐
│  Cliente (plugins de UI en slots de Harness)                                                      │
│   Dashboard · Project Manager · Pipeline Explorer · Approval Center · Work Manager · Agent Center │
│   Memory Center · Code Intelligence · Quality & Evidence · Plugin Manager · Settings · Model Routing│
│                         │ RPC tipado (@Remote) / proyecciones de solo lectura                      │
│  Host (servicios Cordis) ▼                                                                         │
│   studioBridge ──► contratos JSON versionados ──► Evol-Driven Core (proceso/ librería `core`)      │
│   routingAdapter ──► DSH (modelos) · agentTeamsAdapter ──► AgentTeams · workerPool                  │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
                 │                               │                         │
      Evol-Driven Core (repo evol-driven)   DeepSeek Harness (host)   Plugins comunitarios fijados
      pipeline · gates · verificación       sesiones · herramientas   AgentTeams · dsh-mnemon (+Mnemon Native)
      aprobaciones firmadas · journal       Cordis · UI · modelos     Codebase Memory MCP (+puente) · dsh-deja
      checkpoints · trazabilidad · evidencia sandbox · guard
                 ▲
      Approval Broker (proceso separado, credencial humana) ── única vía de escritura de aprobaciones
```

## 2. Autoridad por responsabilidad

| Responsabilidad | Autoridad única | NO es autoridad |
|---|---|---|
| Fase activa, reglas de transición, gates | **Evol-Driven Core** | AgentTeams, UI, memoria |
| Aprobación (registro firmado) | **Approval Broker + `gate-log`** | un agente, un botón sin autenticación, un resumen |
| Transición de fase | Core, tras aprobación vigente y verificación | quien aprobó |
| Verificación/evidencia de cumplimiento | comandos deterministas que ejecuta Core (más revisión independiente) | un LLM que «informa» que pasó |
| Ejecución y coordinación de tareas | **AgentTeams** (o `team` nativo) | Evol-Driven |
| Estado de tareas | AgentTeams (6 estados reales, EV-037) | Evol-Driven (solo referencia y vigencia) |
| Memoria contextual | proveedor activo (dsh-mnemon + Mnemon Native) | el índice de código |
| Memoria de código/estructura | Codebase Memory MCP; Core conserva el vínculo código↔tarea↔prueba↔CA | MemPalace |
| Historial de sesiones | dsh-deja | memoria contextual |
| Selección de modelos | DSH (proveedores y modelos); Studio guarda **política** de enrutado | Studio como nuevo gestor de proveedores |
| Permisos efectivos | backend (host + broker + sandbox) | roles visuales |
| Código fuente | Git y el árbol de trabajo | cualquier índice |

## 2 bis. Correcciones v3 a esta arquitectura

- **Permisos por efectos reales:** `studioBridge` aplica la tabla única del doc 10; ninguna operación llega a Reader sin evidencia (H-02). `verify` en modo «fin» es ejecución de comandos de la configuración, no lectura.
- **Sin bypass de aprobación:** el Approval Broker es el único camino de escritura del registro firmado y de las transiciones protegidas; si falla, las operaciones protegidas quedan bloqueadas (fallo cerrado, doc 11 §6; H-01).
- **Una sola base de tareas:** el Work Manager **no** mantiene una segunda base autoritativa; muestra el estado de AgentTeams y las referencias/vigencia que calcula Core.
- **Las tareas de AgentTeams no modifican directamente estados protegidos de Evol** (fases, aprobaciones, `.evol/`).
- **Una memoria por responsabilidad:** dsh-mnemon, Codebase Memory, deja-vu y (opcional) `dsh-evidence` tienen funciones distintas; sin escrituras automáticas duplicadas sobre la misma información.

## 3. Reglas de dependencia

1. Core no importa Harness. Studio importa Core mediante un paquete versionado o su CLI `--json`.
2. Los paneles no abren archivos de `.evol/` ni bases de terceros; todo pasa por `studioBridge`.
3. `studioBridge` expone **lecturas** libremente (según rol) y **escrituras** solo mediante operaciones nombradas con permiso y registro.
4. El Approval Broker es el **único** proceso con acceso de escritura a la clave y a `gate-log`. Ningún plugin, agente ni herramienta lo invoca por una vía distinta de la interfaz humana autenticada (doc 11).
5. Un workers local no es un agente: se invoca por herramienta, sin modelo.
6. AgentTeams y Evol se enlazan por **referencias** (doc 07), nunca copiando estado.

## 4. Mapa de límites de confianza

| Frontera | De → a | Control |
|---|---|---|
| Agente → herramientas | sesión DSH → host | permisos de herramientas, sandbox, guard |
| UI → host | navegador → `studioBridge` | autenticación local + autorización por rol en el backend |
| Host → Core | `studioBridge` → Core | contrato versionado; Core valida de nuevo |
| Host → Broker | solicitud de aprobación → broker | canal sin credencial del agente; confirmación humana |
| Core → `.evol/` | proceso Core | permisos de archivo; lock de proyecto |
| Studio → memoria/código | adaptadores | solo loopback, sin red saliente salvo política |

## 5. Qué se reutiliza y qué se escribe

| Capacidad | Reutiliza | Escribe Studio |
|---|---|---|
| Sesiones, herramientas, UI base, modelos | Harness | — |
| Coordinación de agentes y panel de equipo | AgentTeams | adaptador de referencias |
| Memoria contextual y su UI | dsh-mnemon | adaptador y política de escritura |
| Grafo de código y su UI | Codebase Memory MCP (+puente DSH) | vínculo código↔CA↔prueba |
| Historial de sesiones | dsh-deja | lista cerrada de directorios |
| Pipeline, gates, aprobaciones, evidencia | Evol-Driven | `core` versionado, broker |
| Paneles Evol (pipeline, aprobaciones, calidad, routing) | `ui-approval`, slots y patrones de Harness | los paneles propios |

No se crea: embeddings, grafo de código, base vectorial, gestor de agentes ni de proveedores de IA, segundo scheduler.
