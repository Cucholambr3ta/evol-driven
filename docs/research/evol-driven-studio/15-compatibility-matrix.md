# 15 — Matriz de compatibilidad

Base: `package.json` y READMEs a 2026-11-16. «Declarado» = lo que dice el proyecto; **ninguna combinación se probó** en esta investigación.

## 1. Versiones

| Componente | Versión inspeccionada | Requiere | Declara compatibilidad con Harness | ¿Incluye la 0.2.2-rc.3? |
|---|---|---|---|---|
| deepseek-harness | 0.2.2-rc.3 (`39163dd3`, 2026-11-13) | Node ≥24.9.0, pnpm | — | — |
| dsh-agent-teams | 0.1.30 | Cordis ^4.0.2, `@deepseek-ai/dsh-*` `*` | recomendado 0.2.1-rc.2; «Preview» hasta 0.2.2-rc.2 | **No listada** |
| dsh-mnemon | 0.5.46 | Cordis ^4.0.4, `app-boot` y `typert-protocol` `>=0.2.0-rc.2 <0.2.1-0 \|\| >=0.2.1-rc.1 <0.3.0-0`, React 18 | README: 0.2.2-rc.1 y rangos 0.2.x | **No confirmada** (el rango semver la incluye; README no la nombra) |
| dsh-codebase-memory-mcp | 0.1.10 | Cordis `>=4.0.1-rc.1 <5`, `dsh-*` `>=0.2.0 <0.3.0-0` | README: DSH 0.2.x | rango la incluye; sin confirmar |
| mnemon (motor) | `7313b92` (2026-11-09) | Go 1.24+ para compilar; npm distribuye binarios | independiente de DSH | n/a |
| codebase-memory-mcp | README cita v0.11.0 | binario nativo | independiente | n/a |
| Evol-Driven | 0.5.0 | Node ≥24 | sin integración aún | n/a |
| Engram (si se elige) | 3.6.0 instalado / 3.7.2 publicada | binario Go | independiente | n/a |
| MemPalace | 3.11.0 instalado / 3.12.0 publicada | Python/uv | independiente | n/a |

## 2. Plataformas

| | Linux (Arch) | otras Linux | Windows | macOS |
|---|---|---|---|---|
| Harness CLI/web | Node ≥24.9; sandbox bwrap/Landlock (doc) | igual | soportado (ACL) | soportado |
| Harness Desktop | **sin objetivo de empaquetado** | **sin objetivo** | `win-x64` | `mac-arm64`, `mac-x64` |
| Evol-Driven | desarrollado y probado | probable | **sin probar** | **sin probar** |
| CBM | binarios `linux-amd64/arm64` (+ portable) | idem | sí | sí |
| Mnemon | sí (Go/npm) | sí | sí | sí |
| qmlls (Qt) | sí; necesita build dir | sí | sí | sí |

## 3. Compatibilidad entre complementos

| Par | Estado |
|---|---|
| dsh-mnemon + dsh-agent-teams | no verificado; ambos son plugins de cliente que usan slots |
| dsh-mnemon + dsh-codebase-memory-mcp | no verificado |
| dsh-agent-teams + Harness 0.2.2-rc.3 | no listado por el autor |
| Evol plugin + cualquiera | por construir (Hito 3) |

## 4. Política

Matriz mantenida como archivo versionado; solo las combinaciones marcadas «probada» entran al canal estable. Antes de actualizar Harness se ejecuta el plan del doc 11 §4 sobre la nueva combinación.
