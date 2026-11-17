# 02 — Arquitectura de DeepSeek Harness (R1)

Versión inspeccionada: `deepseek-ai/deepseek-harness@39163dd3`, 0.2.2-rc.3, 2026-11-13, MIT, Node ≥24.9.0 (EV-015). Fuentes: `docs/architecture.md`, `docs/cookbook/*`, `packages/*/README.md`, `apps/desktop/README.md`, `SAFETY.md`.

**Hallazgo transversal.** Harness es *pre-release*, con APIs «pre-stable», y su propio SAFETY.md dice que no ha tenido auditoría de seguridad y que no debe considerarse seguro ni listo para producción (EV-015). Toda decisión de este informe debe leerse con esa salvedad.

## 1. Arquitectura

- **Todo es plugin de Cordis.** El adaptador del modelo, el registro de herramientas, el log de sesión y el propio bucle del agente son plugins sustituibles; no hay núcleo privilegiado que parchear (`architecture.md`, §Cordis). VERIFIED (doc).
- **Perfil** = composición nombrada en el home de Harness (bundles apilados, plugins externos instalados, `cordis.patch.yml` del usuario). Plantillas: `web`, `headless`, `sdk`, `sdk-minimal`, `acp`. **Bundle** = formato de distribución de filas de configuración de Cordis y del código que montan; se declara en `package.json` → `dsh.bundle.patch`. Las capas se aplican en orden: bundles del perfil → parche del perfil → parche del home → `--patch`. Un parche apunta a una fila por id y la reemplaza o inserta filas nuevas. VERIFIED (doc + `packages/bundle/web-app/package.json:49`).
- **Lanzamiento**: solo los perfiles `dsh` lanzan aplicaciones Node soportadas; los `bin` de paquetes y el montaje directo en proceso están prohibidos (`architecture.md`, §Application launch). Implicación: un plugin Evol no debe arrancar su propio proceso fuera de un perfil.
- **Seams (costuras)**: una capacidad intercambiable = Service Definition + Service Provider + Consumer. Ejemplo: `ctx.fs` y `ctx.subprocess` comparten un «mundo de ejecución», de modo que apuntarlos a un sandbox remoto mueve Bash, PTY y LSP sin forks.
- **Dónde va el comportamiento nuevo** (tabla del doc): herramientas en `ctx.tools`; comandos humanos en `ctx.commands`; trabajos en `ctx.jobs`; intercepción por eventos `agent/*` y `tools/*` (`agent/turn-stopping` detiene un turno); contexto con `agent.inject()`; estado durable extendiendo `SessionEventMap`; nuevos backends de sesión con `SessionPersistence`.
- **Ciclo de vida y recursos reversibles**: las registraciones son *effects* que se deshacen al descargar el plugin; el log de sesión es append-only y todo lo visible por el modelo debe poder reconstruirse (guía comunitaria: `model-visible ⇔ logged`).
- **HMR**: el perfil `web` habilita `dsh-hmr` solo de configuración; `headless`, `sdk` y `acp` lo deshabilitan.

## 2. Host y Client

- **Host**: servicio Cordis. Para exponer una API al cliente se extiende `TypertRemoteService` con un namespace y se marcan métodos con `@Remote`; la capa Typert genera el contrato de cable y la ruta `/api` (`cookbook/adding-a-remote-api.md`).
- **Client**: plugins de cliente que se registran en *slots* tipados declarados por el padre (`packages/client/ui-slots`); «declarar un slot es reclamarlo», y registrar en un slot no declarado es un error. Existen ya paquetes `ui-*` para sesión, aprobaciones (`ui-approval`), equipos (`ui-agent-team`), trabajos (`ui-jobs`), plan, workflow, skills y gestor de plugins, que sirven de patrón.
- **Servicios host relevantes**: `webserver`, `frontend-static`, `directory-picker*`, `plugin-inventory` (proyección de solo lectura de plugins cargados), `product-telemetry-otel`. `packages/host/authentication-token` y `authentication-desktop` gobiernan la autenticación local.
- **Eventos y suscripciones**: el cliente se renderiza a partir de `session/event`; las proyecciones (`SessionProjectionMap`) publican estado derivado (p. ej. `agentTeam`).
- **Lo que no se verificó**: RPC de suscripción en tiempo real para un servicio propio, autorización por método y aislamiento entre plugins de cliente. Se requiere un prototipo (Hito 3).

## 3. Límites del sistema

| Pregunta | Respuesta | Clase |
|---|---|---|
| ¿Qué se agrega con plugins? | Herramientas, comandos, proveedores (LLM, fs, shell, sandbox, persistencia), UI en slots, servicios host con API remota | VERIFIED (doc) |
| ¿Qué requiere configuración de perfil? | Orden y composición de bundles; parches `cordis.patch.yml` | VERIFIED |
| ¿Qué requiere empaquetado propio? | La edición Desktop en Linux: `package-target.ts:51` solo define `mac-arm64`, `mac-x64`, `win-x64` | VERIFIED (EV-018) |
| ¿Qué podría requerir modificar Harness? | Un objetivo de empaquetado Linux; un punto de intercepción de escritura por *agente* (AgentTeams reconoce que su control de alcance no intercepta escrituras del host) | INFERRED |
| ¿Qué es experimental? | `packages/experimental/`; la estabilidad de APIs públicas es «pre-stable» | VERIFIED |
| ¿Fork? | **No justificado** hoy: ninguna capacidad requerida fue encontrada como imposible vía plugin. Único candidato: empaquetado Linux, que se resuelve sin fork en una distribución propia | INFERRED |

## 4. Matriz de puntos de extensión para Evol

| Necesidad de Evol | Punto de extensión | Estado |
|---|---|---|
| Exponer estado/verificaciones/aprobaciones | servicio host + `@Remote` | disponible (doc) |
| Panel «Pipeline», «Approval Center» | plugin de cliente en un slot de layout | disponible (patrón `ui-approval`) |
| Herramientas del agente (`evol_*`) | `ctx.tools` o MCP externo (`packages/mcp`) | disponible |
| Bloquear acciones sin aprobación | eventos `tools/*` / guard (`packages/guard`) | disponible; semántica a validar |
| Persistir eventos Evol | `SessionEventMap` o almacenamiento propio (`packages/storage`) | disponible; no usar el log de sesión como registro de aprobaciones |
| Instalación | `dsh plugin --profile <p> add <tgz>` y `dsh.bundle.patch` | disponible (guía comunitaria, EV-016) |
| Empaquetado Desktop Linux | — | **no existe** |

## 5. Comprobaciones pendientes (requieren entorno aislado)

1. Cargar un plugin mínimo con servicio host y panel cliente y verificar descarga limpia (`dispose`).
2. Medir si dos perfiles pueden coexistir sin compartir estado.
3. Revisar el consumo de red de Harness en arranque (analítica de producto, Platform API, actualizaciones) con el modo offline.
4. Probar `guard` frente a una herramienta mutante.
