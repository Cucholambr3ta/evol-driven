# 26 — Propuesta exacta de commit y paquete ZIP documental (v3.1)

**Estado: PROPUESTA. No se ha ejecutado ningún `git add`, `git commit` ni `git push`.** La directiva v3.1 §9 autoriza preparar un commit documental **solo** cuando H-04 y D-07 estén cerrados (lo están, documentalmente: docs 19 y 20) o cuando se haya documentado por qué no pueden cerrarse, y exige **presentar el alcance exacto para aprobación final antes de ejecutarlo**. Este documento es esa presentación.

## 1. Situación de partida (verificada al redactar)

- Rama `feat/evol-driven-studio`, `HEAD` `47a93c8`, versión 0.5.0.
- `git status`: únicamente **dos rutas sin rastrear**: `docs/code-memory-research/` (preexistente, **ajena a este encargo**) y `docs/research/` (toda esta investigación).
- Sin cambios en código, `.evol/`, `docs/ESPECIFICACION.md`, `docs/specs/*`, `CLAUDE.md` ni `evol.config.json`.

## 2. Alcance propuesto (opción recomendada A)

**A. Árbol histórico completo y v3.1, enumerado archivo por archivo** (no se añade `docs/research/` entera ni se usan comodines sobre `docs/research/`):

Total de la opción A: **98 archivos** (v1: 25 · v2: 20 · v3: 22 · v3.1: 31).

**Investigación v1 (informes 00–17, ADR 001–006, evidencia) — 25 archivos**

```
docs/research/evol-driven-studio/00-executive-summary.md
docs/research/evol-driven-studio/01-evol-driven-current-state.md
docs/research/evol-driven-studio/02-dsh-architecture.md
docs/research/evol-driven-studio/03-memory-landscape.md
docs/research/evol-driven-studio/04-local-memory-design.md
docs/research/evol-driven-studio/05-code-intelligence-assessment.md
docs/research/evol-driven-studio/06-control-center-design.md
docs/research/evol-driven-studio/07-agent-orchestration.md
docs/research/evol-driven-studio/08-distribution-strategy.md
docs/research/evol-driven-studio/09-security-and-governance.md
docs/research/evol-driven-studio/10-migration-plan.md
docs/research/evol-driven-studio/11-validation-benchmarks.md
docs/research/evol-driven-studio/12-architecture-comparison.md
docs/research/evol-driven-studio/13-renewal-roadmap.md
docs/research/evol-driven-studio/14-risk-register.md
docs/research/evol-driven-studio/15-compatibility-matrix.md
docs/research/evol-driven-studio/16-open-decisions.md
docs/research/evol-driven-studio/17-final-recommendation.md
docs/research/evol-driven-studio/adr/ADR-001-arquitectura-base.md
docs/research/evol-driven-studio/adr/ADR-002-contratos-de-integracion.md
docs/research/evol-driven-studio/adr/ADR-003-orquestacion-de-agentes.md
docs/research/evol-driven-studio/adr/ADR-004-memoria-conversacional.md
docs/research/evol-driven-studio/adr/ADR-005-memoria-de-codigo.md
docs/research/evol-driven-studio/adr/ADR-006-distribucion-y-plataformas.md
docs/research/evol-driven-studio/evidence/EVIDENCE.md
```

**v2 — 20 archivos**

```
docs/research/evol-driven-studio/v2/00-informe-ejecutivo.md
docs/research/evol-driven-studio/v2/01-auditoria-de-consistencia.md
docs/research/evol-driven-studio/v2/02-registro-de-decisiones.md
docs/research/evol-driven-studio/v2/03-arquitectura-objetivo.md
docs/research/evol-driven-studio/v2/04-flujo-multiagente-del-pipeline.md
docs/research/evol-driven-studio/v2/05-matriz-de-subagentes.md
docs/research/evol-driven-studio/v2/06-model-routing.md
docs/research/evol-driven-studio/v2/07-contratos-agentteams.md
docs/research/evol-driven-studio/v2/08-contratos-de-memoria-y-workers.md
docs/research/evol-driven-studio/v2/09-control-center-modulos.md
docs/research/evol-driven-studio/v2/10-inventario-cli-ui.md
docs/research/evol-driven-studio/v2/11-modelo-de-seguridad-approval-broker.md
docs/research/evol-driven-studio/v2/12-skill-evol-studio-plugin-development.md
docs/research/evol-driven-studio/v2/13-plan-tanda-1.md
docs/research/evol-driven-studio/v2/14-plan-tanda-2.md
docs/research/evol-driven-studio/v2/15-roadmap.md
docs/research/evol-driven-studio/v2/16-matriz-de-compatibilidad.md
docs/research/evol-driven-studio/v2/17-deuda-y-pendientes.md
docs/research/evol-driven-studio/v2/18-archivos-modificados.md
docs/research/evol-driven-studio/v2/evidence-v2.md
```

**v3 — 22 archivos**

