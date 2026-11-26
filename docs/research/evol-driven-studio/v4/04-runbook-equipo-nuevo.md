# 04: Runbook del equipo nuevo (sin evol instalado)

Sustituye al reparto de equipos del v3.1 doc 30. **Cambio decidido por el propietario el 2026-11-26: la integración se hace en el equipo nuevo**, no solo la instalación. Las Fases −1, 0 y 5 del doc 30 siguen valiendo tal cual: se citan sin copiarlas.

Convenciones:
- 🧑 lo ejecuta la persona;
- 🤖 lo puede ejecutar el agente;
- ⛔ no lo ejecuta nunca un agente.

## Paso 0: antes de salir del equipo de desarrollo (🧑, aquí)

| # | Acción | Por qué |
|---|---|---|
| 0.1 | Commit de `evidence-v3.1.md` (EV-075 a EV-078) y de esta carpeta `v4/`; decidir qué hacer con `docs/code-memory-research/` (sin versionar) | Si no está en git, no llega |
| 0.2 | ⛔ **`git push -u origin feat/evol-driven-studio`** | La rama no existe en el remoto (EV-090): el equipo nuevo no vería la investigación |
| 0.3 | Prototipo: escaneo de secretos, decisión sobre la credencial potencialmente expuesta (EV-088), `.gitignore`, primer commit, remoto privado y push (doc 03) | Hoy no tiene commits |
| 0.4 | Decidir **D3** (doc 05): copiar la clave del gate o empezar un registro nuevo | Sin la clave no se puede aprobar (EV-091) |
| 0.5 | Exportar lo que no viaja con git: buzón de mejoras (`~/.config/evol/mejoras/buzon.jsonl`), la **clave pública** de firma de versiones (`~/.config/evol/allowed_signers`, es pública) y, si se quiere conservar, la memoria MemPalace del wing `evol_driven` | Todo vive en `~/.config/evol` o en el palacio local |
| 0.6 | `~/studio/lock/studio.lock.json` (si existe) e informes de `~/studio/reports/` → copiarlos al repositorio, en `docs/research/evol-driven-studio/v4/tanda1/` | Son la evidencia de la Tanda 1 parcial |

**No se copian:** `~/.dsh` (personal), credenciales de proveedores de modelos, `~/.config/evol/keys/*` por canales que vea un agente, ni configuración de otros agentes.

## Paso 1: preflight y sistema (🧑)

- Fase −1 del v3.1 doc 30 (preflight de solo lectura), que deja `~/studio/reports/preflight.txt`.
- Fase 0 del doc 30: `git`, `base-devel`, `nodejs` ≥ 24, `npm`, pnpm **11.28.5** (`corepack`), `go`, `bubblewrap`, `strace`, `gitleaks`, `python3` y `uv`.
- Para evol, además: `uv tool install mempalace` (memoria de este repositorio) y, si se usa QA completo, `uv tool install semgrep==1.182.0`. **Ojo con m-016:** no definas `SEMGREP_ENABLE_VERSION_CHECK`.

## Paso 2: Evol-Driven (🧑 instala; 🤖 comprueba)

```bash
git clone git@github.com:Cucholambr3ta/evol-driven.git ~/Projects/evol-driven
cd ~/Projects/evol-driven && git switch feat/evol-driven-studio
git log --oneline -4          # debe incluir 25b64a0 y el commit del Paso 0.1
```

Dos modos (`install.sh`):

| Modo | Comando | Cuándo |
|---|---|---|
| **Estable** (recomendado para el pipeline) | `./install.sh`: compila, `evol setup` y `evol update` desde la última etiqueta **firmada** (`v0.5.0`). Necesita la clave **pública** de firma en `allowed_signers` (Paso 0.5) | Para que el pipeline lo verifique siempre la misma versión (regla de `CLAUDE.md`) |
| Desarrollo | `./install.sh --dev`, que deja `evol-dev` apuntando al clon | Para editar el núcleo (H0); los cambios en `gate.ts`, `verify.ts` y `coverage.ts` se prueban con `evol` **y** con `evol-dev` |

Lo normal es instalar **los dos**. Después:

```bash
evol --version && evol version --json     # 0.5.0, canal estable
evol doctor                               # todo ✓ salvo lo opcional
evol status && evol verify --inicio       # briefing del ciclo 3
npm ci && npm run ci                      # 🤖: CI verde en el equipo nuevo (si falla CA-145, ver la lección «tiempo absoluto bajo carga»)
evol agents --ide <ide>                   # 🤖 si el IDE no es Claude Code; en OpenCode, bloqueo y MCP a mano en opencode.json
```

