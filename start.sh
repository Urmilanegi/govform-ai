#!/bin/bash
# GovForm AI — Start Script
# Run this to start the server: bash start.sh

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Load .env.local
if [ -f ".env.local" ]; then
  while IFS='=' read -r key val; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    export "$key=$val"
  done < .env.local
  echo "✅ .env.local loaded"
fi

# Kill any running instance
kill $(lsof -ti :3000) 2>/dev/null && echo "🔴 Stopped old server"
sleep 1

echo "🚀 Starting GovForm AI at http://localhost:3000 ..."
exec node node_modules/.bin/next dev
