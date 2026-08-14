# Shared helpers for Sara Maps PowerShell scripts.
# Dot-source from each script: . (Join-Path $PSScriptRoot 'ps-lib.ps1')

function Get-RepoRoot {
  return Split-Path -Parent $PSScriptRoot
}

function Load-EnvFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $name = $Matches[1]
      $value = $Matches[2]
      if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") { $value = $Matches[1] }
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

function Ensure-EnvFile {
  $root = Get-RepoRoot
  $envFile = Join-Path $root '.env'
  if (-not (Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $envFile
    Write-Host "Created .env from .env.example (review before proceeding)."
  }
  return $envFile
}

function Invoke-DockerCompose {
  param([string[]]$DockerArgs)
  $root = Get-RepoRoot
  $compose = Join-Path $root 'docker\compose.yml'
  $envFile = Ensure-EnvFile
  $cmd = @('compose', '--env-file', $envFile, '-f', $compose) + $DockerArgs
  & docker @cmd
  if ($LASTEXITCODE -ne 0) { throw "docker compose $($DockerArgs -join ' ') failed (exit $LASTEXITCODE)" }
}

function Get-EnvOrDefault {
  param([string]$Name, [string]$Default)
  $v = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if ([string]::IsNullOrWhiteSpace($v)) { return $Default }
  return $v
}
