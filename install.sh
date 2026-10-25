#!/usr/bin/env bash
# Instala evol-driven desde este repositorio, sin sudo. Hay dos modos y no se mezclan:
#
#   (por defecto)  instalación ESTABLE: compila, prepara quién puede firmar versiones (evol setup) e
#                  instala con `evol update` la última versión firmada de este repositorio. La copia
#                  queda en ~/.local/share/evol/versiones, de solo lectura, y `evol` apunta a ella.
#                  Lo que cambies después en este repositorio no la afecta hasta que publiques otra
#                  versión (evol release) y actualices.
#   --dev          instalación de DESARROLLO: deja `evol-dev` apuntando a este repositorio. Es el
#                  origen: lo que edites aquí se nota al compilar. No toca el comando `evol`.
#
# Otras opciones: --sin-setup (no lanza evol setup), --sin-compilar (usa el dist/ que ya hay),
# --repositorio <ruta|url> (de dónde sale la versión estable; por defecto, este repositorio).
set -euo pipefail

aqui="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
modo=estable
sin_setup=0
sin_compilar=0
repositorio="$aqui"
while [ $# -gt 0 ]; do
  case "$1" in
    --dev) modo=dev ;;
    --sin-setup) sin_setup=1 ;;
    --sin-compilar) sin_compilar=1 ;;
    --repositorio) shift; [ $# -gt 0 ] || { echo "--repositorio necesita una ruta o una URL." >&2; exit 2; }; repositorio="$1" ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
  shift
done

falla() { echo "× $1" >&2; exit 1; }

if [ "$sin_compilar" -eq 0 ]; then
  command -v node >/dev/null || falla "Falta Node.js (hace falta la versión 24 o superior)."
  [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 24 ] || falla "Node $(node -v) es demasiado antiguo: hace falta la 24 o superior."
  command -v git >/dev/null || falla "Falta Git."
  command -v npm >/dev/null || falla "Falta npm."
  echo "→ Instalando dependencias y compilando…"
  (cd "$aqui" && npm ci && npm run build)
fi

bin="$HOME/.local/bin"
mkdir -p "$bin"
case ":$PATH:" in
  *":$bin:"*) ;;
  *) echo "! $bin no está en tu PATH: añádelo a tu perfil de shell para usar «evol» desde cualquier carpeta." ;;
esac

if [ "$modo" = dev ]; then
  destino="$bin/evol-dev"
  if [ -e "$destino" ] && [ ! -L "$destino" ]; then
    falla "$destino ya existe y no es un enlace: no lo toco. Muévelo o bórralo y vuelve a ejecutar."
  fi
  ln -sfn "$aqui/dist/cli.js" "$destino"
  echo "✓ Comando evol-dev en $destino (el origen: lo que edites aquí se nota al compilar)"
  echo "  El comando «evol» no se ha tocado: para la copia estable, ejecuta ./install.sh sin --dev."
  [ "$sin_setup" -eq 1 ] || { echo; exec "$destino" setup; }
  exit 0
fi

# estable: hace falta una versión publicada (una etiqueta v* firmada) de la que instalar
cli="$aqui/dist/cli.js"
if [ "$sin_setup" -eq 0 ]; then
  echo; "$cli" setup
fi
if [ -d "$repositorio/.git" ] && [ -z "$(git -C "$repositorio" tag --list 'v*')" ]; then
  echo
  echo "× $repositorio no tiene ninguna versión publicada (etiquetas v*), así que no hay nada estable que instalar." >&2
  echo "  Publica una desde el origen:  evol-dev release x.y.z   (la firma tu clave SSH; no sube nada)" >&2
  echo "  o instala solo la copia de desarrollo:  ./install.sh --dev" >&2
  exit 1
fi
echo
echo "→ Instalando la última versión firmada de $repositorio…"
exec "$cli" update --repositorio "$repositorio"
