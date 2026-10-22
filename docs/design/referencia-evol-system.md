# Notas de investigación: lo que enseña evol-system

> **No forma parte del producto.** evol-driven es un proyecto nuevo; evol-system (Python, con proyectos legacy dentro) se
> leyó solo como inspiración. Ninguna skill ni agente de evol-driven puede contener nada de él (ni su nombre, ni su marco de
> metodologías, ni sus rutas o comandos): la auditoría lo comprueba. Este documento existe para no repetir sus errores.
>
> Fuentes leídas: `skills/` (74), `prompts/agents/` (18), `scripts/evol-evolve.py`, `templates/audit/` y `acuerdos/memoria/`.

## Hallazgos y decisiones que salieron de esa lectura

> **Estado de la propuesta original:** Nada de esto existe todavía en `src/`: la pantalla Skills es una maqueta. evol-driven es un
> proyecto **nuevo**; `evol-system` (Python, con proyectos legacy dentro) es solo **inspiración**. Esta propuesta nace de
> leer sus `skills/`, `prompts/agents/`, `scripts/evol-evolve.py`, `templates/audit/` y `acuerdos/memoria/`, y de ahí
> toma ideas, no código ni dependencias: lo que sirva se reescribe aquí, lo legacy se deja.

**Lo que evol-system ya resolvió y evol-driven toma como referencia**

| Pieza                                | Dónde está                                         | Qué hace                                                                                                     |
| ------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Instalación con cuarentena           | `scripts/evol-evolve.py install-skill`             | Copia a una carpeta temporal, valida el frontmatter, busca referencias peligrosas, pasa gitleaks y semgrep, exige `@sha` en las remotas, calcula huella y la anota en `.evol/.skill-registry.json` (0600) |
| Reglas de seguridad                  | `scripts/evol-shield.py`                           | Comandos peligrosos, secretos y «las skills no deben referenciar los internos del sistema» (`.evol/`, claves) |
| Agente auditor                       | `prompts/agents/core/evol-auditor.md`              | Efímero por flujo: veredictos `[OK]`, `[GAP]`, `[BLIND_SPOT]`, `[SKILL_MISSING]`; informe, lecciones y retiro |
| Plantilla de auditoría de skills     | `templates/audit/audit-skill-creation.md`          | Estructura, evals, espejo en `src/evol_cli/skills/` y portado a los 7 IDEs                                    |
| Creación de skills                   | skills `crear-skill`, `crear-agente`, `evol-skill-manager` | Ciclo de vida y evals                                                                                  |
| Agentes efímeros                     | `scripts/evol-agent-lifecycle.py`                  | `create`, `invoke`, `retire`, `recall`, `gc`, con huella SHA-256 del prompt                                  |
| Aprobación criptográfica             | `scripts/evol-gate.py`                             | Gates HMAC encadenados que un agente no puede saltarse                                                       |

Por eso el agente auditor **no se inventa desde cero**: se parte del concepto de `evol-auditor` (efímero, con veredictos y
lecciones) y se le añade una fase `skill-intake`. La pantalla Agentes muestra, como **referencia**, los 18 agentes de
evol-system; los agentes propios de evol-driven aún no están definidos (la orquestación multi-agente está fuera de la v1) y
cuando existan los sustituirán.

**Lo que se aprende de evol-system** (medido; son lecciones para construir bien aquí, no deuda de este proyecto)

1. **La instalación falla abierta.** Si gitleaks o semgrep no están instalados, `quarantine_and_scan` los omite sin avisar y
   la skill entra. Un auditor que no pudo auditar no debe aprobar.
2. **Las comprobaciones son flojas.** Solo mira `SKILL.md` (no los scripts ni las referencias), no detecta accesos a red ni
   instrucciones que cambien las reglas del agente, y su regla de «referencias peligrosas» salta con palabras comunes como
   `state` o `keys`.
