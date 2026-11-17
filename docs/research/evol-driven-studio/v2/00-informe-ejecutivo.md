# 00 — Informe ejecutivo v2: Evol-Driven Studio (baseline arquitectónica)

Ejecución EVOL-STUDIO-ARCH-UPDATE-002 · 2026-11-17 · rama `feat/evol-driven-studio` · base `47a93c8` · **solo documental, sin commits, sin implementación.**

## Estado en cinco líneas

1. La estrategia (integración mínima, reutilización máxima, desarrollo propio solo donde diferencia) es coherente con lo verificado: Evol aporta gobernanza y Harness aporta host, UI, sesiones y equipos. El núcleo no cambia de dueño.
2. Se mantienen **dos máquinas de estados**: fases (Evol) y trabajos (AgentTeams). Una tarea terminada no aprueba una fase.
3. Seis decisiones están **confirmadas por el propietario** (OD-04, 19, 20, 21, 24, 25); las demás son baselines o propuestas **sin ratificar** y así se registran.
4. Hay un **bloqueo real nuevo** que la auditoría de consistencia descubrió: la baseline candidata de Harness (0.2.1-rc.2) **no contiene** la skill `dsh-doc` de runtime en la que se apoya la skill fundacional (EV-035).
5. Nada está implementado ni probado: ninguna combinación de plugins se cargó, ningún benchmark ni prueba de seguridad se ejecutó.

## Consecuencias de la nueva arquitectura

- **Visual-first:** 36 comandos CLI mapeados a módulos del Control Center; una sola lógica para UI, CLI y MCP (doc 10).
- **Autorización humana desde la interfaz** (OD-04) exige un **Approval Broker** separado y un factor de presencia humana que un agente no pueda imitar; un botón, un TTY o una cookie **no bastan** (doc 11).
- **Model Routing** reutiliza lo que DSH y AgentTeams ya ofrecen (modelo/esfuerzo por miembro); su semántica **varía según la versión de Harness** (EV-039).
- **Workers locales y subagentes bajo demanda** evitan sobrecargar al agente principal; el coordinador justifica cada delegación.
- La memoria y el índice de código usan plugins comunitarios, **sin duplicar almacenes**, con aislamiento por controles efectivos y sin red por defecto.

## Dictamen de preparación arquitectónica

| Categoría | Veredicto | Alcance |
|---|---|---|
| **DOCUMENTACIÓN LISTA** | **Sí, para revisión** | Arquitectura, contratos, flujo por fase, matrices, roadmap y planes de las dos tandas están redactados y trazados. Quedan por releer las specs vigentes (`docs/specs/*`, `FEATURES.md`) contra v2 (D-07). |
| **IMPLEMENTACIÓN NO VALIDADA** | **Sí, sin excepciones** | No se ejecutaron pruebas de integración, de seguridad ni benchmarks; ninguna compatibilidad fue probada en nuestro entorno (doc 16). |
| **BLOQUEO DE IMPLEMENTACIÓN** | **Sí, condicional** | **B-01/C-01** bloquea el inicio de Tanda 1 (versión de Harness y origen de la skill de plugins). **B-02…B-04** bloquean H1–H3 hasta cerrar H0. **B-05** bloquea H7 (presencia humana). B-06/B-07 se resuelven con pruebas de Tanda 1. |

**No se emite un PASS general.** Cualquier lectura como «aprobado» sería incorrecta.

## Qué necesita decidir el propietario antes de la Tanda 1

1. **C-01/OD-09:** ¿0.2.2-rc.2 (AgentTeams lo lista como preview), 0.2.1-rc.2 con referencias propias atribuidas, o verificar primero `cordis_inspect_*` en 0.2.1-rc.2?
2. Ratificar o ajustar las baselines OD-01, 02, 03, 05, 06, 07, 08, 09.
3. Ratificar OD-10 a OD-18 y OD-22/23 (hoy propuestas).
4. Elegir el factor de presencia humana del broker (doc 11 §3; recomendación C+B, sin probar).
5. Autorizar el entorno aislado y los experimentos de Tanda 1.
6. Autorizar el commit de esta documentación (OD-13).

## Índice

`evidence-v2.md` · `01-auditoria-de-consistencia` · `02-registro-de-decisiones` · `03-arquitectura-objetivo` · `04-flujo-multiagente-del-pipeline` · `05-matriz-de-subagentes` · `06-model-routing` · `07-contratos-agentteams` · `08-contratos-de-memoria-y-workers` · `09-control-center-modulos` · `10-inventario-cli-ui` · `11-modelo-de-seguridad-approval-broker` · `12-skill-evol-studio-plugin-development` · `13-plan-tanda-1` · `14-plan-tanda-2` · `15-roadmap` · `16-matriz-de-compatibilidad` · `17-deuda-y-pendientes` · `18-archivos-modificados`.

## Límites de esta baseline

Lectura de código y documentación (parcial en los repositorios externos); puntuaciones y estimaciones cualitativas; hechos de comportamiento inferidos de documentos donde se indica; especificaciones vigentes no releídas; seguridad de Harness sin auditar. La numeración normativa de decisiones es la de este registro.