**Clave del gate** (solo si D3 = copiar): 🧑 copia `~/.config/evol/keys/<projectId>` (el `projectId` está en `.evol/state.json`) con `chmod 600`, por un medio que no pase por ningún agente. Comprueba con `evol doctor`. ⛔ Ningún agente lee, imprime ni mueve ese archivo.

## Paso 3: entorno DSH aislado (🧑 instala; 🤖 comprueba)

```bash
mkdir -p ~/studio/{dsh-home,agents-home,lock,reports,sandbox,tools,pnpm-store}
cat > ~/studio/env.sh <<'EOF'
# Entorno de Studio. Se carga con: source ~/studio/env.sh (no va al .bashrc)
export DSH_HOME="$HOME/studio/dsh-home"
export DSH_AGENTS_HOME="$HOME/studio/agents-home"
export pnpm_config_store_dir="$HOME/studio/pnpm-store"    # npm_config_store_dir NO sirve en pnpm 11 (EV-076)
export PATH="$HOME/studio/dsh-cli/node_modules/.bin:$PATH"
EOF
source ~/studio/env.sh
npm install --prefix ~/studio/dsh-cli --save-exact --ignore-scripts @deepseek-ai/dsh@0.2.1-rc.2
grep -A2 '"node_modules/@deepseek-ai/dsh"' ~/studio/dsh-cli/package-lock.json | grep integrity
#   debe ser sha512-tvY+yhfKRifthbqPe/OK0AYxM5ZkvqfYq/jMYgJcEUxiRRL1Vwra3Ti5TB6AXgSWQdiPHYh/Vp6SJa9yHwMNuw==  ← si no, PARAR
dsh --version                                        # 0.2.1-rc.2
dsh --profile evol-studio --from-default-profile web --no-open   # SOLO la primera vez; luego, nunca más (reemplaza el perfil)
dsh plugin --profile evol-studio add --save-exact @nanmicoder/dsh-agent-teams@0.1.30
```

- **No** instales DSH con `-g` ni con mise: así no se mezcla con un `dsh` global (EV-089). Comprueba con `command -v dsh`, que debe apuntar a `~/studio/dsh-cli`.
- **No** uses `~/.dsh`. Si existe en el equipo nuevo, no lo toques.
- Proveedor de modelos: a decidir (D5). Sin proveedor no se pueden probar C-T1-01 ni C-T1-09.

## Paso 4: plugins comunitarios (🧑 autoriza cada uno)

Fase 5 del v3.1 doc 30: cada instalador se prueba primero en un `HOME` desechable con `bwrap --unshare-net` y `strace`, con veredicto PASS, WARN o BLOCK. Solo con PASS (o WARN con la opción segura) se instala en el perfil, por este orden:

1. `dsh-mnemon@0.5.46` (o una versión posterior con propuesta), con su **composición sobrescrita** para dejar solo proveedores locales. El motor `mnemon` se instala aparte (Go).
2. `dsh-deja@0.24.2` (o 0.25.1 con propuesta), con lista cerrada de directorios.
3. `dsh-codebase-memory-mcp`: **no se instala** mientras su procedencia no esté verificada (EV-084).

Anota en `studio.lock.json` la versión, la integridad, la licencia y el veredicto de cada uno (formato del v3.1 doc 27 §2).

## Paso 5: prototipo de Studio (🤖 con autorización)

```bash
git clone <remoto-privado-del-prototipo> ~/Projects/evol-driven-studio
cd ~/Projects/evol-driven-studio && npm ci && npm run typecheck && npm test     # 59/59 esperado
source ~/studio/env.sh
dsh plugin --profile evol-studio add --save-exact link:$HOME/Projects/evol-driven-studio
dsh --profile evol-studio --no-open --port 3181
```

Configura las raíces del Host para que apunten **solo** a proyectos de prueba, no a `~/Projects` entero. Después, el protocolo visual del prototipo (`docs/protocolo-validacion-visual-etapa1.md`) lo ejecuta la persona en su navegador.

## Qué devolver (para cerrar la Tanda 1 en el equipo nuevo)

`preflight.txt`, la salida de `evol doctor` y `npm run ci`, la línea de `integrity` de DSH, `studio.lock.json`, los informes por plugin, los resultados de C-T1-01 a C-T1-10 y el resultado del protocolo visual del prototipo. Cada dato va con el comando que lo produjo (contrato del v3.1 doc 13 §5).
