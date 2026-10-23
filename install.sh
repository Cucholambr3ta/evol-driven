#!/usr/bin/env bash
# Instala evol-driven desde este repositorio, sin sudo:
#   1. comprueba Node 24 o superior, Git y npm;
#   2. instala las dependencias y compila;
#   3. deja el comando `evol` en ~/.local/bin;
#   4. lanza `evol setup`, que pregunta antes de instalar lo que falte.
# Opciones: --sin-setup (no lanza evol setup), --solo-enlace (solo el paso 3; para pruebas).
set -euo pipefail

aqui="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
sin_setup=0
solo_enlace=0
for arg in "$@"; do
  case "$arg" in
    --sin-setup) sin_setup=1 ;;
    --solo-enlace) solo_enlace=1; sin_setup=1 ;;
    *) echo "Opción desconocida: $arg" >&2; exit 2 ;;
  esac
done

falla() { echo "× $1" >&2; exit 1; }

if [ "$solo_enlace" -eq 0 ]; then
  command -v node >/dev/null || falla "Falta Node.js (hace falta la versión 24 o superior)."
  [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 24 ] || falla "Node $(node -v) es demasiado antiguo: hace falta la 24 o superior."
  command -v git >/dev/null || falla "Falta Git."
  command -v npm >/dev/null || falla "Falta npm."
  echo "→ Instalando dependencias y compilando…"
  (cd "$aqui" && npm ci && npm run build)
fi

destino="$HOME/.local/bin/evol"
mkdir -p "$HOME/.local/bin"
if [ -e "$destino" ] && [ ! -L "$destino" ]; then
  falla "$destino ya existe y no es un enlace: no lo toco. Muévelo o bórralo y vuelve a ejecutar."
fi
ln -sfn "$aqui/dist/cli.js" "$destino"
echo "✓ Comando evol en $destino"
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo "! $HOME/.local/bin no está en tu PATH: añádelo a tu perfil de shell para usar «evol» desde cualquier carpeta." ;;
esac

if [ "$sin_setup" -eq 0 ]; then
  echo
  exec "$destino" setup
fi
