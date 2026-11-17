# 30 — Runbook de la Tanda 1 en el equipo nuevo (CachyOS recién instalado, con red)

Estado: **guía para que la persona ejecute; no se ha ejecutado nada.** Esta sesión no tiene acceso a ese equipo. Cada paso dice qué se espera y qué pegar de vuelta para revisarlo. Todo va en un perfil aislado; nada toca la configuración personal. Datos de procedencia verificados el 2026-11-17 contra el repositorio y npm (EV-073).

## Reparto de equipos (aclarado por el propietario)

- **Este equipo (desarrollo):** aquí se desarrolla Evol-Driven y Studio y se hacen las pruebas **exploratorias** de la Tanda 1 (Fases 3 a 6) en un perfil y un entorno desechable aislados, sin tocar la configuración personal.
- **Equipo nuevo (instalación):** solo **instala** lo ya probado, desde el manifiesto `studio.lock.json` y artefactos con versión exacta e integridad; ahí se valida lo que solo se puede probar en destino (llave FIDO2, navegador, `udev`, reproducibilidad de la instalación).
- Consecuencia: las Fases 0 a 2 de este runbook valen en ambos; las Fases 3 a 6 se **ejecutan primero aquí** y en el equipo nuevo se repiten solo con el lock ya cerrado (Fase 7).

## Datos verificados que cambian el plan

| Dato | Valor | Efecto |
|---|---|---|
| Etiqueta de DSH | `dsh-v0.2.1-rc.2` = commit **`687f282e8625c6b8d11ff58211a90524be2e4317`** | queda completo el hash de 40 caracteres del manifiesto |
| Requisitos de DSH | `node ^22.19.0 \|\| >=24.0.0`; `pnpm@11.28.5` (campo `packageManager`) | Node 24 sirve para DSH y para Evol |
| Paquete npm de DSH | `@deepseek-ai/dsh@0.2.1-rc.2`, integridad `sha512-tvY+yhfKRifthbqPe/OK0AYxM5ZkvqfYq/jMYgJcEUxiRRL1Vwra3Ti5TB6AXgSWQdiPHYh/Vp6SJa9yHwMNuw==`, binario `dsh` | **el `latest` de npm es 0.2.2-rc.1**: hay que pedir la versión exacta, nunca sin versión |
| Nombre del paquete de AgentTeams | **`@nanmicoder/dsh-agent-teams@0.1.30`** | el README manda instalar con versión exacta y `--save-exact` |
| Perfil y carpeta | `dsh --profile <nombre>` bajo `$DSH_HOME` (por defecto `~/.dsh`) | usar `DSH_HOME` dedicado |
| Instalación de plugins | `dsh plugin --profile <nombre> add --save-exact <paquete>@<versión>` | reinicio del perfil tras instalar |

## Fase −1 — Preflight (solo lectura; se ejecuta en **cada** equipo antes de nada)

Sustituye a las preguntas sueltas sobre el equipo. No instala ni escribe fuera de `~/studio/reports/`. Pega la salida completa; no incluye secretos.

```
mkdir -p ~/studio/reports
{
  echo "== sistema";   . /etc/os-release; echo "$PRETTY_NAME"; uname -srm
  echo "== usuario";   id -un; id -Gn | tr ' ' '\n' | sort | tr '\n' ' '; echo
  echo "== herramientas"
  for c in git node npm pnpm corepack go uv bwrap strace gitleaks python3 curl unzip zip; do
    printf '%s: ' "$c"; (command -v "$c" >/dev/null && "$c" --version 2>&1 | head -1) || echo "NO"; done
  echo "== disco";     df -h ~ | tail -1
  echo "== red (solo cabeceras)"
  for u in https://registry.npmjs.org/ https://github.com/ ; do printf '%s ' "$u"; curl -sI --max-time 15 -o /dev/null -w '%{http_code}\n' "$u" || echo FALLA; done
  echo "== escritura"; test -w ~ && echo "HOME escribible"; mkdir -p ~/studio && echo "~/studio ok"
  echo "== navegador"; for b in chromium google-chrome-stable firefox; do command -v $b >/dev/null && echo "$b: si"; done
  echo "== FIDO2 (solo equipo de instalación)"; ls /dev/hidraw* 2>/dev/null | head -3 || echo "sin hidraw"
} 2>&1 | tee ~/studio/reports/preflight.txt
```

