#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$PROJECT_DIR/.local/comfyui.env"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

INSTALL_ROOT="${COMFYUI_HOME:-$PROJECT_DIR/.local/comfyui}"
COMFYUI_REPO_DIR="$INSTALL_ROOT/ComfyUI"
VENV_DIR="$INSTALL_ROOT/venv"
PORT="${COMFYUI_PORT:-8188}"
HOST="${COMFYUI_HOST:-127.0.0.1}"

if [ ! -d "$COMFYUI_REPO_DIR" ]; then
  echo "ComfyUI is not installed at $COMFYUI_REPO_DIR" >&2
  echo "Run: sh $PROJECT_DIR/scripts/setup-comfyui-local.sh" >&2
  exit 1
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "ComfyUI virtual environment is missing at $VENV_DIR" >&2
  echo "Run: sh $PROJECT_DIR/scripts/setup-comfyui-local.sh" >&2
  exit 1
fi

cd "$COMFYUI_REPO_DIR"
exec "$VENV_DIR/bin/python" main.py --listen "$HOST" --port "$PORT"

