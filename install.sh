#!/usr/bin/env bash
# AlgoVibe — one-command Docker install (macOS / Linux)
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. See https://docs.docker.com/get-docker/"
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — add OPENROUTER_API_KEY or ANTHROPIC_API_KEY."
fi

echo "Starting AlgoVibe (frontend :3000, backend :8000)..."
docker compose up --build -d

echo ""
echo "AlgoVibe is starting."
echo "  Chat UI:  http://localhost:3000/chat"
echo "  API:      http://localhost:8000/health"
echo ""
echo "Logs:  docker compose logs -f"
echo "Stop:  docker compose down"