**Criterios (de los requisitos reales, EV-073/EV-074):**

| Comprobación | PASS | BLOCK |
|---|---|---|
| Node | **≥ 24** (Evol `install.sh` y `engines`; DSH admite `^22.19.0 \|\| >=24`) | < 24 para Evol; < 22.19 para DSH |
| pnpm | 11.28.5 (por `corepack`) o instalable | no instalable |
| Red | códigos 200/3xx hacia npm y GitHub | sin red (la Tanda 1 la necesita para descargar) |
| Escritura | `~/studio` escribible | no escribible |
| Aislamiento | `bwrap` y `strace` presentes (o instalables) | ausentes e imposibles de instalar: no hay prueba de instaladores |
| Disco | **registrar**; el umbral se fija tras la primera instalación (tamaño del almacén de pnpm aún no medido) | espacio claramente insuficiente |
| FIDO2 | solo se registra en el equipo de instalación | — |

Resultado: se registra en el informe de handoff. **No se asume nada** que el preflight no haya comprobado.

## Fase 0 — Preparar el sistema (instalar dependencias)

Los nombres de paquete son los habituales de Arch/CachyOS; **compruébalos con `pacman -Si <paquete>` antes de instalar**. Cada `pacman -S` pide `sudo`: lo ejecutas tú.

| Para qué | Paquete probable |
|---|---|
| Git y compilación básica | `git`, `base-devel` |
| Node ≥ 24 y npm | `nodejs`, `npm` (comprobar `node --version` ≥ 24) |
| pnpm fijado | `corepack enable` y `corepack prepare pnpm@11.28.5 --activate` (o `npm i -g pnpm@11.28.5`) |
| Motor Mnemon (Go) | `go` (versión a leer del `go.mod` del motor) |
| Aislamiento y trazas para la prueba de instaladores | `bubblewrap`, `strace` |
| Escaneo de secretos | `gitleaks` |
| Python opcional | `uv` (solo si un plugin lo pide) |
| Llave FIDO2 (Tanda 2, no ahora) | `libfido2` |

Paso 0.1: `node --version`, `git --version`, `pnpm --version`, `go version`. Pega la salida.

## Fase 1 — Evol-Driven en el equipo nuevo

1. Clonar el repositorio: `git clone <origen> ~/Projects/evol-driven` y comprobar que `git log --oneline -3` muestra `20ed7b8` o posterior.
2. Instalar la **copia estable** o el modo `--dev` según `install.sh` del repositorio (la spec: por defecto copia estable firmada; `--dev` deja `evol-dev`). Para la Tanda 1 basta con `--dev` apuntando al origen.
3. `evol doctor` y `evol status`. Pega la salida. **No** ejecutes `evol approve` ni `evol next` desde ningún agente.

## Fase 2 — Directorios y perfil aislado

```
mkdir -p ~/studio/{dsh-home,lock,reports,sandbox}
export DSH_HOME=~/studio/dsh-home
```

No metas `DSH_HOME` en tu `.bashrc` todavía: se exporta solo en las sesiones de la Tanda 1.

## Fase 3 — Instalar DSH con versión exacta e integridad comprobada

1. Instalar en un prefijo propio, **sin `-g`**:
   `npm install --prefix ~/studio/dsh-cli --save-exact @deepseek-ai/dsh@0.2.1-rc.2`
