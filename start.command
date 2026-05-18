#!/bin/bash
# Cinelog — double-click to launch

# Go to the directory containing this script
cd "$(dirname "$0")"

# Check for Node.js
if ! command -v node &>/dev/null; then
  osascript -e 'display alert "Node.js not found" message "Please install Node.js from https://nodejs.org and try again."'
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (first run)..."
  npm install
  echo ""
fi

# Open browser after a short delay
(sleep 2 && open "http://localhost:3737") &

# Start the server
echo "Starting Cinelog…"
node server.js
