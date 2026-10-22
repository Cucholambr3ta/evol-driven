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
