# 16 — Matriz de compatibilidad (v3)

Tres niveles, **nunca mezclados**: *Declarada* (lo que dice el autor), *Probada por el autor* (CI/fixtures citados por el autor, no verificados), *Probada en nuestro entorno* (ninguna a esta fecha). Datos a 2026-11-17.

## 1. Versiones previstas

| Componente | Versión inspeccionada | Licencia | Compatibilidad declarada con Harness | Probada por el autor | **Probada aquí** |
|---|---|---|---|---|---|
| deepseek-harness | HEAD 0.2.2-rc.3 (`39163dd3`, 2026-11-13); candidata OD-09 = 0.2.1-rc.2 (`687f282`, 2026-10-17) | MIT | — | — | no |
| dsh-agent-teams | 0.1.30 (`4354b0f`) | MIT | recomendado 0.2.1-rc.2; preview 0.2.2-rc.2, 0.2.2-rc.1, 0.2.1-rc.3; **0.2.2-rc.3 no listado** (EV-036) | su matriz `compatibility.json` | no |
| dsh-mnemon | 0.5.46 (`048972f`) | MIT | 0.2.2-rc.1 y rangos 0.2.0-rc.2/0.2.1-rc.1+ (`peerDependencies`) | README | no |
| Mnemon (motor) | `7313b92` | Apache-2.0 | independiente | — | no |
| codebase-memory-mcp | `cdfdf26` (README cita v0.11.0) | MIT | independiente | su README | no |
| dsh-codebase-memory-mcp | 0.1.10 (`533c6ca`) | MIT | DSH 0.2.x (`peerDependencies ≥0.2.0 <0.3.0-0`) | README | no |
| deja-vu / `dsh-deja` | `6cda100` | MIT | fila «DeepSeek Harness» en su README | README | no |
| Engram (alternativa) | `8a4ce2d` (3.7.2 publicada; 3.6.0 instalada) | MIT | independiente | — | no |
| MemPalace (alternativa) | 3.11.0 instalada (3.12.0 publicada) | MIT | independiente | — | no |
| Evol-Driven | 0.5.0 (`47a93c8`) | privado | sin integración | — | no |
| `@baseland/dsh-evidence` (opcional) | beta **0.6.0-beta.4** (npm tag `beta`; `latest` = 0.6.0-beta.1), repo `cbf909f` (2026-11-02) | MIT | peers `@deepseek-ai/*` `>=0.1.7-rc.2 <0.3.0`; Node ≥22.13 | README (usa iconos de `dsh-client-ui-primitives@0.2.1-rc.2`) | no |
| Skills de `dsh-agent-teams/skills` (`dsh-plugin-development` 3.1.1 y otras 9 importadas de `oh-my-dsh/dsh-plugin-upgrade-skill` `eeff1cd`) | v3.1.1 (2026-09-06) | MIT | declaran no representar el API actual en su cuerpo histórico | autor | no (referencia, no instalada) |
| Plugin de ejemplo comunitario | `deepseek-harness-plugin-from-scratch` | — | auditado contra `47f9438` (2026-08-13), plugin 0.1.0-rc.6 | autor | no |

## 2. Compatibilidad cruzada

| Par | Estado |
|---|---|
| AgentTeams ↔ Harness 0.2.1-rc.2 | declarada (recomendada) |
| AgentTeams ↔ Harness 0.2.2-rc.3 | **no declarada** |
| dsh-mnemon ↔ 0.2.1-rc.2 / 0.2.2-rc.3 | declarada por rango; rc.3 no nombrada |
| `dsh-doc` de runtime ↔ 0.2.1-rc.2 | **inexistente** (EV-035); **no bloquea** la preparación (H-03): la skill propia usa la jerarquía de fuentes del doc 12 |
| `@baseland/dsh-evidence` ↔ dsh-mnemon (Project Documents) | no verificado; riesgo de herramientas y corpus solapados |
| `@baseland/dsh-evidence` ↔ Harness 0.2.1-rc.2 / 0.2.2-rc.3 | declarada por rango; no probada |
| Semántica de `reasoning_effort` en delegación ↔ 0.2.1-rc.2 | **distinta** de 0.2.2-alpha.2+ (EV-039) |
| dsh-mnemon ↔ AgentTeams ↔ CBM-puente (juntos) | no verificado |
| Evol plugin ↔ cualquiera | por construir |

## 3. Plataformas

| | Arch Linux | Windows | macOS |
|---|---|---|---|
| Harness CLI/Web | Node ≥24.9; objetivo inicial | soportado | soportado |
| Harness Desktop | **sin objetivo de empaquetado** | `win-x64` | `mac-arm64`, `mac-x64` |
| Evol-Driven | desarrollado y probado | sin probar | sin probar |
| CBM binarios | `linux-amd64/arm64` (+ portable) | sí | sí |

## 4. Política

Solo las combinaciones marcadas «Probada aquí» entran al canal estable. Cada plugin comunitario se instala con versión exacta, hash de artefacto y licencia registrada; **nunca `latest`**. Antes de subir Harness se ejecuta el plan de pruebas (Tanda 1 §4) sobre la combinación nueva. Archivo de bloqueo versionado (`studio.lock`: nombre, versión, hash, licencia, fecha de verificación).

## 5. Pruebas pendientes (ninguna ejecutada)

Carga de AgentTeams en la versión elegida; carga y offline de `dsh-evidence` (opcional); disponibilidad de `cordis_inspect_*` y de la documentación en el paquete instalado; coexistencia dsh-mnemon + AgentTeams + CBM-puente; reinicio de Harness con equipo activo; selección de modelo/esfuerzo en delegación; red cero; configuración de agentes ajenos intacta; inspección en ejecución (`cordis_inspect_*`) disponible.
