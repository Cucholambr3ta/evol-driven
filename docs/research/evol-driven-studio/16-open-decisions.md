# 16 — Decisiones abiertas

Ninguna está aprobada. «Decide» = quién debe aprobarla. Todas requieren una persona.

| ID | Decisión | Opciones | Recomendación (no vinculante) | Depende de | Decide |
|---|---|---|---|---|---|
| OD-01 | Arquitectura base | A, B, C, D | A→C (ADR-001) | prototipo Hito 3 | propietario |
| OD-02 | Ubicación del código de integración | monorepo `evol-driven` / repo `evol-studio` separado | repo separado (el núcleo no debe depender de un host pre-release) | — | propietario |
| OD-03 | Memoria conversacional | Mnemon+dsh-mnemon / Engram / MemPalace gobernado | decidir tras el benchmark (ADR-004) | corpus y clave de respuestas aprobados | propietario |
| OD-04 | Cómo se firma una aprobación desde el Control Center | solo TTY / confirmación local con credencial / no soportado | solo TTY al inicio | prueba de que el agente no puede abrir un TTY | propietario + seguridad |
| OD-05 | Motor de código | nativo / CBM adaptador / ambos | ambos con roles distintos (ADR-005) si CBM cumple las condiciones de entrada | benchmark Hito 4 | propietario |
| OD-06 | Desktop en Linux | fork de empaquetado propio / solo web local / posponer | posponer; entregar Plugin Edition sobre `dsh web` | decisión de formato (AppImage/PKGBUILD/Flatpak) | propietario |
| OD-07 | Tareas de ejecución | `team` nativo / AgentTeams | AgentTeams si carga en la versión fijada; si no, `team` (ADR-003) | prueba de compatibilidad | propietario |
| OD-08 | Licencia de Evol-Driven y de la distribución | mantener privado / MIT u otra | definir antes de publicar | asesoría legal | propietario |
| OD-09 | Versión de Harness a fijar | 0.2.1-rc.2 (la que recomienda AgentTeams) / 0.2.2-rc.3 | decidir con la matriz probada | doc 15 | propietario |
| OD-10 | Política de red | lista de permitidos por defecto; ¿se acepta analítica de Harness desactivada? | desactivar por defecto | prueba de red | propietario |
| OD-11 | Modelo de permisos | roles de la propuesta (doc 09) / otros | adoptar los cinco como base | mecanismos reales disponibles | propietario + seguridad |
| OD-12 | Trailer `CA:` en cada commit | obligatorio (incl. merges y herramientas) | ya acordado en el briefing anterior; sigue vigente | hook | propietario |
| OD-13 | ¿Los entregables de investigación se archivan en `docs/` y se versionan? | sí / no | sí, tras revisión | — | propietario |
| OD-14 | Relación con el trabajo previo «memoria de código» | fusionar con este plan / mantener separado | fusionar: es el Hito 4 | — | propietario |

## Preguntas sin resolver por falta de evidencia

- ¿Puede un plugin host de Harness leer `.evol/` sin permitir escribirlo? (prueba del Hito 3).
- ¿Expone dsh-mnemon una API utilizable fuera de Harness? (se usa el CLI de Mnemon si no).
- ¿Qué comportamiento tiene CBM con red cortada y en dos proyectos a la vez? (benchmark).
- ¿Carga AgentTeams 0.1.30 en Harness 0.2.2-rc.3?
- ¿Cuál es la tasa real de falsos positivos del gate «estados de evidencia»? (WARN durante dos semanas).