3. **El auditor no está conectado a la instalación.** `install-skill` no invoca a `evol-auditor`, y la plantilla de
   `skill-creation` revisa la estructura, no la seguridad (ni secretos, ni filtraciones, ni inyección).
4. **Sobrescribe sin preguntar.** Si la skill ya existe, `install-skill` avisa y hace `rmtree` igualmente.
5. **El auditor es consultivo.** No bloquea salvo que emita `GATE_BLOCK`; para skills nuevas debe poder bloquear.
6. **Los números no coinciden.** `skills/CATALOG.json` lista 21 skills, el disco tiene 74, `WORKING-CONTEXT.md` y la memoria
   dicen 70 y 82, y los documentos hablan de 16 agentes cuando el registro tiene 18 (el esquema exige exactamente 16).
7. **Su registro nombra una skill que no existe:** `code-graph-tools` (la usa `evol-analyst`). Lección: el registro de agentes
   se valida contra las skills reales.
8. **Faltan los wireframes aprobados de agentes y skills.** La memoria dice que hay 9 aprobados en
   `acuerdos/design/wireframes/propuesta/` (incluidos `edms-agents` y `edms-skills`), pero esa carpeta no existe y solo hay 3
   de los 9 en el repositorio. La maqueta de Skills se hizo sin verlos.
9. **Alcance de las skills sin resolver.** Hay skills del paquete (con espejo en `src/evol_cli/skills/`), y personales
   (`revision-release`, `ui-ux-pro-max`, `lightweight-charts` en `~/.agents/skills/`); `update-memory` y `update-context`
   pasaron de personales a del paquete en dos días. La biblioteca de evol-driven necesita decir de cuál es cada una.
10. **7 frontmatter rotos** y 2 skills con scripts en su biblioteca actual.
11. **Prompts con reglas que se contradicen.** `evol-architect` exige «cero referencias a MCP» y `evol-sec` «`mcpServers` = 0»,
    pero la memoria registra que se abandonó esa política (2026-06-06). Lección: las reglas de un agente se validan contra las
    decisiones vigentes; en S0 esto marca lo legacy.
12. **El auditor está registrado como permanente y descrito como efímero** (`ephemeral: false` en el registro; «vive solo durante
    el flujo» en su prompt). El esquema del registro debe fijar una sola cosa.
13. **`prompts/` es casi un esqueleto.** Solo hay 18 prompts de agente (de 27 a 85 líneas); `ephemeral/`, `orchestrator/personas/`
    y `workflows/` están vacíos (`.gitkeep`). Los flujos reales viven en `.agent/workflows/`.

**Lo que muestran las 74 skills de `evol-system/skills`** (10 798 líneas; medido)

