# evol-driven

Framework de línea de comandos (Node.js / TypeScript) para **crear proyectos TypeScript** que se
desarrollan por un **pipeline de fases con disciplinas Driven Development**, con **memoria
persistente** en [MemPalace](https://github.com/MemPalace/mempalace) y un **indexador de código**.

La especificación completa está en [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md).

## Instalación

Requiere Node ≥ 24 y Git. Ver [`DEPENDENCIES.md`](DEPENDENCIES.md) para MemPalace.

```bash
npm ci && npm run build
npm link            # deja el comando `evol` disponible
evol doctor         # comprueba Node, Git, MemPalace y el proyecto
```

Con Docker (MemPalace no va dentro de la imagen):

```bash
docker build -t evol-driven .
docker run --rm -v "$PWD:/work" -v evol-data:/data evol-driven status
```

Monta siempre un volumen en `/data` (`evol-data` arriba): ahí vive la clave del gate, y sin él se
pierde entre ejecuciones.

## Uso

```bash
evol new mi-app          # crea el proyecto TypeScript (instala dependencias)
cd mi-app
evol status              # fase actual, disciplinas activas y artefactos pendientes
evol approve briefing    # aprobación humana: pide una terminal interactiva
evol next                # avanza si la fase está verificada y aprobada
```

Las plantillas marcan con `[[COMPLETAR]]` lo que falta por escribir: mientras quede un marcador, la
fase no se puede aprobar.

### Adoptar un proyecto que ya existe

```bash
cd mi-proyecto
evol init                                  # un módulo «app» con las 9 disciplinas base
evol init --modulo ventas=modules/ventas:SDD,FDD,TDD --modulo stock=modules/stock:SDD,MDD
evol init --fase build                     # se une a mitad del pipeline (pide una persona)
```

`evol init` **no modifica ningún archivo existente**: solo crea `evol.config.json`, `.evol/` y la
integración con agentes, y añade sus propias entradas a `.gitignore`, `CLAUDE.md`,
`.claude/settings.json` y `.mcp.json` sin tocar lo que ya hay. Antes de escribir nada valida todo;
si falla, no queda nada a medias. Detecta por ti:

- documentos en otra ruta (`SPEC.md`, `FEATURES.md`, `DOMAIN.md`… en la raíz) y los reasigna;
- un comando de pruebas distinto de Vitest (usa `npm test`).

Unirse en una fase avanzada marca las anteriores como **adoptadas** (`~` en `evol status`): hechas antes
de evol, sin aprobación registrada. Por eso exige una terminal interactiva, igual que aprobar.

### Pipeline

`briefing → spec → plan → build → qa → retro`. Para avanzar, una fase necesita **(1)** que las
disciplinas activas de cada módulo verifiquen y **(2)** una aprobación humana vigente.

- `evol approve <fase>` exige una terminal interactiva y que escribas el nombre de la fase. No hay
  opción para saltarlo.
- La aprobación firma (HMAC-SHA256, en cadena) el hash de cada artefacto y de `evol.config.json`: si
  algo cambia después, hay que aprobar de nuevo.
- La clave de la firma está en `~/.config/evol/keys/` (o `$EVOL_CONFIG_DIR`), nunca en el proyecto.
  En otro equipo hay que copiar esa clave para verificar las aprobaciones.

### Disciplinas

31 disciplinas (9 base y 22 extendidas) definidas como datos en [`disciplines/`](disciplines).
Cada módulo de `evol.config.json` elige las suyas y tiene su propia raíz:

```json
{
  "name": "erp",
  "version": 1,
  "codeIntel": "native",
  "memory": { "wing": "erp", "enabled": true },
  "qa": { "requireTestsForChangedSymbols": true },
  "modules": [
    { "name": "ventas", "root": "modules/ventas", "disciplinas": ["SDD", "FDD", "DDD", "TDD"] },
    { "name": "stock", "root": "modules/stock", "disciplinas": ["SDD", "MDD", "SecDD"] }
  ]
}
```

Cada módulo puede reasignar rutas y comandos de sus disciplinas, útil en proyectos que ya tenían su
propia estructura:

```json
{
  "name": "ventas",
  "root": "modules/ventas",
  "disciplinas": ["SDD", "TDD"],
  "rutas": { "docs/specs/SPEC.md": "SPEC.md", "tests/unit/*.test.ts": "src/**/*.test.ts" },
  "comandos": { "TDD": "npm test" }
}
```

Nivel de verificación: **A** (el artefacto existe, no está vacío y su formato es válido) o **B**
(además se ejecuta algo, por ejemplo las pruebas). Se exige el primer artefacto de cada disciplina; los
demás se validan solo si existen. Los experimentos (Chaos, Performance) solo verifican su plan.

### Memoria

```bash
evol memory add --tipo decision --texto "Usamos Postgres con volumen persistente"
evol memory add --tipo leccion --titulo "Probar antes" --texto "..."   # también va a lecciones.md
evol memory search "base de datos"
```

Los eventos del pipeline quedan siempre en `.evol/journal.jsonl`; además van a MemPalace, pero si
MemPalace falla solo se avisa. Los comandos `evol memory` sí fallan si no está disponible.

### Lecciones repetidas entre proyectos

```bash
evol lessons check             # ¿alguna lección de lecciones.md la aprendió ya otro proyecto?
evol lessons check --estricto  # sale con 1 si hay repetidas
evol lessons check --umbral 0.8 --json
```

Busca cada lección de `lecciones.md` en la sala «lecciones» de **todos los demás wings** de MemPalace
y descarta el del propio proyecto. Cuenta como repetida una coincidencia con similitud ≥ 0.7 (ajustable
con `--umbral`). Necesita MemPalace; sin lecciones escritas no lo necesita.

### Agentes (Claude Code, Hermes y cualquier cliente MCP)

`evol new`, `evol init` y `evol agents` dejan en el proyecto lo necesario para que un agente siga el
pipeline (sin pisar archivos propios; se puede repetir cuando quieras):

| Archivo                      | Qué hace                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `.claude/commands/evol-*.md` | `/evol-status`, `/evol-fase`, `/evol-impacto`, `/evol-memoria`                                    |
| `CLAUDE.md` (bloque de evol) | Reglas: aprobar y avanzar es siempre humano; medir el impacto antes de editar; guardar decisiones |
| `.claude/settings.json`      | _Hook_ de inicio de sesión (`evol hook session-start`): estado del pipeline y memoria relevante   |
| `.mcp.json`                  | Registra el servidor `evol mcp`                                                                   |

El servidor **`evol mcp`** es de **solo lectura**: `evol_status`, `evol_verify`, `evol_find_symbol`,
`evol_impact`, `evol_trace`, `evol_index`, `evol_memory_search` y `evol_memory_add`. No ofrece ninguna
herramienta para aprobar, avanzar de fase ni inicializar; eso sigue siendo de una persona en su
terminal. Para Hermes: `hermes mcp add evol --command evol --args mcp` (con `EVOL_PROJECT` o
`--project <carpeta>` si no arranca dentro del proyecto). `evol doctor` comprueba que todo esté.

### Perfiles y disciplinas

```bash
evol new mi-api --perfil api       # también: evol init --perfil erp
evol disciplines profiles          # base, api, web, erp, lib y lo que activa cada uno
evol disciplines list              # las 31 disciplinas y en qué módulos están activas
evol disciplines suggest           # qué activar según tus dependencias y archivos (no cambia nada)
evol disciplines enable BDD TDD --modulo ventas
evol disciplines disable TDD
```

`enable` y `disable` exigen una terminal interactiva y escribir «confirmar»: desactivar una
disciplina afloja el gate, así que lo decide una persona, igual que aprobar. El cambio queda en el
diario. Si la disciplina aplica a una fase que ya estaba aprobada, el pipeline **vuelve a esa fase**
(la configuración es parte de lo que firma una aprobación, así que la anterior deja de valer). Las
fases adoptadas no retroceden: nunca tuvieron aprobación. `--perfil` y `--disciplinas` no se combinan.

### Trazabilidad, riesgo y datos del proyecto

```bash
evol coverage            # matriz criterio CA-n → escenario → prueba, con los huecos
evol coverage --estricto # sale con 1 si algún criterio no tiene escenario o prueba
evol risk --top 10       # archivos por riesgo = alcance transitivo × falta de pruebas
evol export --json       # conjunto de datos con esquema versionado (evol-export/1)
```

Convención de trazabilidad: escribe los criterios del SPEC como `CA-1: …`, etiqueta los escenarios
con `@CA-1` (una etiqueta sobre `Feature:` vale para todos sus escenarios) y pon `CA-1` en el nombre
de la prueba. Con `"qa": { "requireCriteriaCoverage": true }` la fase QA exige cobertura total.

`evol risk` usa el indexador nativo. `evol export` solo incluye conteos, huellas y títulos: nunca la
clave del gate, las firmas ni el contenido de la memoria.

### Indexador de código

```bash
evol index                  # incremental: solo reprocesa lo que cambió
evol impact Base.hello      # qué depende de un símbolo, directa y transitivamente
evol trace main             # cadena de llamadas desde un punto de entrada
```

El grafo (`.evol/codegraph.sqlite`) se deriva del código: se puede borrar y reconstruir. Cubre
TypeScript y JavaScript. Limitación: si solo cambia el cuerpo de una función, los archivos que la
llaman no se reprocesan; si cambia el conjunto de símbolos de un archivo, sí se reprocesan los que lo
importan. `evol index --full` rehace todo.

`"codeIntel": "gitnexus"` usa un GitNexus instalado por el usuario (opcional, licencia no comercial;
ver `DEPENDENCIES.md`). Si no está disponible, falla: nunca cambia de proveedor en silencio.

## Desarrollo

```bash
npm ci
npm run ci      # lint + tipos + formato + build + pruebas
```

Las pruebas de memoria usan un MemPalace real (con un palacio temporal) y se saltan, de forma
visible, si `mempalace-mcp` no está instalado. `EVOL_TEST_DOCKER=1 npm test` también construye la imagen.
