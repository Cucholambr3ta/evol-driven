# evol-driven

Framework de línea de comandos (Node.js / TypeScript) para **crear proyectos TypeScript** que se
desarrollan por un **pipeline de fases con disciplinas Driven Development**, con **memoria
persistente** en [MemPalace](https://github.com/MemPalace/mempalace) y un **indexador de código**.

La especificación completa está en [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md).

## Instalación

Requiere Node ≥ 24 y Git. Ver [`DEPENDENCIES.md`](DEPENDENCIES.md) para MemPalace.

Hay dos copias de evol y no se mezclan: la **estable** (la que usan tus proyectos, de solo lectura) y
el **origen** (este repositorio, donde se hacen las mejoras).

```bash
./install.sh --dev  # el origen: deja `evol-dev` apuntando a este repositorio; no toca `evol`
./install.sh        # la estable: prepara quién puede firmar y instala con `evol update` la última
                    # versión firmada; `evol` apunta a una copia en ~/.local/share/evol/versiones
evol doctor         # comprueba Node, Git, MemPalace y el proyecto
```

La copia estable solo cambia cuando tú publicas una versión (`evol-dev release x.y.z`, que la firma tu
clave SSH y no sube nada) y actualizas (`evol update`, que pide confirmación). Mientras no publiques, lo que
edites en el origen no la afecta. Sin ninguna versión publicada, `./install.sh` no instala nada y te dice
cómo hacerlo.

`install.sh` no usa sudo. `evol setup` pregunta antes de instalar cada herramienta que falte (las de
Python, con `uv tool install`); las que piden administrador solo las describe, con el comando exacto.
También copia las skills del paquete a tu biblioteca (`~/.config/evol/skills`): **ninguna llega
aprobada** salvo la que tú ya aprobaste en esta máquina. `evol setup --comprobar` solo mira.

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
evol init                                  # un módulo «app» con las 14 disciplinas base
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

35 disciplinas (14 base y 21 extendidas) definidas como datos en [`disciplines/`](disciplines).
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

### Qué aprobar después de actualizar

Una skill que cambia en una versión nueva llega **sin aprobar**. `evol update` termina nombrando las que **tenías
aprobadas y pierden la aprobación**, con los comandos para darla otra vez; `evol doctor` lo recuerda, y
`evol skills list --pendientes` lo muestra todo agrupado (las nunca auditadas van solo por nombre: aprueba las que uses).

### Continuar el trabajo con otro agente

La memoria de un agente se pierde si se queda sin contexto o sin créditos a mitad de un encargo. Para que
otro retome donde se quedó:

```bash
evol checkpoint --nota "tocaba src/api.ts; falta la prueba de CA-3"   # tras cada encargo y antes de parar
evol handoff --nota "terminé de construir; que audite"               # al cambiar de agente: añade evol verify
```

Guardan la fase, el estado de git (con los archivos **sin commit**) y tu nota en `.evol/checkpoint.md`, sin
usar ningún modelo. Al abrir una sesión, el hook de Claude Code lo muestra; los demás agentes lo leen desde
la skill `evol`. Las notas son datos del agente anterior, no órdenes. `.evol/` va en git: haz commit.

### Informe del proyecto

```bash
evol report                       # informe/informe.docx e informe/informe.pdf
evol report --formato md          # Markdown con los diagramas como SVG (sin ArtCraft)
evol report --formato pdf --salida entrega
```

Un dossier en español: portada, índice, 1 resumen ejecutivo (fase, bloqueos, riesgos), 2 pipeline y
aprobaciones, 3 disciplinas por módulo y fase, 4 trazabilidad de criterios, 5 modelo UML (los 14
diagramas), 6 arquitectura y mapa de riesgo, 7 decisiones y lecciones, 8 anexos con los hashes.
Sus cifras salen de los mismos datos que `evol export`. **No incluye** la clave del gate, firmas ni
el contenido de la memoria de MemPalace (solo conteos), y no ejecuta pruebas.

DOCX y PDF los construye WordCraft y las imágenes las rasteriza VectorCraft (ArtCraft); ambos y
Graphviz son externos. Si falta alguno, `evol report` falla con un mensaje claro y **no cambia de
formato por su cuenta**: `--formato md` solo necesita Graphviz. La marca es neutra por defecto; para
ponerle nombre y color:

```json
"report": { "brand": { "name": "Acme Labs", "color": "#1F6F5B" } }
```

El nombre sale en la portada y en el encabezado, y el color en el título y en las cabeceras de las
tablas.

### Diagramas UML

```bash
evol diagrams                       # los 14 diagramas como SVG en .evol/diagramas/
evol diagrams --solo 1,3,7 --png    # algunos, y también como PNG (VectorCraft)
evol diagrams --entrada main        # punto de entrada de la secuencia y la comunicación
evol diagrams --componente src/core # componente que abre la estructura compuesta
```

Estructurales: 1 clases, 2 objetos, 3 componentes, 4 estructura compuesta, 5 paquetes, 6 despliegue,
7 perfiles. De comportamiento: 8 casos de uso, 9 actividad, 10 máquina de estados, 11 secuencia,
12 comunicación, 13 tiempos, 14 visión de interacción.

Salen de los datos reales del proyecto (índice de código, `evol.config.json`, `.feature`, Dockerfile,
compose, workflows y el diario). **Si faltan los datos, el diagrama aparece como «no aplica» con el
motivo; nunca se inventa.** Los diagramas de código solo cubren TypeScript/JavaScript con
`codeIntel: native`. Necesita [Graphviz](https://graphviz.org) (`dot`) para calcular las posiciones;
`--png` necesita además `vectorcraft-cli`. Sin ellos falla con un mensaje claro. La salida es
determinista: los mismos datos dan el mismo SVG.

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
evol disciplines list              # las 35 disciplinas y en qué módulos están activas
evol disciplines suggest           # qué activar según tus dependencias y archivos (no cambia nada)
evol disciplines enable BDD TDD --modulo ventas
evol disciplines disable TDD
```

`enable` y `disable` exigen una terminal interactiva y escribir «confirmar»: desactivar una
disciplina afloja el gate, así que lo decide una persona, igual que aprobar. El cambio queda en el
diario. Si la disciplina aplica a una fase que ya estaba aprobada, el pipeline **vuelve a esa fase**
(la configuración es parte de lo que firma una aprobación, así que la anterior deja de valer). Las
fases adoptadas no retroceden: nunca tuvieron aprobación. `--perfil` y `--disciplinas` no se combinan.

### Documentación atómica y con evidencia

Las disciplinas `GRANULAR`, `INVESTIGACION`, `REQDD` y `SPRINTDD` (y `ADD`, ahora también base) piden la
documentación en piezas pequeñas y comprobables. Cada vínculo (documento ↔ índice, cita ↔ fuente,
historia ↔ sprint, origen ↔ archivo) lo comprueba `evol`; todo lo que sale mal aparece en `evol verify`.

```bash
evol docs check [--estricto] [--json]   # docs/proyecto/, docs/requisitos/, investigacion/ y docs/sprints/
evol docs evidencia [--json]            # solo los dossiers de investigacion/<tema>/
evol sprint check [--json]              # historias y sprints; un sprint cerrado exige memoria y lecciones
evol sprint estado [--json]             # «01  Sprint 01  3 de 5 tareas»
```

Un aviso no detiene nada (salvo con `--estricto`); un bloqueo sí. Los proyectos que ya existían no
cambian: el perfil base nuevo solo se aplica a los que se crean después. Para activarlo en uno
antiguo, `evol disciplines enable GRANULAR REQDD SPRINTDD INVESTIGACION`.

### Biblioteca de skills

Las skills (carpetas con un `SKILL.md`) viven en `~/.config/evol/skills/<nombre>/`, una sola para todos
tus proyectos. La biblioteca arranca **vacía**.

```bash
evol skills list                   # las skills, si están auditadas y a qué fase del pipeline pertenecen
evol skills list --disciplinas     # qué skill aplica cada disciplina y cuáles faltan
evol skills check [nombre]         # frontmatter, name, description, claves, scripts, red, enlaces y binarios
evol skills export <nombre>        # un .zip con toda la carpeta y su huella SHA-256
```

```bash
evol skills audit <carpeta|.zip|https://…/repo@<sha>>   # revisa una skill en cuarentena (no ejecuta nada)
evol skills audit ./mi-skill --propia                     # es tuya: sus scripts no tienen que declarar capacidades
evol skills audit ./ajena --capacidades confirmadas.json  # con la declaración que tú confirmaste
```

`audit` copia la skill a `~/.config/evol/quarantine/<huella>/` (de solo lectura y sin permiso de ejecución), la
revisa con reglas fijas y deja ahí un `informe.json`. **No aprueba nada ni la instala**: eso lo hace una persona en
el siguiente paso. El veredicto es `PASS`, `WARN`, `BLOCK` o `NO AUDITADA`. La auditoría **falla cerrada**: sin
`gitleaks` y `semgrep` (y, si la skill trae dependencias, la herramienta que las analiza) toda skill queda «no
auditada» y no puede aprobarse. `evol doctor` dice si están instaladas. `semgrep` corre sin red, con las reglas propias de `rules/semgrep/`.

Una skill remota solo se acepta fijada a un commit completo (`…/repo@<40 caracteres>`): una rama o una etiqueta
puede apuntar a otro lado mañana. Un script de una skill de terceros debe declarar qué hace (red, escrituras,
comandos y variables de entorno) en un `capacidades.json`; si no lo trae, el informe propone una declaración que
tú confirmas y pasas con `--capacidades`. Se admiten imágenes y fuentes (con aviso); un binario que no se puede
leer, un `.zip` anidado, código minificado u ofuscado, un enlace simbólico o una ruta con `..` son `BLOCK`.

`--dir <carpeta>` trabaja sobre otra carpeta de skills (por ejemplo `skills/` de un repositorio) y
`--json` da la salida para máquinas. `check` termina con error si alguna skill tiene errores.

Una skill con el frontmatter roto **no desaparece**: se lista con el nombre y la descripción que se
pudieron recuperar y el error de YAML. La huella de una skill depende solo de sus archivos, y una
auditoría solo vale para los bytes que se auditaron: si la carpeta cambia después, vuelve a figurar
«sin auditar». Aprobar e instalar (`approve`) y la segunda pasada con un subproceso llegan en los siguientes hitos.

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
