# 01: Estado completo de Evol-Driven (2026-11-26)

Es una fotografía del framework para el agente que hará la integración en otro equipo. Las cifras salen de comandos ejecutados hoy (ver `evidence-v4.md`). Si algo de lo que dice aquí no coincide con lo que veas allí, **gana lo que veas**: vuelve a ejecutar el comando y anota la diferencia.

## 1. Identidad

| Dato | Valor |
|---|---|
| Qué es | Framework de desarrollo en TypeScript: un pipeline de 6 fases con disciplinas «Driven Development», compuertas verificables, aprobación humana firmada y memoria persistente |
| Repositorio | `git@github.com:Cucholambr3ta/evol-driven.git` (privado, `UNLICENSED`) |
| Versión | **0.5.0** (`package.json`, `release.json`, etiqueta `v0.5.0` publicada) |
| Runtime | Node **≥ 24** (`engines`); ESM; dependencias: `@modelcontextprotocol/sdk`, `ts-morph`, `yaml`, `zod` |
| Comando | `evol` (copia estable firmada en `~/.local/share/evol/versiones/*`, de solo lectura) y `evol-dev` (enlace al origen, para desarrollar) |
| CI | `npm run ci` = lint + typecheck + prettier + build + vitest |
| Idioma | Mensajes y documentación en español; identificadores en inglés |

## 2. Estado del pipeline de este repositorio

El repositorio se desarrolla **con su propio pipeline**, usando la copia estable instalada, no `evol-dev`.

| Ciclo | Contenido | Estado |
|---|---|---|
| 1 | Construcción del framework hasta la 0.4.x | terminado |
| 2 | Documentación atómica con evidencia (GRANULAR, INVESTIGACION, REQDD, SPRINTDD, `evol docs`, `evol sprint`), Ampliación 8, CA-150 a CA-170 | terminado; publicado como **0.5.0** el 2026-10-26 |
| **3** | Abierto el 2026-11-16 (`47a93c8`) en **briefing** | **briefing sin escribir**: `FEATURES.md`, los 16 `.feature` y las 16 pruebas de aceptación siguen siendo del ciclo 2. `evol verify` da PASS porque los archivos existen, no porque cubran el ciclo 3 |

- Estado interno: `.evol/state.json` (`ciclo: 3`, `currentPhase: briefing`), `.evol/gate-log.jsonl` (15 entradas firmadas con HMAC) y `.evol/journal.jsonl` (47 eventos).
- `.evol/checkpoint.md` está **desactualizado**: describe la retro del ciclo 2.
- Especificación: `docs/ESPECIFICACION.md` (1 883 líneas, **CA-1 a CA-170**, Ampliaciones 1 a 8) y la del ciclo en `docs/specs/SPEC.md`, `DOMAIN.md` y `THREATS.md`.
- Lecciones registradas: 7, en `lecciones.md` y `evol lessons list`. Entre ellas: «una prueba de aceptación que invoca el CLI puede no probar lo que dice», «el binario estable puede no ver una mejora de la propia ola», «los comprobadores de documentos necesitan pruebas hostiles desde el primer día» y «un límite de tiempo absoluto en una prueba falla bajo carga».

## 3. Las seis fases y las reglas invariables

`briefing → spec → plan → build → qa → retro`. Después, `evol ciclo nuevo` abre otro ciclo.

1. `evol verify [--inicio]` devuelve **PASS, WARN o BLOCK** y no cambia nada. Ojo: en modo «fin» **ejecuta los comandos** configurados (`TDD → npm run ci`).
2. **`evol approve` y `evol next` los ejecuta solo una persona, en su terminal.** Ningún agente los ejecuta ni los rodea. Claude Code tiene un hook que los bloquea; en otros IDE el bloqueo es parcial (ver §8).
3. En plan, el plan se interroga (skill `interrogar-plan`) y se registra con `evol interrogate <doc>` antes de aprobar.
4. Una aprobación firma los hashes de los artefactos y de `evol.config.json`. Si un artefacto cambia, la aprobación queda **obsoleta**.
5. Los archivos con `[[COMPLETAR]]` están sin escribir.
6. Checkpoint y commit al terminar cada encargo: `evol checkpoint --nota "…"`.

