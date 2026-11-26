# 02: Cómo integrar Evol-Driven en DeepSeek Harness (investigación)

Condensa lo que el agente integrador necesita de v1 a v3.1 y añade lo comprobado el 2026-11-26. La arquitectura **no cambia** respecto de v3.1: aquí se concreta *por dónde* se engancha cada pieza. El detalle de cada decisión está en `../v3.1/` (se cita como «v3.1 doc NN»).

## 1. Qué es DSH, en lo que importa para integrar

| Concepto | Qué es | Consecuencia para Studio |
|---|---|---|
| **`dsh`** | Lanzador Node único (`@deepseek-ai/dsh`, MIT). Modos: `dsh --profile <p>` (web por defecto), `headless "tarea"`, `sdk` (JSON-RPC por stdio), `acp` (clientes de automatización por stdio) y `dsh plugin --profile <p> <args de pnpm>` | Studio se distribuye como **plugin(s) dentro de un perfil**, no como otra aplicación |
| **Perfil** | `$DSH_HOME/profiles/<p>/`, con `package.json` (dependencias y `dsh.profile.bundles`, en orden) y `cordis.patch.yml` (la capa del usuario) | Studio necesita un **perfil propio** (`evol-studio`) en un **`DSH_HOME` dedicado** (v3.1 doc 27 §3) |
| **Composición** | Árbol Cordis = parches de cada bundle en orden → parche del perfil → `$DSH_HOME/cordis.patch.yml` → `--patch` | Las piezas de Studio se montan con **parches de inserción** (`- insert: [{id, name, config}]`); se inspeccionan sin arrancar con `--dump-config` y `--dump-config-schema` |
| **Plugin** | Paquete npm con `dsh.bundle.patch` (Host) y, para la UI, `dsh.client.{platform, inject[], immediately}` y un export `./client` | Studio = un plugin Host (servicios, RPC, lectura de `.evol/`) + un Client (paneles React en slots) |
| **Compatibilidad** | `engines.dsh` (o, si falta, los rangos peer de DSH) se comprueba al instalar y al arrancar; las excepciones tienen que reconocerse de forma explícita | Studio declara `engines.dsh` con la **versión exacta** de la baseline |
| **HMR** | `dsh-hmr` recompone en caliente si está activado; si no, los cambios se aplican al reiniciar | Probado en el prototipo: **retirar un plugin en caliente falló**. La secuencia soportada es detener → retirar → reiniciar → verificar (EV-086) |
| **Skills de desarrollo incluidas** | `@deepseek-ai/dsh-agent-preset/skills/`: `cordis-plugin-development` (Host, UI, bundle MCP, prácticas, acciones de usuario y verificación), `cordis-composition-reference`, `editing-cordis-compositions` y `agent-experience` (EV-085) | Son la **fuente 2** de la jerarquía de la skill fundacional (v3.1 doc 12 §2). Se leen **antes** de escribir código Cordis |
| **Documentación pública** | `https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/` y `…/en/reference/` (EV-093) | Sigue el HEAD: **contrástala** con los `.d.ts` de la versión instalada |

### Anatomía de referencia (verificada en paquetes reales)

```jsonc
// package.json de un plugin Host+Client (patrón de AgentTeams 0.1.30 y del prototipo)
{
  "name": "@scope/plugin",
  "exports": { ".": "./lib/index.js", "./client": "./lib/client.js", "./cordis.patch.yml": "./cordis.patch.yml" },
  "engines": { "node": "^22.19.0 || >=24", "dsh": "<rango>" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-conversation", "…"] }
  }
}
```

```yaml
# cordis.patch.yml: monta el plugin en la composición del host
- insert:
    - id: evol-studio
      name: '@local/evol-driven-studio'   # entre comillas: @ es reservado en YAML
      config: { roots: [...] }            # esquema declarado con schemastery
```

AgentTeams registra sus herramientas `agent_teams_*` en el registro compartido `tools` y una sección en el system prompt global. Guarda el estado del equipo en `<workspace>/.agent-teams/<teamId>/`. Ese es el patrón para exponer herramientas de Evol a las sesiones.

## 2. Arquitectura de integración (de v3.1, sin cambios)

