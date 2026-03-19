#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
INSTALL_ROOT="${COMFYUI_HOME:-$PROJECT_DIR/.local/comfyui}"
COMFYUI_REPO_DIR="$INSTALL_ROOT/ComfyUI"
VENV_DIR="$INSTALL_ROOT/venv"
ENV_FILE="$PROJECT_DIR/.local/comfyui.env"
WORKFLOW_TARGET="$PROJECT_DIR/.local/comfyui-workflow.json"
EXAMPLE_WORKFLOW="$PROJECT_DIR/examples/comfyui-workflow-template.example.json"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

mkdir -p "$INSTALL_ROOT"
mkdir -p "$PROJECT_DIR/.local"

require_cmd git
require_cmd python3

if [ ! -d "$COMFYUI_REPO_DIR/.git" ]; then
  echo "Cloning ComfyUI into $COMFYUI_REPO_DIR"
  git clone https://github.com/comfyanonymous/ComfyUI.git "$COMFYUI_REPO_DIR"
else
  echo "ComfyUI repo already present at $COMFYUI_REPO_DIR"
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating Python virtual environment"
  python3 -m venv "$VENV_DIR"
fi

echo "Installing ComfyUI Python dependencies"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$COMFYUI_REPO_DIR/requirements.txt"

if [ ! -f "$WORKFLOW_TARGET" ]; then
  cp "$EXAMPLE_WORKFLOW" "$WORKFLOW_TARGET"
fi

cat > "$ENV_FILE" <<EOF_ENV
COMFYUI_HOME=$INSTALL_ROOT
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_AUTO_START=true
COMFYUI_LAUNCH_CMD=sh "$PROJECT_DIR/scripts/start-comfyui.sh"
COMFYUI_WORKFLOW_PATH=$WORKFLOW_TARGET
EOF_ENV

echo
echo "Local ComfyUI bootstrap is ready."
echo
echo "Created:"
echo "  - $ENV_FILE"
echo "  - $WORKFLOW_TARGET"
echo
echo "Next required step:"
echo "  1. Put a real exported ComfyUI API workflow into $WORKFLOW_TARGET"
echo "  2. Make sure the workflow references model files that exist in $COMFYUI_REPO_DIR/models"
echo
echo "After that, image generation requests can auto-start ComfyUI through:"
echo "  sh $PROJECT_DIR/scripts/start-comfyui.sh"