## 4. Mapa del código (`src/`, 146 archivos .ts, ~23 500 líneas)

| Carpeta | Responsabilidad | Archivos clave |
|---|---|---|
| `core/` | Pipeline, fases, estado, compuertas, verificación, cobertura CA→escenario→prueba, riesgo, exportación, journal, checkpoint, perfiles, roles, adopción | `gate.ts` (HMAC, `requireKey`, `keyPath`), `verify.ts` (ejecuta comandos con `shell: true`, EV-072), `pipeline.ts`, `phases.ts`, `state.ts`, `coverage.ts`, `export.ts`, `disciplines.ts`, `profiles.ts` |
| `commands/` | Un archivo por subcomando de la CLI (33) | `approve.ts`, `next.ts`, `verify.ts`, `mcp.ts`, `ciclo.ts`, `release.ts`, `update.ts`, `setup.ts`, `doctor.ts` |
| `mcp.ts` | Servidor MCP (stdio) | 13 herramientas, ver §6 |
| `memory/` | Cliente de MemPalace (proceso externo) y eventos | `mempalace.ts`, `events.ts` |
| `codeintel/` | Grafo de código nativo (ts-morph → `.evol/codegraph.sqlite`) y proveedor opcional GitNexus | `native/`, `provider.ts`, `gitnexus.ts` |
| `agents/` | Integración con IDE (Claude Code, Codex, OpenCode, Antigravity, Hermes): archivos de agentes, roles, respaldos, convivencia | `adapters.ts`, `orchestrator.ts`, `roles.ts` |
| `skills/` | Biblioteca de skills: lista, comprobación, exportación, **auditor** (lectores LLM, cuarentena, autoprueba) y aprobación | `auditor/runner.ts` |
| `security/` | `evol security scan`: gitleaks, semgrep (`rules/semgrep`), dependencias, SBOM (syft) y otras herramientas opcionales | |
| `docs/` | `evol docs check/evidencia`, `evol sprint` (analizador de Markdown con lectura acotada) | |
| `knowledge/` | Fuentes de documentación con origen, fecha y licencia | |
| `report/`, `diagrams/` | Informe DOCX/PDF/MD con 14 diagramas UML | |
| `release/` | Publicación firmada, aviso de versión (activado por defecto, EV-074) | `notice.ts` |
| `setup/`, `improve/` | `evol setup` (instala lo que falta, preguntando) y buzón de mejoras | |

Otras carpetas de primer nivel:
- `disciplines/`: 35 definiciones (14 base y 21 extendidas).
- `skills/`: 64 skills y `manifest.json`.
- `templates/project/`: plantilla de `evol new`.
- `rules/semgrep/`.
- `tests/`: 77 archivos de prueba, unos 1 430 casos en el último CI verde del ciclo 2, con `acceptance/`, `features/`, `fixtures/` y `security*`.

## 5. CLI (33 subcomandos)

| Grupo | Comandos |
|---|---|
| Proyecto | `new`, `init` (adopta sin tocar), `status`, `prerequisites`, `verify`, `interrogate`, `next`\*, `approve`\*, `ciclo nuevo`\*, `checkpoint`, `handoff`, `export --json` |
| Calidad | `coverage`, `risk`, `security scan [--ci]`, `docs check/evidencia`, `sprint check/estado`, `report`, `diagrams` |
| Código | `index`, `impact <símbolo>`, `trace <símbolo>` |
| Memoria y conocimiento | `memory add/search`, `lessons list/check`, `knowledge source/review/search` |
| Disciplinas y skills | `disciplines list/profiles/suggest/enable/disable`, `skills list/check/export/audit/approve`\* |
| Agentes | `agents [--ide …]`, `hook session-start`, `mcp` |
| Framework | `mejora add/list/hecha/descartar`, `update [--comprobar/--volver]`, `release`, `version --json`, `setup`, `doctor` |