```
Persona ─► UI de DSH (paneles Studio en slots) ─► studioBridge (plugin Host) ─► Evol Core (CLI --json / paquete core)
                                                    │                             └─► .evol/ (estado, gate-log, journal)
Agente DSH ─► herramientas (tools registry) ─► evol MCP (clasificado por efecto) ─┘
Approval Broker (proceso aparte, WebAuthn + Ed25519) ─► única vía de escritura de aprobaciones
```

Reglas que el integrador **no puede romper** (v3.1 doc 03 y OD-01, 02, 15 y 16):

1. **Core no importa Harness.** Studio consume Core por su **CLI `--json`** primero y por un paquete `core` versionado cuando exista. No se copia el núcleo al repositorio de Studio.
2. **Dos repositorios:** `evol-driven` (Core) y `evol-driven-studio` (plugins, adaptadores, skills propias y distribución).
3. Los paneles no leen `.evol/` directamente: todo pasa por `studioBridge` (en el prototipo, `src/host/evolReader.ts` y `safeFs.ts` cumplen ya ese papel en lectura).
4. **Primero lectura, después escritura.** Aprobar es lo último (H7) y queda bloqueado mientras el broker esté sin validar.
5. **Una autoridad por responsabilidad:** las fases y los gates los lleva Core; las tareas, AgentTeams; la memoria contextual, dsh-mnemon; los modelos, DSH. No se crea un segundo scheduler, ni un gestor de proveedores, ni una base vectorial.
6. Las tareas de AgentTeams **no modifican** fases, aprobaciones ni `.evol/`. Los miembros no lanzan otros miembros (profundidad 1, P-34).

## 3. Puntos de enganche concretos

| # | Pieza de Evol | Cómo entra en DSH | Estado | Cuidado |
|---|---|---|---|---|
| E1 | **Lectura del proyecto** (estado, fases, artefactos, journal, checkpoint) | Plugin Host `studioBridge`: lee con aperturas seguras o con `evol status/verify --inicio/export --json`; RPC tipado al Client | **Prototipo Etapa 1** (lectura directa acotada, 59/59 pruebas, UI real sin verificar) | `verify` sin `--inicio` **ejecuta comandos**: no es lectura (doc 10) |
| E2 | **Herramientas para el agente** | Montar `evol mcp` como servidor MCP del perfil con `dsh-mcp-client` (ver `references/mcp-bundle.md` de la skill del preset), **o** registrar herramientas propias en `tools` como hace AgentTeams | No empezado | Clasificar cada herramienta por efecto (AMD-01). Exponer primero solo las de lectura pura: `evol_status`, `evol_prerequisites`, `evol_disciplines`, `evol_lessons`, `evol_find_symbol` |
| E3 | **Bloqueo de `evol approve`/`next`/`ciclo nuevo` para agentes** | La política de herramientas o el guard de DSH tiene que **denegar** esos comandos en la herramienta de shell, como hace hoy el hook de Claude Code | **No empezado. Es crítico**: sin él, un agente DSH con shell puede aprobar | Comprobar qué mecanismo de denegación ofrece la 0.2.1-rc.2 (preset, `tool-policies`). Si no hay ninguno fiable, **no se da shell** al agente en proyectos evol |
| E4 | **Skills de Evol** (las 64) | Cargarlas como skills del agente DSH: directorio de skills de usuario o `DSH_AGENTS_HOME`, o empaquetarlas en un preset | **Supuesto sin verificar**: no se ha comprobado cómo descubre skills la 0.2.1-rc.2 fuera del preset | Sin autoevolución de skills (OD-03); el hash de cada skill tiene que coincidir con `release.json` |
| E5 | **Roles de solo lectura** (`verificador`, `seguridad`) | Miembros de AgentTeams con herramientas restringidas, o subagentes nativos de DSH | No empezado (C-T1-01 y C-T1-09 pendientes) | Contexto limpio y solo lectura **impuestos por la herramienta**, no solo pedidos en la instrucción |
| E6 | **Memoria** | `MemoryProvider` (AMD-04) con `mnemon` para instalaciones nuevas; MemPalace se mantiene en este repositorio | Prototipo con `memoryReader.ts` y `memoryMcpTransport.ts` (solo lectura) | dsh-mnemon trae **9 proveedores**, varios en la nube: hay que **sobrescribir la composición** y dejar solo los locales (EV-078). El binario `mnemon` se instala aparte |
| E7 | **Code intelligence** | Mantener el grafo nativo de Evol. Codebase Memory MCP queda **bloqueado** hasta verificar su procedencia (EV-084) | — | Instalador con `--no-hooks` y prueba en un entorno desechable (v3.1 doc 27 §4) |
| E8 | **Aprobación humana** | Approval Broker + Checklist (H7) | Solo diseño | Hasta validarlo, la persona aprueba con `evol approve` **en su terminal** y la UI solo **muestra** el estado |
| E9 | **Modelos** | DSH gestiona proveedores y modelos; Studio solo guarda una **política** por fase y rol (OD-24) | — | El perfil personal tiene `dsh-chatgpt-sub` y `dsh-claude` (EV-087): **no se copian** al perfil aislado sin decidirlo |

