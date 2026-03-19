#!/bin/zsh
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_DIR="$REPO_DIR/figma-bridge-plugin"

# Kill any existing instance
pkill -f "bridge-relay.js" 2>/dev/null
sleep 1

echo "Starting Figma bridge relay on ws://localhost:9001..."
cd "$SCRIPT_DIR" && node bridge-relay.js
