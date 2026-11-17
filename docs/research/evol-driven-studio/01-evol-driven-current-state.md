# 01 — Estado actual de Evol-Driven (R0)

Commit `47a93c8`, versión declarada 0.5.0, Node ≥24 (EV-001). Evidencia: `evidence/EVIDENCE.md`. La implementación real prevalece sobre las descripciones históricas; las diferencias con la auditoría previa se listan al final.

## 1. Inventario técnico

| Área | Contenido | Estado |
|---|---|---|
| CLI | `src/cli.ts` + 34 archivos en `src/commands/` (incluye los auxiliares `shared.ts` y `tty.ts`) (`status`, `verify`, `approve`, `next`, `ciclo`, `checkpoint`, `handoff`, `memory`, `index`, `impact`, `trace`, `coverage`, `risk`, `security`, `skills`, `knowledge`, `update`, `release`, `doctor`, `setup`…) | VERIFIED (listado) |
| Núcleo | `src/core/` (gate, state, pipeline, verify, coverage, journal, checkpoint, interrogation, disciplines, config…), ≈1 350 líneas en los 7 archivos centrales | VERIFIED |
| Code Intelligence | `src/codeintel/` (≈1 050 líneas): proveedor `native` (ts-morph + SQLite) y `gitnexus` (MCP externo, licencia no comercial) | VERIFIED |
| Memoria | `src/memory/` (`mempalace.ts` por MCP, `events.ts`); wing configurado en `evol.config.json` | VERIFIED |
| MCP | `src/commands/mcp.ts`: 13 herramientas `evol_*` | VERIFIED |
| Agentes e IDE | `src/agents/` (adapters, backup, convivencia, files, orchestrator, roles); según la comparativa, 5 destinos (Claude Code, Codex, Antigravity, OpenCode, Hermes) | VERIFIED (archivos) / DOCUMENTED (lista) |
| Skills y disciplinas | `skills/`, `disciplines/`, `rules/`; 60 skills aprobadas una a una con hashes en `release.json` | DOCUMENTED |
| Seguridad | `src/security/` (semgrep, gitleaks, guarddog, osv…) | VERIFIED (módulos) |
| Datos persistentes | `.evol/`: `state.json`, `gate-log.jsonl`, `journal.jsonl`, `checkpoint.*`, `codegraph.sqlite`, `qa/`, `plan-interrogado.json`, `security-ignore.json` | VERIFIED |
| Dependencias de ejecución | `@modelcontextprotocol/sdk`, `ts-morph`, `yaml`, `zod` (4) | VERIFIED |
| Pruebas | 60 archivos `tests/*.test.ts`, 17 de aceptación; suite no ejecutada en esta investigación | VERIFIED (conteo) / UNVERIFIED (resultado) |
| Instalación | `install.sh` (Node 24, git, npm; compila con `npm ci && npm run build`); copia estable por etiqueta firmada y `evol-dev` | VERIFIED |

### Mapa de dependencias reales

```
cli.ts ─► commands/* ─► core/{pipeline,gate,state,verify,coverage,journal,checkpoint}
                         ├─► core/disciplines ─► disciplines/*.json, skills/
                         ├─► codeintel ─► ts-morph ─► .evol/codegraph.sqlite
                         ├─► memory/mempalace ─► MCP stdio ─► proceso `mempalace` (Python/uv)
                         ├─► security/* ─► semgrep|gitleaks|guarddog|osv (binarios externos)
                         └─► agents/* ─► archivos de configuración de cada IDE
commands/mcp.ts ─► servidor MCP stdio (evol_*) ─► las mismas funciones del núcleo
```

## 2. Capacidades

