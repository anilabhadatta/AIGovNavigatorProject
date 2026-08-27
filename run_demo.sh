#!/usr/bin/env bash
set -euo pipefail

# Cross-platform (mac/linux) helper to start the demo services in background
# Starts:
# - dummy-gov-webapp on port 8001
# - ai-gov-navigator backend on port 8000
# - ai-gov-navigator frontend (npm dev server)

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Starting demo services from $ROOT_DIR"

install_python_deps() {
  local dir="$1"
  local requirements="$2"

  pushd "$ROOT_DIR/$dir" >/dev/null || { echo "Failed to cd to $dir"; exit 1; }

  if [ ! -d "venv" ]; then
    python3 -m venv venv
  fi

  ./venv/bin/python -m pip install --upgrade pip setuptools wheel
  ./venv/bin/pip install -r "$requirements"

  popd >/dev/null || true
}

install_frontend_deps() {
  pushd "$ROOT_DIR/ai-gov-navigator/frontend" >/dev/null || { echo "Failed to cd to frontend"; exit 1; }

  if command -v npm >/dev/null 2>&1; then
    if [ -f "package-lock.json" ]; then
      npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-factor=2 --fetch-retry-maxtimeout=120000
    else
      npm install --no-audit --no-fund --fetch-retries=5 --fetch-retry-factor=2 --fetch-retry-maxtimeout=120000
    fi
  else
    echo "npm not found; please install Node.js and npm to run the frontend"
    exit 1
  fi

  popd >/dev/null || true
}

start_python_service() {
  local dir="$1"
  local module="$2"
  local port="$3"

  pushd "$ROOT_DIR/$dir" >/dev/null || { echo "Failed to cd to $dir"; return 1; }

  if [ -x "venv/bin/python" ]; then
    PY_CMD="./venv/bin/python"
  else
    PY_CMD="$(command -v python3 || command -v python || true)"
  fi

  if [ -z "$PY_CMD" ]; then
    echo "No Python interpreter found for $dir; please create a venv or install python3"
  else
    nohup "$PY_CMD" -m uvicorn "$module" --port "$port" --reload > "$ROOT_DIR/$dir/run.log" 2>&1 &
    echo "Started $dir on port $port (logs: $ROOT_DIR/$dir/run.log)"
  fi

  popd >/dev/null || true
}

install_python_deps "dummy-gov-webapp" "requirements.txt"
install_python_deps "ai-gov-navigator/backend" "requirements.txt"
install_frontend_deps

start_python_service "dummy-gov-webapp" "main:app" "8001"
start_python_service "ai-gov-navigator/backend" "main:app" "8000"

pushd "$ROOT_DIR/ai-gov-navigator/frontend" >/dev/null || { echo "Failed to cd to frontend"; exit 1; }
nohup npm run dev > "$ROOT_DIR/ai-gov-navigator/frontend/run.log" 2>&1 &
echo "Started frontend dev server (logs: $ROOT_DIR/ai-gov-navigator/frontend/run.log)"
popd >/dev/null || true

echo "Dummy Gov Master API: http://localhost:8001/api/master"
echo "Backend API: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "All start commands issued. Check individual run.log files for output."
