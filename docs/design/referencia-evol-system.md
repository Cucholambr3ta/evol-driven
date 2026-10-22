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

---

## Clasificación de las 74 skills de evol-system

> Esta tabla nombra skills del sistema anterior y por eso vive aquí, fuera del producto. Ninguna skill ni agente de evol-driven
> puede contener esos nombres. «Recrear» quiere decir **escribir un texto nuevo** desde cero, sin copiar nombres, rutas ni
> comandos. Las fases son las del pipeline de evol-driven: briefing, spec, plan, build, qa y retro.

**Resumen:** 74 skills = 31 de disciplina + 43 de otro tipo.

| Decisión | Cuántas | Qué significa |
| --- | --- | --- |
| Ahora (ola 1) | 9 + 3 | Las 9 disciplinas base y las 3 skills de razonamiento |
| Después | 22 + 5 + 3 aprobadas | Las 22 disciplinas extendidas y las skills útiles pero no urgentes; las 3 que eran dudosas (`minimo-necesario`, `escribir-skill`, `escribir-readme`) se aprobaron |
| Fusionar | 6 | Su contenido pasa a una disciplina, a un rol o a una skill nueva; no existen por separado |
| No | 26 | Las reemplaza otra pieza, o están fuera de alcance |

### A. Las 31 skills de disciplina

Se recrean a partir de **las fichas de evol-driven** (`disciplines/*.json`), no de las skills viejas. La fase viene de esas fichas.

| Skill vieja | Disciplina | Tipo | Decisión | Fases en evol-driven | ¿Ligada a una fase? | Rol que la aplica |
| --- | --- | --- | --- | --- | --- | --- |
| `evol-atdd-acceptance` | ATDD | base | **Ahora** (ola 1) | briefing, qa | sí, por la ficha de la disciplina | verificador |
| `evol-bdd-behavior` | BDD | base | **Ahora** (ola 1) | briefing, qa | sí, por la ficha de la disciplina | verificador |
| `evol-ddd-domain` | DDD | base | **Ahora** (ola 1) | spec | sí, por la ficha de la disciplina | arquitecto |
| `evol-fdd-feature` | FDD | base | **Ahora** (ola 1) | briefing, plan | sí, por la ficha de la disciplina | analista |
| `evol-sdd-spec` | SDD | base | **Ahora** (ola 1) | spec, plan, build, qa, retro | sí, por la ficha de la disciplina | arquitecto |
| `evol-stdd-security-test` | STDD | base | **Ahora** (ola 1) | build | sí, por la ficha de la disciplina | seguridad |
| `evol-secdd-security` | SecDD | base | **Ahora** (ola 1) | qa | sí, por la ficha de la disciplina | seguridad |
| `evol-tdd-unit` | TDD | base | **Ahora** (ola 1) | build | sí, por la ficha de la disciplina | constructor |
| `evol-threat-model` | THREAT | base | **Ahora** (ola 1) | spec | sí, por la ficha de la disciplina | seguridad |
| `evol-a11ydd` | A11yDD | extendida | Después | briefing, qa | sí, por la ficha de la disciplina | analista |
| `evol-add-arch` | ADD | extendida | Después | spec | sí, por la ficha de la disciplina | arquitecto |
| `evol-apivdd` | APIVDD | extendida | Después | plan | sí, por la ficha de la disciplina | arquitecto |
| `evol-ccdd-contract` | CCDD | extendida | Después | qa | sí, por la ficha de la disciplina | verificador |
| `evol-cdcdd` | CDCDD | extendida | Después | plan | sí, por la ficha de la disciplina | constructor |
| `evol-chaos-resilience` | CHAOS | extendida | Después | qa | sí, por la ficha de la disciplina | verificador |
| `evol-compliance-drivers` | COMPLIANCE | extendida | Después | spec | sí, por la ficha de la disciplina | seguridad |
| `evol-debt-budget` | DebtBudgetDD | extendida | Después | plan | sí, por la ficha de la disciplina | constructor |
| `evol-deprecation` | DeprecationDD | extendida | Después | plan | sí, por la ficha de la disciplina | arquitecto |
| `evol-eda` | EDA | extendida | Después | spec | sí, por la ficha de la disciplina | arquitecto |
| `evol-esdd-events` | ESDD | extendida | Después | spec | sí, por la ficha de la disciplina | arquitecto |
| `evol-iodd-iac` | IODD | extendida | Después | spec | sí, por la ficha de la disciplina | operaciones |
| `evol-mdd-migrate` | MDD | extendida | Después | plan | sí, por la ficha de la disciplina | arquitecto |
| `evol-odd-api` | ODD_API | extendida | Después | spec | sí, por la ficha de la disciplina | arquitecto |
| `evol-odd-obs` | ODD_OBS | extendida | Después | qa | sí, por la ficha de la disciplina | operaciones |
| `evol-pdd-perf` | PDD | extendida | Después | qa | sí, por la ficha de la disciplina | verificador |
| `evol-pipeline-ci` | PIPELINE | extendida | Después | build | sí, por la ficha de la disciplina | operaciones |
| `evol-privacy-drivers` | PrivacyDD | extendida | Después | spec | sí, por la ficha de la disciplina | seguridad |
| `evol-rdd-refactor` | RDD | extendida | Después | build | sí, por la ficha de la disciplina | constructor |
| `evol-slo-sla` | SLO | extendida | Después | qa | sí, por la ficha de la disciplina | operaciones |
| `evol-udd-usecase` | UDD | extendida | Después | briefing | sí, por la ficha de la disciplina | analista |
| `evol-uxdd-ux` | UXDD | extendida | Después | briefing | sí, por la ficha de la disciplina | analista |

