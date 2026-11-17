# 14 — Registro de riesgos

Prioridad: P0 bloquea la liberación · P1 antes de la edición estable · P2 vigilar. Probabilidad/impacto: B/M/A (juicio, no medición).

| ID | Riesgo | Prob. | Imp. | Prio | Evidencia | Mitigación | Dueño de la decisión |
|---|---|---|---|---|---|---|---|
| R-01 | Harness es pre-release, APIs «pre-stable» y sin auditoría de seguridad | A | A | P0 | EV-015 | versiones fijadas, matriz de compatibilidad, no basar la autoridad en él, pruebas de red/permisos | propietario |
| R-02 | Estado no conciliado con el registro firmado (salto de fase) | M | A | P0 | EV-006 | verificación estado↔log; firmar estado | Hito 1 |
| R-03 | Herramientas MCP de escritura sin anotar | A | M | P0 | EV-004 | separar lectura/escritura, gate por rol | Hito 1 |
| R-04 | Consultas del grafo escriben | A | M | P1 | EV-003 | modo readonly | Hito 1 |
| R-05 | Agentes escriben `.evol/` a la vez | M | A | P0 | EV-007 | lock de proyecto | Hito 1 |
| R-06 | Cobertura por referencia tomada como cumplimiento | A | A | P0 | EV-011, RF | estados de evidencia, revisor independiente | Hito 1/6 |
| R-07 | No hay objetivo de empaquetado Linux en el Desktop | A | A | P1 | EV-018 | Plugin Edition primero; ADR para Linux | OD-06 |
| R-08 | AgentTeams no listado para Harness 0.2.2-rc.3; un solo mantenedor | M | M | P1 | EV-022 | fijar versión; alternativa `team` nativo | Hito 6 |
| R-09 | CBM: instalador toca configuración de agentes; daemon compartido; actualización por script | M | A | P0 para adoptar CBM | EV-027 | instalación manual sin hooks, aislamiento demostrado, red cortada | Hito 4 |
| R-10 | Soporte semántico real de QML/CMake inexistente en las herramientas revisadas | A | M | P1 | EV-026 | declararlo; T0+parser+texto; qmlls solo si hay build dir | Hito 4 |
| R-11 | Memoria «LLM-supervised» guarda lo que el agente decide (calidad variable, inyección persistente) | M | A | P1 | EV-023 | fuente y estado obligatorios, filtro de secretos, revisión | Hito 4 |
| R-12 | Dos almacenes de memoria activos (MemPalace y Engram) y 3 wings del mismo proyecto | A | M | P1 | EV-012/013 | un proveedor por ámbito; normalización con migración aprobada | OD-03 |
| R-13 | Conexiones salientes no declaradas (analítica, actualizaciones) | M | A | P0 | EV-021, 025 | lista de permitidos, prueba de red, desactivar analítica | Hito 9 |
| R-14 | Evol-Driven con licencia privada limita distribución comercial | M | M | P1 | EV-001 | definir licencia antes de publicar | OD-08 |
| R-15 | Duplicar tareas (tablero propio + AgentTeams) | M | M | P1 | EV-008 | no construir tablero en Evol | ADR-003 |
| R-16 | Auto-hospedaje: el verificador se verifica a sí mismo | M | M | P1 | lección CA-146 | `verifier_version`; correr ambos binarios | Hito 1 |
| R-17 | Sobreingeniería (plugins, microservicios, base vectorial) | A | M | P2 | — | CLI→core→MCP; sin HTTP; vectorial solo con evidencia | continuo |
| R-18 | Resultados de benchmarks tomados del autor | M | M | P1 | EV-026 | reproducir antes de adoptar | Hito 0/4 |
| R-19 | Procesos que sobreviven al host (daemons) | M | M | P1 | EV-027 | registro de PIDs y prueba de cierre | Hito 9 |
| R-20 | Datos personales o claves empaquetados por error | B | A | P0 | — | escaneo de secretos del paquete, lista de archivos permitidos | Hito 7 |
| R-21 | Patrón histórico de reapertura de QA (hasta 4 rondas) | M | M | P2 | EV-014 | tope de 2 rondas por hallazgo, verificador independiente | gobernanza |

## Bloqueos duros para liberar

R-01 (mitigado, no eliminado), R-02, R-03, R-05, R-06, R-13 y R-20 deben estar cerrados con evidencia ejecutada.
