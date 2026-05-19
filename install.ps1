# AlgoVibe — one-command Docker install (Windows PowerShell)
$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed. Install Docker Desktop: https://docs.docker.com/desktop/"
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example — add OPENROUTER_API_KEY or ANTHROPIC_API_KEY before building."
}

Write-Host "Starting AlgoVibe (frontend :3000, backend :8000)..."
docker compose up --build -d

Write-Host ""
Write-Host "AlgoVibe is starting."
Write-Host "  Chat UI:  http://localhost:3000/chat"
Write-Host "  API:      http://localhost:8000/health"
Write-Host ""
Write-Host "Logs:  docker compose logs -f"
Write-Host "Stop:  docker compose down"
