# Install or refresh garrytan/gstack into this repo (Claude Code path).
# Grok adapter lives at .grok/skills/gstack/ — no Bun required for Grok.
# Full slash-command setup needs Bun + Node; run setup from Git Bash/WSL after clone.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Target = Join-Path $Root ".claude\skills\gstack"
$Repo = "https://github.com/garrytan/gstack.git"

Write-Host "BluePlanet gstack installer"
Write-Host "Target: $Target"

New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null

if (Test-Path (Join-Path $Target ".git")) {
  Write-Host "Existing clone found — fetching latest (depth 1)..."
  Push-Location $Target
  git fetch --depth 1 origin main
  git reset --hard origin/main
  Pop-Location
} elseif (Test-Path $Target) {
  Write-Host "Directory exists without .git — removing and re-cloning..."
  Remove-Item -Recurse -Force $Target
  git clone --single-branch --depth 1 $Repo $Target
} else {
  git clone --single-branch --depth 1 $Repo $Target
}

$ver = Get-Content (Join-Path $Target "VERSION") -ErrorAction SilentlyContinue
Write-Host "gstack version: $ver"
Write-Host ""
Write-Host "Grok:  Use skill 'gstack' (see GSTACK.md)"
Write-Host "Claude: Optional full setup (Bun + Node required):"
Write-Host "  cd .claude/skills/gstack && ./setup"
Write-Host "Done."
