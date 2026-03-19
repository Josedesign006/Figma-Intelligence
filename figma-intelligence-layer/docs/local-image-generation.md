# Local Image Generation Setup

This project can generate images locally through ComfyUI and auto-start the local server when a user asks for image generation.

## One-time setup

Run:

```sh
sh scripts/setup-comfyui-local.sh
```

This script:

- clones ComfyUI into `.local/comfyui/ComfyUI`
- creates a Python virtual environment
- installs Python dependencies
- writes `.local/comfyui.env`
- copies a starter workflow template to `.local/comfyui-workflow.json`

## What still needs to be added

The setup script does not download FLUX model weights automatically.

You still need to:

1. Put your real model files into the ComfyUI models directory.
2. Export a real ComfyUI API workflow and save it to `.local/comfyui-workflow.json`.
3. Make sure the workflow node names match the models you installed.

The included example file is only a placeholder:

- [examples/comfyui-workflow-template.example.json](/Users/nilmanikumar/Documents/Vs%20code%20files/MCP%20power%20-VS%20code%20version/figma-intelligence-layer/examples/comfyui-workflow-template.example.json)

## Runtime behavior

When `provider: "comfyui"` is used:

- the MCP checks whether ComfyUI is already running
- if not, it tries to start it with `COMFYUI_LAUNCH_CMD`
- it waits for the server to become reachable
- then it submits the exported API workflow

The default launch wrapper is:

```sh
sh scripts/start-comfyui.sh
```

## Suggested config

You can source `.local/comfyui.env` or copy its values into your MCP config.

Important variables:

- `COMFYUI_BASE_URL`
- `COMFYUI_AUTO_START`
- `COMFYUI_LAUNCH_CMD`
- `COMFYUI_WORKFLOW_PATH`