## 4. Versiones: baseline frente a upstream

| Componente | Baseline ratificada (OD-09) | Upstream hoy | Comentario |
|---|---|---|---|
| DSH | **0.2.1-rc.2** | `latest` 0.2.2-rc.5 · `alpha` 0.2.3-alpha.2 | La 0.2.1-rc.2 sigue publicada con la misma integridad |
| AgentTeams | **0.1.30** (recomienda la 0.2.1-rc.2) | 0.1.31 (recomienda la 0.2.2-rc.5) | La pareja ratificada sigue siendo coherente; la recomendada por el autor ya es otra |
| dsh-mnemon | 0.5.46 | 0.5.55 | Mismo `engines.dsh`: las dos admiten la 0.2.1-rc.2 |
| dsh-deja | 0.24.2 | 0.25.1 | La 0.25.1 declara `engines.dsh >=0.2.0-rc.2` |
| dsh-codebase-memory-mcp | 0.1.10 en la documentación; **solo existe la 0.1.0** | 0.1.0 | El repositorio declarado es un marcador: **sin procedencia** |

**Recomendación:** **no** cambiar la baseline por iniciativa propia. Sigue con 0.2.1-rc.2 + 0.1.30, que está ratificada y es la versión con la que se escribió y probó el prototipo. En paralelo, redacta una **propuesta de cambio** (v3.1 doc 27 §5) que evalúe 0.2.2-rc.5 + 0.1.31 con las pruebas C-T1. Decide el propietario. Motivo: Studio se apoya en contratos de UI y de layout de una versión pre-stable; mover la base a mitad de la integración invalida lo que ya está probado.

## 5. Riesgos específicos de esta migración

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Un agente DSH con shell ejecuta `evol approve` | Rompe la regla central del framework | E3 antes de dar herramientas de shell; prueba negativa obligatoria |
| La clave HMAC se copia al equipo nuevo por un canal inseguro | Cualquiera con la clave puede falsificar aprobaciones (EV-060) | La copia la hace la persona, fuera de cualquier agente, con permisos 600; o se empieza un registro nuevo (decisión del propietario, doc 05 §D3) |
| El prototipo sin versionar se pierde o llega al equipo nuevo con la credencial potencialmente expuesta | Pérdida de trabajo o fuga | Escaneo de secretos (`gitleaks`) **antes** del primer commit; decidir qué hacer con la credencial (EV-088) |
| El perfil personal y el aislado se mezclan | Studio comparte sesiones, credenciales y storage con el uso personal (README del prototipo §8) | En el equipo nuevo, solo `DSH_HOME` dedicado + `DSH_AGENTS_HOME` propio; nunca `~/.dsh` |
| API pre-stable (rc) de Cordis o de la UI | Roturas al actualizar | Baseline fija, `engines.dsh` exacto, sin `latest` ni actualización automática |
| Composición de layout no soportada (sustituir root o frame) | Fork oculto | Según la propuesta de interfaz dedicada del prototipo: sustituir solo la fila `ui-sidebar` en el slot público `sidebar`; **no** registrar un root propio en la rc.2 |
| Dos memorias escriben sobre las mismas sesiones | Duplicados y contradicciones | C-T1-06: solo un proveedor de escritura automática por política |
