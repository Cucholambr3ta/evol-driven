# Pruebas reales de evol

Preguntas para hacerle a un agente que usa evol en un proyecto de verdad, y así encontrar los problemas que las pruebas
automáticas no ven. Piden **evidencia** (el comando y su salida), no opiniones, para separar los fallos de evol de los del proyecto.

| Archivo                                              | Para quién                                        | Cuándo                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [preguntas-opencode.md](preguntas-opencode.md)       | El agente que **construye** (OpenCode)            | A y B antes de empezar a construir, C durante las primeras tareas, D a F al cerrar la primera fase          |
| [preguntas-claude-code.md](preguntas-claude-code.md) | Claude Code: **arranca** el proyecto y **audita** | Modo 1 al empezar (briefing, spec, plan); modo 2 tras cada traspaso, cuando el constructor termina un turno |

## Cómo se usan

1. Despliega evol en el proyecto (`evol init` o `evol new`, y `evol agents --ide <id>` para cada IDE).
2. Pega al agente las **reglas** del principio de su archivo, y después las preguntas por grupos.
3. Cada problema lo anota el agente con `evol mejora add "qué pasó" --evidencia "comando y salida"`. No corrige el framework.
4. Trae de vuelta: `evol mejora list --json`, `.evol/journal.jsonl` y el último `.evol/checkpoint.md`.
5. Las mejoras se hacen en el repositorio de origen, se publica una versión (`evol-dev release x.y.z`) y se actualiza (`evol update`).

Cuando cambie lo que evol ofrece, se actualizan estas listas: son parte de la versión.