| Hallazgo                                                                                                                              | Qué implica para evol-driven                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **70 de 74 llevan el mismo bloque «Memory Integration»** de 39 líneas, idéntico (2 730 líneas, el 25 % del total)                    | Está atado a `python3 scripts/evol-memory.py edms-*` de otro sistema; aquí la memoria es MemPalace. Se quita al adoptar, y cada skill se carga con 39 líneas menos de contexto |
| 72 de 74 nombran `python3 scripts/…` de evol-system                                                                                   | Ninguna se puede instalar tal cual: hay que reescribir las rutas o expresarlas como comandos `evol`        |
| **Los 7 frontmatter rotos tienen la misma causa:** un valor sin comillas con `: ` dentro (p. ej. `when_to_use: … Trigger: "…"`)         | Es un arreglo mecánico (comillas o `>`); `evol skills check` lo detecta y propone el arreglo               |
| `trigger` (62 skills) y `triggers` (14) conviven; 4 no tienen `category`; solo 12 declaran `origin`                                    | Un esquema único de frontmatter, validado                                                                 |
| Solo **3** tienen evals (`crear-agente`, `evol-minimal`, `readme-master`), aunque `crear-skill` exige al menos 3 casos                | Las adoptadas llevan evals o se marcan «sin evaluar»                                                       |
| 2 traen scripts (`evol-minimal/scripts/minimal.py`, `crear-agente/scripts/validate_agent.py`), ambos Python sin dependencias ni red   | Son los que la auditoría debe leer línea a línea; no hay accesos a red en las 74                           |
| 7 declaran `inspired_by` (MIT o «atribución en NOTICE»); `lightweight-charts` (559 líneas, la más larga) es de TradingView y `local_only` | Procedencia y licencia obligatorias; las de terceros no se copian al repositorio (criterio 56)             |
| `evol-prompt-master` pide una salida con emojis (🎯 💡 ⚙️) aunque la regla del sistema los prohíbe                                    | La comprobación «sin emojis» habría detenido a una skill propia                                            |
| `evol-context7` dice a la vez «0 referencias a MCP» y registra un servidor MCP; 2 skills aún hablan de «Modo COMPLETO / Memoria Persistente» | Restos legacy: candidatas a «reescribir» o «dejar» en S0                                          |
| 6 carpetas con un `.gitkeep` suelto; sin ninguna referencia a GitNexus (ya erradicado)                                                | Ruido sin valor; la limpieza es parte de adoptar                                                           |

Resultado práctico para S0: una skill se **adopta con cambios** (quitar el bloque de memoria, reparar el frontmatter,
normalizar `triggers`, reescribir rutas), no se copia.

**Lo que enseña `prompts/` para el agente auditor**

- El contrato de un agente es corto y uniforme: frontmatter (`name`, `description`, `category`, `triggers` que empiezan por
  `/evol `, `skills`), misión, alcance, restricciones y referencias; el registro lo valida con un esquema.
- `evol-compliance-auditor` ya resolvió lo que el auditor de skills necesita: veredictos **PASS / WARN / BLOCK**, donde un
  `CRITICAL` bloquea **sin anulación** y un `WARN` es solo aviso que el usuario puede aceptar con confirmación explícita. Se
  adopta para `skill-intake` en lugar de los veredictos solo consultivos de `evol-auditor`.
- `evol-researcher` ya declara un contrato de fallo: si gitleaks o semgrep no están, avisa y marca `scan_skipped: true`. Se
  adopta, pero endurecido: una skill con `scan_skipped` queda como «no auditada» y no entra a la biblioteca.
- `evol-agent-factory` limita a los agentes efímeros: no tocan la gobernanza, no crean otros agentes y deben registrar sus
  decisiones antes de terminar. El auditor de skills hereda esas tres reglas.
- `evol-analyst` usa un índice de código (`impact`, `trace`) mediante una skill `code-graph-tools` que no existe: en
  evol-driven ese papel lo cubre el indexador nativo, así que la skill se reemplaza por `evol impact` y `evol trace`.
- La orquestación (`sequential`, `parallel`, `parallel_then_sync`, `party`) y las reglas de delegación están fuera de la v1:
  los agentes se muestran, pero no se orquestan.

**Convenciones de evol-system que la auditoría debe comprobar** (están en `acuerdos/memoria/decisiones.md`)

- **CSO:** la `description` dice *cuándo* activarse, no *cómo* trabaja; si detalla el procedimiento, el agente sigue la
  descripción y no lee la skill. La auditoría lo marca.
- Sin emojis en ningún archivo de la skill, y casos de prueba que incluyan cuándo **no** debe activarse.
- Una skill de generación de código no deja marcas de terceros por defecto (`attributionLogo: false`).
- Las skills de terceros llevan su atribución en `NOTICE` y respetan la licencia (la memoria retiró GitNexus por licencia).

**Decisiones propuestas** (corrígelas)