\* Solo los ejecuta una persona.

## 6. MCP `evol`

Herramientas: `evol_status`, `evol_prerequisites`, `evol_verify`, `evol_disciplines`, `evol_lessons`, `evol_memory_search`, `evol_memory_add`, `evol_checkpoint`, `evol_index`, `evol_impact`, `evol_trace`, `evol_find_symbol` y `evol_knowledge_search`.

**Defecto conocido (EV-058, AMD-01):** la especificación lo llama «solo lectura», pero `evol_checkpoint`, `evol_memory_add` y `evol_index` escriben, y `evol_verify` ejecuta comandos. Para Studio, cada herramienta se clasifica **por su efecto real** (doc 10 de v3.1).

## 7. Disciplinas (35) y perfiles

**Base (14):** SDD, FDD, DDD, ADD, THREAT, BDD, ATDD, TDD, STDD, SecDD, GRANULAR, INVESTIGACION, REQDD, SPRINTDD.

**Extendidas (21):** A11yDD, APIVDD, CCDD, CDCDD, CHAOS, COMPLIANCE, DebtBudgetDD, DeprecationDD, EDA, ESDD, IODD, MDD, ODD_API, ODD_OBS, PDD, PIPELINE, PrivacyDD, RDD, SLO, UDD, UXDD.

| Fase | Disciplinas que la verifican |
|---|---|
| briefing | FDD, BDD, ATDD, INVESTIGACION, A11yDD, UDD, UXDD |
| spec | SDD, DDD, ADD, THREAT, GRANULAR, INVESTIGACION, REQDD, COMPLIANCE, EDA, ESDD, IODD, ODD_API, PrivacyDD |
| plan | FDD, SDD, SPRINTDD, APIVDD, CDCDD, DebtBudgetDD, DeprecationDD, MDD |
| build | SDD, SPRINTDD, TDD, STDD, PIPELINE, RDD |
| qa | SDD, SPRINTDD, BDD, ATDD, SecDD, A11yDD, CCDD, CHAOS, ODD_OBS, PDD, SLO |
| retro | SDD, SPRINTDD |

(SDD rige «desde spec» y SPRINTDD «desde plan»: se exigen en esa fase y en todas las siguientes.)

**Perfiles** (`evol disciplines profiles`): `base` (las 14), `api` (+ODD_API, APIVDD, CCDD, ODD_OBS, DeprecationDD, PDD), `web` (+UXDD, A11yDD, UDD, PDD), `erp` (+MDD, COMPLIANCE, PrivacyDD, ODD_API, DebtBudgetDD), `lib` y `script`.

**Activas en este repositorio** (`evol.config.json`, módulo `app`): SDD, FDD, DDD, THREAT, BDD, ATDD, TDD, STDD, SecDD, con `TDD → npm run ci`. Cambiar las disciplinas activas cambia lo que firma la aprobación, así que es una decisión de la persona.

## 8. Skills y roles

- **64 skills** en `skills/`. Según `evol skills list`, la biblioteca tiene 66 (18 auditadas y 48 «auditadas con avisos») y **cada una de las 35 disciplinas tiene su skill**.
- **Roles** (6): `analista`, `arquitecto`, `constructor`, `operaciones`, `verificador` y `seguridad`. Los dos últimos revisan **en solo lectura y con contexto limpio**, como subagentes cuando el IDE lo permite.
- **Orquestación y proceso:** `evol` (el orquestador `/evol`), `afinar-idea`, `interrogar-plan`, `incorporar-skill`, `evaluar-skill`, `incorporar-dependencia`, `revisar-secretos`, `verificar-afirmaciones`, `sin-sobreingenieria`, `respuestas-compactas`.
- **Dominio y oficio:** `descubrir-necesidades`, `arqueologia-codigo`, `costes-proyecto`, `diseno-frontend`, `documentacion`, `readme`, `seo-tecnico`, `construir-mcp`, `dominio-finanzas`, `dominio-marketing`, `dominio-ventas`, `effectcraft`, `filmcraft`.
- Ninguna skill se incorpora ni se aprueba sin pasar por `incorporar-skill` y la terminal de la persona. `release.json` fija el hash de cada skill publicada.
- **Integración con IDE** (`evol doctor`): Claude Code es de nivel A, con subagentes nativos, `/evol` y bloqueo de aprobar instalado. En Codex, OpenCode y Antigravity faltan los archivos (`evol agents --ide <ide>`). En OpenCode, el bloqueo de `approve`/`next` y el MCP se añaden **a mano** en `opencode.json`.