### B. Las 43 demás

La columna «Ligada hoy» dice dónde la conectaba el sistema anterior (ninguna = no estaba en ninguna fase). La columna «Fase sugerida»
dice dónde debería estar en evol-driven; entre paréntesis, dónde iría si algún día se retomara.

| Skill vieja | Decisión | Destino en evol-driven | Ligada hoy | Fase sugerida | Motivo |
| --- | --- | --- | --- | --- | --- |
| `evol-idea-refine` | **Ahora** | `afinar-idea` | briefing (antes del briefing) | briefing | Convierte un pedido vago en una propuesta de una página. Es el primer punto de razonamiento del orquestador. |
| `evol-grill-me` | **Ahora** | `interrogar-plan` | plan (antes de aprobar el plan) | plan | Un plan que nadie cuestionó no se aprueba; la verificación exige su marca. |
| `evol-fact-check` | **Ahora** | `verificar-afirmaciones` | spec y qa | spec, qa | Comprueba benchmarks, documentación de terceros y avisos de seguridad antes de darlos por ciertos. |
| `evol-discovery` | Fusionar | en `afinar-idea` y el rol `analista` | briefing | briefing | La investigación de usuario cabe en esos dos; no necesita skill propia. |
| `evol-ethnography` | Fusionar | en la disciplina UXDD y el rol `analista` | briefing | briefing | Es una variante de investigación de usuario. |
| `evol-cognitive-ux` | Fusionar | en la disciplina UXDD | ninguna | briefing | Carga cognitiva y modelos mentales son criterios de UX. |
| `evol-observability` | Fusionar | en la disciplina ODD_OBS | ninguna | qa | La disciplina ya cubre telemetría, trazas y paneles. |
| `evol-workflow-design` | Fusionar | en las disciplinas PIPELINE y ADD | ninguna | plan | Diseño de procesos y CI/CD ya son de esas disciplinas. |
| `evol-sandbox` | Fusionar | en `evol skills audit` (la cuarentena) | ninguna | — | Aislar para ejecutar es parte de la auditoría, no una skill de uso. |
| `agent-eval` | Después | `evaluar-skill` | ninguna (la usan los auditores) | qa | Evaluar cada skill con casos que deben activarla y casos que no. Llega con los hitos S1 y S2. |
| `evol-ai-review` | Después | `revisar-cambios` | qa (puerta de calidad) | qa | Revisión de código con criterio; encaja con el rol `verificador`. |
| `evol-cost-analysis` | Después | `analizar-costes` | ninguna | plan | Costes y retorno de una decisión de arquitectura. |
| `evol-code-archaeology` | Después | `explorar-codigo-existente` | ninguna | briefing | Útil al adoptar un proyecto existente con `evol init`. |
| `evol-prompt-master` | Después | `afinar-prompt` | build (transversal) | build | Para escribir los prompts de las skills y de los envoltorios de subagente. |
| `evol-minimal` | Después (aprobada) | `minimo-necesario` | revisión de código, auditoría y deuda | build, qa | Contra la sobreingeniería; idea tuya. Trae un script que habría que reescribir. |
| `crear-skill` | Después (aprobada) | `escribir-skill` | ninguna | retro | Guía para escribir skills; encaja al cerrar un ciclo con una lección repetida. |
| `readme-master` | Después (aprobada) | `escribir-readme` | gancho pre-push | qa | Estándar de documentación; no es urgente. |
| `code-indexer` | No | lo reemplaza `evol impact` y `evol trace` | plan y build (agente analista) | — | El indexador de código ya es nativo. |
| `crear-agente` | No | lo reemplazan los envoltorios generados y `skill-auditor` | ninguna | — | Los roles se definen una vez, como skills. |
| `evol-skill-manager` | No | lo reemplazan `evol skills` y el auditor | ninguna | — | Instalar, actualizar y validar es CLI, no skill. |
| `update-context` | No | lo reemplazan MemPalace y `evol hook session-start` | inicio de sesión | — | La memoria y el estado ya los resuelve otra pieza. |
| `update-memory` | No | lo reemplazan MemPalace y `evol lessons` | retro (cierre de sprint) | — | Ídem. |
| `evol-compact` | No | lo hacen los propios IDE y la memoria | ninguna | — | Compactar contexto no es del pipeline. |
| `evol-talk-compact` | No | ídem | ninguna | — | Ídem. |
| `evol-fs-context` | No | ídem | ninguna | — | Ídem. |
| `evol-context7` | No | externa; si se quiere, entra por el auditor | ninguna | — | Documentación de librerías vía un servicio de terceros. |
| `evol-governance` | No | lo cubren `evol approve` y PASS/WARN/BLOCK | ninguna | — | La gobernanza ya es parte del núcleo. |
| `evol-systems-design` | No | lo cubre la disciplina ADD | ninguna | — | Inspirada en juegos; sin uso claro. |
| `evol-balance` | No | — | ninguna | — | Inspirada en juegos. |
| `evol-pacing` | No | — | ninguna | — | Inspirada en juegos. |
| `evol-narrative-docs` | No | — | ninguna | — | Inspirada en juegos. |
| `evol-domain-sales` | No | fuera de alcance | ninguna | (spec, si se retomara) | Asesor de un dominio de negocio. |
| `evol-domain-finance` | No | fuera de alcance | ninguna | (spec, si se retomara) | Ídem. |
| `evol-domain-marketing` | No | fuera de alcance | ninguna | (spec, si se retomara) | Ídem. |
| `evol-change-mgmt` | No | fuera de alcance | ninguna | (retro, si se retomara) | Gestión del cambio organizativo. |
| `evol-team-dynamics` | No | fuera de alcance | ninguna | (retro, si se retomara) | Dinámica de equipos. |
| `evol-dx-advocate` | No | fuera de alcance | ninguna | (retro, si se retomara) | Comunidad y experiencia de desarrolladores. |
| `evol-growth-experiment` | No | fuera de alcance | ninguna | (retro, si se retomara) | Pruebas A/B y conversión. |
| `evol-seo-technical` | No | fuera de alcance | ninguna | (qa, si se retomara) | Solo para software web. |
| `evol-mcp-builder` | No | fuera de alcance | ninguna | (build, si se retomara) | Construir servidores MCP no es el pipeline. |
| `evol-frontend-design` | No | de terceros; si se quiere, entra por el auditor | ninguna | (build) | Diseño de interfaces. |
| `evol-remotion` | No | de terceros; si se quiere, entra por el auditor | ninguna | (build) | Vídeo y animación en React. |
| `lightweight-charts` | No | personal y de terceros (TradingView) | ninguna | — | Gráficos financieros. |

### C. Mapa de lo que se recrea, por fase del pipeline

| Fase | Razonamiento | Disciplinas base de la fase | Después |
| --- | --- | --- | --- |
| briefing | `afinar-idea` | FDD, ATDD, BDD | UDD, UXDD, A11yDD, `explorar-codigo-existente` |
| spec | `verificar-afirmaciones` | SDD, DDD, THREAT | ADD, EDA, ESDD, ODD_API, COMPLIANCE, PrivacyDD, IODD |
| plan | `interrogar-plan` | SDD, FDD | APIVDD, MDD, CDCDD, DebtBudgetDD, DeprecationDD, `analizar-costes` |
| build | — | SDD, TDD, STDD | RDD, PIPELINE, `afinar-prompt`, `minimo-necesario` |
| qa | `verificar-afirmaciones` | SDD, ATDD, BDD, SecDD | CCDD, PDD, CHAOS, A11yDD, ODD_OBS, SLO, `revisar-cambios`, `evaluar-skill` |
| retro | — | SDD | `escribir-skill` |