2. Comprobar integridad: `npm ls --prefix ~/studio/dsh-cli @deepseek-ai/dsh` y comparar el `integrity` de `package-lock.json` con el `sha512-tvY+…` de la tabla. **Si no coincide, parar y avisar.**
3. `~/studio/dsh-cli/node_modules/.bin/dsh --version` debe decir `0.2.1-rc.2`.
4. Crear el perfil y arrancarlo sin abrir navegador: `dsh --profile evol-studio web --no-open` (el servidor queda en `http://127.0.0.1:3080`). Parar con Ctrl+C. Pega la salida.

## Fase 4 — AgentTeams 0.1.30

`dsh plugin --profile evol-studio add --save-exact @nanmicoder/dsh-agent-teams@0.1.30`, reiniciar el perfil y comprobar en la interfaz que el plugin figura activo. Prueba C-T1-01: pedir un equipo mínimo (dos miembros, una tarea) y observar estados; C-T1-09: comprobar que un miembro **no puede** lanzar otro. Pega capturas o el texto de los estados.

## Fase 5 — Probar instaladores en entorno desechable (antes de memoria y código)

Para **cada** plugin comunitario (dsh-mnemon, Codebase Memory y su puente, deja-vu), siguiendo el doc 27 §4:

1. `export HOME_DESECHABLE=$(mktemp -d)`; línea base: `find $HOME_DESECHABLE -type f | sort | sha256sum` y lista de las carpetas de configuración de agentes que existan en tu `HOME` real (solo nombres y hash, no contenido).
2. Ejecutar el instalador dentro de `bwrap` con `HOME=$HOME_DESECHABLE`, **sin red** primero (`--unshare-net`) y con `strace -f -e trace=network,openat,execve -o ~/studio/reports/<plugin>.strace`.
3. Repetir con red permitida, solo si el primer intento no la necesita para nada esencial.
4. Comparar con la línea base: archivos creados o cambiados fuera del perfil, procesos que quedan, conexiones intentadas.
5. Veredicto PASS/WARN/BLOCK por plugin; **solo un PASS** (o WARN con la opción segura repetida) permite instalarlo en el perfil `evol-studio`. Pega el informe.

## Fase 6 — Memoria, código, deja-vu en el perfil `evol-studio`

Solo los plugins que pasaron la Fase 5, con versión exacta y hash anotados. Orden: dsh-mnemon + Mnemon (OD-03) → Codebase Memory + puente **sin hooks** → deja-vu con lista cerrada de directorios. Después, C-T1-03…06: red cortada, dos proyectos aislados, procedencia visible, dos proveedores de escritura sin duplicar.

## Fase 7 — Manifiesto y entrega

1. Completar `~/studio/lock/studio.lock.json` con versiones, hashes y licencias (doc 27 §2), incluido el commit completo de DSH de arriba.
2. Prueba de reproducibilidad (C-T1-10): repetir las instalaciones en otro prefijo y comparar árboles.
3. Restauración: copiar `DSH_HOME`, borrarlo y restaurarlo; repetir C-T1-01.
4. Informe de handoff (doc 13 §5) con comando y salida de cada dato.

## Reglas de seguridad durante la tanda

- No instalar nada con `sudo` salvo los paquetes de la Fase 0, y solo los listados.
- No pegar claves, tokens ni el contenido de archivos de configuración de otros agentes: solo nombres, hashes y salidas de los comandos indicados.
- Si algo falla o pide permisos inesperados, **parar** y pegar el mensaje; la propuesta de cambio de baseline (doc 27 §5) la redactamos juntos.
- Los agentes de ese equipo **no** ejecutan `evol approve` ni `evol next`.

## Qué necesito de vuelta, por fase

Salida de 0.1, de `evol doctor`, del `--version` y del `integrity` (Fase 3), estados del equipo mínimo (Fase 4), un informe por plugin (Fase 5), resultados C-T1 (Fase 6) y el `studio.lock.json` (Fase 7). Con eso actualizo la matriz de compatibilidad «probada aquí» y el handoff para la Tanda 2.
