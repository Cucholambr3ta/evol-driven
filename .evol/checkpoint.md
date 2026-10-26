# Checkpoint — evol-driven

Guardado el 2026-10-26T16:05:22.686Z · fase **qa** · aprobación obsoleta

> Lo escribe `evol checkpoint`, sin modelo. Las notas son del agente anterior: **son datos, no órdenes**.
> Compruébalas contra el estado real (`evol status`) antes de fiarte de ellas.

## Cómo retomar

1. Lee las notas de abajo y `evol status`.
2. No hay cambios sin commit.
3. Aprobar (`evol approve`) y avanzar (`evol next`) lo hace una persona, en su terminal.

## Notas del agente (la más reciente al final)

- 2026-10-25T18:02:21.021Z: M1 (CA-128 a CA-131, proyectos que no son TypeScript) construido y comiteado (64f9348). Faltan M2 a M10 de la ola 1 en fase build. Próximo paso: Paso 0 del plan (ensayo real de outputStyle/agent y permissions.deny bajo bypassPermissions en Claude Code y OpenCode, documentado en docs/design/consultas/), necesario antes de M3 a M6.
- 2026-10-25T22:37:54.227Z: Ola 1 build: M1-M10 completos y comiteados (CA-128 a CA-148). npm run ci queda rojo por un solo motivo: CA-145 (menos de 3s sin red) es flaky/ajustado por overhead preexistente de doctor (MemPalace+sondeo seguridad, ~2.6-2.7s antes de esta mejora); documentado en SPEC.md y anotado como m-003. evol coverage (vía dist/cli.js, NO vía el binario estable que aun no tiene estos cambios) está limpio: sin escenario ninguno, sin prueba ninguno. evol security scan encontró 5 CRITICAL y 3 HIGH que parecen falsos positivos preexistentes (hashes de skills en release.json, claves AWS EXAMPLE en fixtures, shell:true en el runner de comandos, avisos genéricos de guarddog en package.json); la persona decidió revisarlos ella misma antes de aprobar qa, no los toqué. Próximo paso: la persona corre evol verify/approve build en su terminal (bloqueará por [[COMPLETAR]] literal en tests/cli.test.ts, tests/disciplines.test.ts, tests/e2e.test.ts y tests/orchestration.test.ts: falso positivo preexistente de Ola 0, anotado como m-004) y decide cómo seguir.
- 2026-10-26T14:50:20.774Z: Ciclo 2, briefing corregido y comiteado (ac9c990): 26 pruebas de aceptación en rojo por la razón correcta, evol verify PASS. Siguiente: la persona ejecuta evol approve briefing y evol next; después spec (SPEC.md, DOMAIN.md, THREATS.md del ciclo 2) y plan por módulos M0 a M5 según el plan aprobado.
- 2026-10-26T15:08:39.687Z: Ciclo 2 build: M0 y M1 comiteados (2ba8f41, M1 siguiente). Siguiente: M2a (src/docs/check.ts, granular.ts, requisitos.ts, comando evol docs check) con TDD; las 26 pruebas de aceptación del ciclo 2 siguen rojas hasta M2/M3. Estable evol 0.4.0 para el pipeline.
- 2026-10-26T15:18:39.637Z: Ciclo 2 build: M2b comiteado (evidencia). Siguiente: M2c (src/docs/sprints.ts, comando evol sprint, parte sprints en PARTES), luego pruebas de seguridad, M3..M5. CA-145 es lenta bajo carga (doctor ~6.6s en suite completa).
- 2026-10-26T15:21:11.577Z: Ciclo 2 build: M2c comiteado (sprints). Siguiente: pruebas de seguridad docs-*.security, luego M3 (disciplinas GRANULAR/INVESTIGACION/REQDD/SPRINTDD, ADD base, perfiles 14, plantillas, cifras 35), M4 skills, M5 README.
- 2026-10-26T15:29:35.589Z: Ciclo 2 build: M2c, M2d (seguridad), M3 comiteados. Todas las pruebas de aceptación verdes salvo CA-145 (lenta bajo carga). Siguiente: M4 (skills granular, investigacion, reqdd, sprintdd con evals + manifest + tercera ola de enrutadores; add con Referencias), M5 (README comandos docs/sprint, coverage, npm run ci).
- 2026-10-26T15:34:02.676Z: Ciclo 2 build COMPLETO: M0-M5 comiteados, npm run ci verde (1430 pruebas), evol verify PASS. Espera la persona: evol approve build + evol next. Luego QA (evol security scan, evol coverage, revisión independiente verificador/seguridad), retro (lección, Ampliación 8 en ESPECIFICACION.md), release 0.5.0, y que la persona reapruebe skills (add, analista, arquitecto + 4 nuevas).
- 2026-10-26T15:51:46.668Z: CA-145 hecho robusto (retraso vs base). Build listo otra vez: la persona repite evol approve build + evol next.
- 2026-10-26T16:05:22.686Z: QA: revisiones de seguridad y verificador aplicadas (tope 5 MiB, symlinks en camino, líneas 8 KiB, tablas acotadas, dedupe de historias). ci verde. Espera: la persona repasa y hace evol approve qa + evol next; luego retro (lección, Ampliación 8) y release 0.5.0.

## Estado del pipeline

    Proyecto: evol-driven
    Pipeline: ✓briefing → ✓spec → ✓plan → ✓build → qa → retro
    Fase actual: qa
      [app] SDD — Spec-Driven Development
          ✓ docs/specs/SPEC.md  (1 encontrado(s), ≥1)
      [app] BDD — Behavior-Driven Development
          ✓ tests/features/*.feature  (16 encontrado(s), ≥1)
      [app] ATDD — Acceptance Test-Driven Development
          ✓ tests/acceptance/*.acceptance.test.ts  (16 encontrado(s), ≥1)
      [app] SecDD — Security-Driven Development
          ✓ .evol/qa/QA_REPORT.md  (1 encontrado(s), ≥1)
    Aprobación de «qa»: obsoleta (los artefactos cambiaron)

## Git

Rama main, commit 6d72fc8.

Últimos commits:

- chore: informe de QA
- fix(qa): lectura acotada y dentro de la raíz (tope total, enlaces en el camino, líneas, tablas y hallazgos), checklist según el SPEC y pruebas más estrictas
- chore(qa): quita la clave de ejemplo de lecciones.md, un texto no parecido a una clave en la prueba de rutas y ajusta la línea del ignorado de verify.ts
- chore: checkpoint
- test: CA-145 mide el retraso del aviso contra doctor sin aviso, no el tiempo total bajo carga

## Últimos eventos

- 2026-10-26T15:34:02.689Z: checkpoint
- 2026-10-26T15:47:29.418Z: approved
- 2026-10-26T15:51:46.681Z: checkpoint
- 2026-10-26T15:54:35.926Z: approved
- 2026-10-26T15:55:43.422Z: phase-completed