## 9. Gobernanza: cómo se aprueba hoy y por qué Studio lo cambia

- **Hoy:** `evol approve <fase>` escribe en `gate-log.jsonl` una entrada firmada con **HMAC**. La clave está en `~/.config/evol/keys/<projectId>`, **fuera del repositorio**. `evol next` exige una aprobación vigente y una verificación en PASS.
- **Defectos ya diagnosticados** que Studio no debe heredar:
  - Con HMAC, quien puede verificar también puede firmar (EV-060).
  - La firma ocurre dentro del proceso del agente (EV-061).
  - `verify`, `approve` y `next` no concilian el estado con el registro; solo lo hace `doctor` (NC-01, EV-045).
- **Objetivo v3.1 (OD-04, ratificada en su arquitectura):** un Approval Broker como proceso separado, con **WebAuthn y verificación de usuario + firma Ed25519**, con fallo cerrado y un Approval Checklist por fase (OD-26). Está **pendiente de validación**: hasta superar P-18 a P-34, las aprobaciones protegidas de Studio **permanecen bloqueadas** y se sigue usando `evol approve` en la terminal.

## 10. Memoria e inteligencia de código

- **Memoria de este repositorio:** MemPalace, en el wing `evol_driven`. Es un proceso externo con **un solo escritor** (m-014). `CLAUDE.md` prohíbe usar otra. Los datos del palacio son **locales al equipo** y no viajan con git.
- **Instalaciones nuevas de Studio:** dsh-mnemon + Mnemon Native (OD-03), con condiciones: todo local, offline, aislado por proyecto, con procedencia, sin autoevolución de skills y sin migrar MemPalace de forma destructiva. Interfaz prevista: `MemoryProvider` (AMD-04), con implementaciones `mempalace` y `mnemon`.
- **Código:** grafo nativo (`codeIntel: "native"`, `.evol/codegraph.sqlite`, ignorado por git; se regenera con `evol index`). Para Studio, Codebase Memory MCP se queda como opción (OD-05), **bloqueada por procedencia** mientras su paquete npm no declare un repositorio real (EV-084).

## 11. Pendientes del framework que afectan a la integración

| ID | Pendiente | Dónde |
|---|---|---|
| H0-1 | Conciliar estado↔log en `verify`, `approve` y `next` | v3.1 doc 14 §2 bis |
| H0-2 | Anotar las herramientas MCP por efecto y dividir `evol_verify` | AMD-01 |
| H0-3 | Firma asimétrica fuera del proceso del agente, con migración `epoch-start` del tramo HMAC | AMD-03, doc 11 |
| H0-4 | Interfaz `MemoryProvider` | AMD-04 |
| H0-5 | Lock de `.evol/`, `verifier_version` en lo firmado y trailer `CA:` | OD-12, doc 14 |
| AMD | Enmiendas AMD-01 a AMD-08 **redactadas, no aplicadas** a `ESPECIFICACION.md` | v3.1 doc 28 |
| m-xxx | 12 mejoras pendientes en el buzón (`evol mejora list`): m-016 (semgrep), m-017 (symlinks), m-011 y m-018 (gitleaks y gate-log) y m-014 (MemPalace) | buzón local `~/.config/evol/mejoras/`, **no viaja con git** |