| Capacidad | Dónde | Invocación | Lee | Modifica | Garantías / límites | Clase |
|---|---|---|---|---|---|---|
| Máquina de estados por fases | `core/pipeline.ts`, `state.ts` | `evol status/next` | `state.json`, log | `state.json` | `next` exige aprobación vigente y cadena íntegra; **`state.json` no está firmado ni conciliado con el log** (EV-006) | VERIFIED / INFERRED |
| Aprobación | `core/gate.ts`, `pipeline.ts:150` | `evol approve` (TTY) | artefactos | `gate-log.jsonl` | HMAC encadenado, hashes de artefactos, ciclo; la persona confirma en terminal | VERIFIED |
| Verificación | `core/verify.ts` | `evol verify` | artefactos | nada | PASS/WARN/BLOCK; determinista | VERIFIED |
| Cobertura de CA | `core/coverage.ts` | `evol coverage` | spec, pruebas | nada | mide **presencia del identificador**, no ejecución (EV-011) | DOCUMENTED |
| Journal / checkpoint | `core/journal.ts`, `checkpoint.ts` | automático / `evol checkpoint` | git | `.evol/` | las notas del agente son datos no verificados; RF-1 propone sección calculada | VERIFIED |
| Memoria | `memory/mempalace.ts` | `evol memory`, MCP | MemPalace | MemPalace | dependencia externa; sin estado/versión de recuerdos (EV-012) | VERIFIED |
| Code intelligence | `codeintel/` | `evol index/impact/trace`, MCP | `*.ts/js` | sqlite | solo TS/JS; consultas que escriben (EV-003) | VERIFIED |
| MCP | `commands/mcp.ts` | stdio | todo | memoria, checkpoint, índice | sin anotaciones de solo lectura (EV-004) | VERIFIED |
| Seguridad | `security/` | `evol security scan` | árbol | informes | depende de herramientas externas con versión fija | VERIFIED |
| Agentes | `agents/` | `evol agents` | config IDE | archivos de IDE | adaptadores con garantías desiguales; sin scheduler (EV-008) | VERIFIED |

## 3. Revisión de brechas históricas

| Brecha | Estado actual | Evidencia | Clase |
|---|---|---|---|
| Integridad de la máquina de estados | **Vigente**: el estado no se firma ni se concilia con el log | EV-006 | INFERRED (requiere prueba aislada) |
| Consistencia estado vs. registro firmado | Parcial: `next` y `approve` validan la cadena y el hash de artefactos de **la fase actual**, no el historial completo | EV-005 | VERIFIED |
| Vigencia de las aprobaciones | Corregida en parte: `findValidApproval` compara artefactos y ciclo; un cambio documental invalida la aprobación | `pipeline.ts:236` | VERIFIED (lectura) |
| Aprobación ≠ avance | Implementada: `approve` y `next` son operaciones distintas; ambas exigen TTY/persona (norma del proyecto) | `pipeline.ts` | VERIFIED |
| Cobertura documental ≠ ejecución | **Vigente** | EV-011 | DOCUMENTED |
| MCP mutante | **Vigente**: escribe sin anotar | EV-004 | VERIFIED |
| Independencia revisor/aprobador | Parcial: roles `verificador` y `seguridad` son skills; no hay separación técnica del aprobador respecto del autor (aprueba una persona, pero el agente que construye también «verifica») | `agents/roles.ts` | INFERRED |
| Aislamiento de proyectos | No inspeccionado a fondo; MemPalace separa por wing, el grafo por directorio | EV-010 | UNVERIFIED |
| Persistencia de eventos | `journal.jsonl` append; sin lock | EV-007 | VERIFIED |
| Recuperación tras interrupción | `checkpoint.md` (dato, no orden); sin reanudación de tareas | EV-008 | VERIFIED |
| Duplicación de memoria | **Vigente**: lecciones repetidas, 3 wings por proyecto, dos almacenes (MemPalace/Engram) | EV-012/013 | VERIFIED |
| Concurrencia de agentes | **Vigente**: sin bloqueos | EV-007 | VERIFIED |
| Calidad de evidencias | **Vigente**: patrones RF-1…12 de Evol OS | EV-014 | VERIFIED |

## 4. Deuda técnica y problemas previos a la integración

1. **Contrato de lectura**: separar consultas puras de las que escriben (grafo, MCP).
2. **Estado firmado**: firmar o derivar `currentPhase` del log y detectar discrepancias.
3. **Bloqueo y concurrencia**: lock de proyecto para escrituras en `.evol/`.
4. **Versión del verificador en lo firmado** (auto-hospedaje; lección CA-146).
5. **Cobertura semántica**: estados de evidencia (referencia → ejecutada → aceptada).
6. **Modelo de memoria único** con estado, fecha y reemplazo.
7. **API estable** hacia afuera: hoy solo CLI y MCP; no hay librería TypeScript pública con contratos versionados.
8. **Registro de no-aprobaciones** para medir rechazos.

Estos puntos condicionan el Hito 1 (§13).

## 5. Diferencias con la auditoría previa

- Versión 0.5.0 y 5 destinos de agentes: coinciden.
- El pipeline añade **ciclos** (`ciclo nuevo`) y ya hay 3; la auditoría no los mencionaba.
- La limitación «el MCP expone escritura aunque se presenta como lector» se **confirma**.
- «No se demostró relación entre MemPalace y Engram»: **aclarado**, son almacenes separados.
- No se encontraron cambios que corrijan las brechas EV-003 a EV-008.