```
docs/research/evol-driven-studio/v3/00-informe-ejecutivo.md
docs/research/evol-driven-studio/v3/01-auditoria-de-consistencia.md
docs/research/evol-driven-studio/v3/02-registro-de-decisiones.md
docs/research/evol-driven-studio/v3/03-arquitectura-objetivo.md
docs/research/evol-driven-studio/v3/04-flujo-multiagente-del-pipeline.md
docs/research/evol-driven-studio/v3/05-matriz-de-subagentes.md
docs/research/evol-driven-studio/v3/06-model-routing.md
docs/research/evol-driven-studio/v3/07-contratos-agentteams.md
docs/research/evol-driven-studio/v3/08-contratos-de-memoria-y-workers.md
docs/research/evol-driven-studio/v3/09-control-center-modulos.md
docs/research/evol-driven-studio/v3/10-inventario-cli-ui.md
docs/research/evol-driven-studio/v3/11-modelo-de-seguridad-approval-broker.md
docs/research/evol-driven-studio/v3/12-skill-evol-studio-plugin-development.md
docs/research/evol-driven-studio/v3/13-plan-tanda-1.md
docs/research/evol-driven-studio/v3/14-plan-tanda-2.md
docs/research/evol-driven-studio/v3/15-roadmap.md
docs/research/evol-driven-studio/v3/16-matriz-de-compatibilidad.md
docs/research/evol-driven-studio/v3/17-deuda-y-pendientes.md
docs/research/evol-driven-studio/v3/18-archivos-modificados.md
docs/research/evol-driven-studio/v3/19-matriz-de-conciliacion-normativa.md
docs/research/evol-driven-studio/v3/20-informe-de-resolucion-de-hallazgos.md
docs/research/evol-driven-studio/v3/evidence-v3.md
```

**v3.1 (revisión final) — 31 archivos**

```
docs/research/evol-driven-studio/v3.1/00-informe-ejecutivo.md
docs/research/evol-driven-studio/v3.1/01-auditoria-de-consistencia.md
docs/research/evol-driven-studio/v3.1/02-registro-de-decisiones.md
docs/research/evol-driven-studio/v3.1/03-arquitectura-objetivo.md
docs/research/evol-driven-studio/v3.1/04-flujo-multiagente-del-pipeline.md
docs/research/evol-driven-studio/v3.1/05-matriz-de-subagentes.md
docs/research/evol-driven-studio/v3.1/06-model-routing.md
docs/research/evol-driven-studio/v3.1/07-contratos-agentteams.md
docs/research/evol-driven-studio/v3.1/08-contratos-de-memoria-y-workers.md
docs/research/evol-driven-studio/v3.1/09-control-center-modulos.md
docs/research/evol-driven-studio/v3.1/10-inventario-cli-ui.md
docs/research/evol-driven-studio/v3.1/11-modelo-de-seguridad-approval-broker.md
docs/research/evol-driven-studio/v3.1/12-skill-evol-studio-plugin-development.md
docs/research/evol-driven-studio/v3.1/13-plan-tanda-1.md
docs/research/evol-driven-studio/v3.1/14-plan-tanda-2.md
docs/research/evol-driven-studio/v3.1/15-roadmap.md
docs/research/evol-driven-studio/v3.1/16-matriz-de-compatibilidad.md
docs/research/evol-driven-studio/v3.1/17-deuda-y-pendientes.md
docs/research/evol-driven-studio/v3.1/18-archivos-modificados.md
docs/research/evol-driven-studio/v3.1/19-matriz-de-conciliacion-normativa.md
docs/research/evol-driven-studio/v3.1/20-informe-de-resolucion-de-hallazgos.md
docs/research/evol-driven-studio/v3.1/21-contratos-approval-checklist.md
docs/research/evol-driven-studio/v3.1/22-especificacion-repository-explorer.md
docs/research/evol-driven-studio/v3.1/23-EVOL-STUDIO-UI-UX-SYSTEM.md
docs/research/evol-driven-studio/v3.1/24-matriz-de-trazabilidad-de-modificaciones.md
docs/research/evol-driven-studio/v3.1/25-condiciones-y-pruebas-pendientes.md
docs/research/evol-driven-studio/v3.1/26-propuesta-de-commit-y-paquete.md
docs/research/evol-driven-studio/v3.1/27-manifiesto-y-perfiles-dsh.md
docs/research/evol-driven-studio/v3.1/28-enmiendas-normativas.md
docs/research/evol-driven-studio/v3.1/evidence-v3.1.md
docs/research/evol-driven-studio/v3.1/evidence-v3.md
```

**Por qué A:** OD-13 pide versionar la investigación y **preservar la historia**; v3.1 se apoya en v1, v2 y v3 (los referencia y los sustituye punto por punto) y la directiva pide conservarlas como antecedentes. Las rutas se pasan a `git add` explícitamente, de una en una.

**Alternativas** (si se prefiere menos): **B** solo `v3.1/` (los enlaces a v1–v3 quedarían sin destino en el repositorio); **C** `v3.1/` y `v3/` (v1 y v2 quedarían fuera).

## 3. Exclusiones explícitas (no entran en ninguna opción)