1. **Fuente de verdad: este repositorio.** Las skills de evol-driven viven en `skills/`, versionadas; la biblioteca del
   usuario es el destino de instalación. Cada skill declara su alcance: `paquete` o `personal`. **No se migran las 74 en
   bloque:** se revisa cuáles siguen vigentes (hay legacy, p. ej. lo de GitNexus o el «Modo COMPLETO») y se adoptan solo
   esas; las demás quedan como referencia.
2. **Las reglas bloquean; el agente complementa.** Pasada 1, determinista y nativa (TypeScript), toma las reglas de
   `evol-shield`, emite PASS/WARN/BLOCK y **falla cerrada**: si falta una herramienta que debía correr (gitleaks, semgrep), el veredicto es «no
   auditada», nunca «aprobada». Pasada 2, `evol-auditor` en fase `skill-intake`, para lo que una regla no ve. Un agente puede
   equivocarse o ser engañado por la propia skill, por eso no es la única barrera.
3. **El agente nunca escribe en la biblioteca.** Solo propone el veredicto; entrar exige una persona en una terminal
   (`evol skills approve <id>`), como `evol approve`. La aprobación queda firmada en la cadena HMAC.
4. **Cada disciplina declara su skill o su ejecutor** (`executor` ya existe en las fichas de evol-system: workflow, skill o
   capa declarativa). Una disciplina sin ninguna de las tres se marca.
5. **Una sola cifra.** El catálogo se genera del disco, no a mano.

**Hitos**

| #   | Qué se construye                                                                                                                                                  | Se comprueba con      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| S0  | Inventario: clasificar las 74 skills y los 18 agentes de evol-system en «adoptar», «reescribir» y «dejar» (legacy), con una sola cifra generada del disco           | criterios 51 y 52     |
| S1  | Modelo y biblioteca: `src/skills/`, manifiesto con grupo, disciplina, alcance, huella y auditoría; `evol skills list`, `check`, `export`; campo `skill`/`executor` en las 31 disciplinas | criterios 49 a 53 |
| S2  | Auditor determinista: `evol skills audit <ruta>` en cuarentena, que falla cerrada; reglas de secretos, scripts, red, inyección, CSO y frontmatter; informe y huella | criterio 59           |
| S3  | Fase `skill-intake` de `evol-auditor` (plantilla de seguridad) y `evol skills approve`, solo persona en terminal                                                   | criterios 59 y 60     |
| S4  | Adoptar lo elegido en S0: traer a `skills/` solo esas skills, reparar los frontmatter rotos que se adopten, revisar los scripts y auditarlas; lo descartado queda documentado | criterio 51           |
| S5  | Usar e instalar: `add --proyecto` e `install --agente` (enlace simbólico), que rechazan una skill sin auditar o cuya huella cambió y no sobrescriben sin confirmar  | criterios 54 y 60     |
| S6  | `evol ui` lee la biblioteca y el registro de agentes reales; la pantalla Skills deja de ser maqueta                                                                 | criterios 48, 57, 58  |

**Orden y riesgo.** S0, S1 y S4 cierran el hueco de datos; S2 y S3 cierran el de seguridad. Si se hace S4 antes que S2 y S3,
las skills adoptadas entran **sin** auditoría independiente: esa es la decisión de riesgo que conviene tomar a conciencia.

**Preguntas abiertas**

- ¿Cuáles de las 74 skills y de los 18 agentes de evol-system son legacy y cuáles se adoptan? (S0; sin esa lista no se puede
  dimensionar el hito)
- ¿Las skills adoptadas pasan por el auditor, o se consideran de confianza por ser tuyas? (propongo que pasen: 2 traen scripts)
- ¿`evol-auditor` corre dentro de Claude Code o lo lanza evol como subproceso? Lo segundo exige un CLI o una clave y no sirve en CI.
- ¿Una skill de terceros puede traer scripts, o se rechazan siempre? (propongo: aviso y aprobación explícita)
- ¿Dónde están los wireframes aprobados de agentes y skills? Si los tienes, la pantalla se rehace a partir de ellos.