Código de producción y cualquier cambio de `src/`, `disciplines/`, `skills/`, `templates/`, `tests/` · `.evol/` (estado, registro de aprobaciones, diario, checkpoints) · memorias (MemPalace, Engram, Mnemon) · credenciales, claves, tokens y `.env*` · perfiles y configuración personal (`~/.config`, `~/.claude`, `~/.local`) · scratchpads y archivos temporales de la sesión · clones de terceros (`dsh`, `at`, `deja-vu`, `ev`) · `docs/code-memory-research/` y su `.zip` (preexistentes, ajenos) · los **ZIP** (`docs/research/evol-driven-studio.zip`, `evol-driven-studio-v2.zip` y el de v3.1: son derivados, ya ignorados o por ignorar) · cualquier cambio de `docs/ESPECIFICACION.md`, `docs/specs/*`, `docs/features/*`, `docs/plan/*` o `CLAUDE.md` (las enmiendas están redactadas en el doc 28, no aplicadas) · `.gitignore` (ver §5).

## 4. Pasos propuestos (no ejecutados)

1. Confirmar la opción (A, B o C).
2. Comprobar que `git status --short` solo muestra `docs/code-memory-research/` y `docs/research/` y que **no hay nada en el índice**.
3. `git add --` con la **lista exacta** de archivos de la opción elegida (una ruta por archivo); **no** `git add .`, **no** `git add docs/research`.
4. Verificar: `git diff --cached --name-only` **igual** a la lista aprobada (comparación automática) y `git diff --cached --stat`; ningún ZIP, ningún archivo de `src/`, ninguna ruta bajo `.evol/`.
5. Escaneo previo de secretos y de datos personales sobre lo preparado (`gitleaks` por el flujo del proyecto, y búsqueda de rutas absolutas y correos).
6. `git commit` con mensaje convencional en español **sin líneas de atribución** a un agente de IA (regla de `CLAUDE.md`):

   ```
   docs: investigación de Evol-Driven Studio hasta la v3.1

   Arquitectura, registro de decisiones OD-01…OD-27, modelo de seguridad
   del Approval Broker (WebAuthn + Ed25519), contratos del Approval
   Checklist, especificación del Repository Explorer, sistema visual,
   conciliación normativa y enmiendas redactadas (no aplicadas).
   Conserva v1, v2 y v3 como antecedentes. Solo documentación.
   ```
7. **No** `git push`: lo decide la persona (norma del repositorio para releases y ramas).
8. Tras el commit: `git status` debe quedar con **solo** `docs/code-memory-research/` sin rastrear (y los ZIP, si no se ignoran).

## 5. Higiene opcional (fuera del commit)

Los ZIP de `docs/research/` quedan **sin rastrear** y sin ignorar, igual que el anterior. Una línea en `.gitignore` (`docs/research/*.zip`) evitaría añadirlos por error; es **un cambio de un archivo del repositorio**, por lo que se propone como commit aparte y solo si se aprueba.

## 6. ZIP documental de la revisión final

| Aspecto | Decisión |
|---|---|
| Contenido | **solo** `v3.1/` (la revisión final), con su carpeta raíz `v3.1/`; v1, v2 y v3 quedan como antecedentes en el repositorio |
| Ruta | `docs/research/evol-driven-studio-v3.1.zip` (sin rastrear; ya existe el patrón de los anteriores) |
| Construcción | `zip -X -r` sobre la carpeta, nombres ordenados; sin atributos extra |
| Integridad | `SHA256SUMS` de cada archivo, calculado antes de comprimir y guardado **fuera** del ZIP; el ZIP se verifica con `unzip -t` y se compara por extracción en un directorio aislado |
| Exclusiones | nada de código, `.evol/`, memorias, credenciales, perfiles, scratchpads ni clones |
| Comprobación de privacidad | sin nombres de usuario, correos, rutas absolutas del equipo ni secretos (búsqueda previa) |
| Estado | ver «Estado de ejecución» al final |

## 7. Estado de ejecución

- **Commit:** **no ejecutado**. Espera la aprobación del alcance (opción A, B o C), del mensaje y de la persona que lo hará.
- **ZIP documental:** **preparado** el 2026-11-17 en `docs/research/evol-driven-studio-v3.1.zip`, con solo la carpeta `v3.1/` (31 archivos), junto a `docs/research/evol-driven-studio-v3.1.SHA256SUMS` (sumas SHA-256 de cada archivo y del propio ZIP). Ambos quedan **sin rastrear** y **fuera del commit** propuesto. El ZIP se verificó con `unzip -t`, se extrajo en un directorio aislado y se comparó byte a byte con la carpeta de origen. La suma del ZIP no puede constar dentro del propio ZIP: está en el archivo de sumas y en la respuesta de entrega.
- **No se hizo:** `git add`, `git commit`, `git push`, cambios en `.gitignore`.

## 8. Qué se necesita de la persona

Elegir A, B o C; aprobar el mensaje; decir si se hace el commit aparte de `.gitignore`; y, cuando quiera, el `git push` (siempre por la persona).
