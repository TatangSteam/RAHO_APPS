param(
  [string]$DumpFile = "postgres.dump",
  [string]$OutputFile = "seed.sql"
)

$ErrorActionPreference = "Stop"

$DbName = "temp_seed_db"
$ContainerName = "temp_postgres_seed"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker tidak ditemukan. Install Docker Desktop for Windows dulu."
}

Write-Host "Converting PostgreSQL dump to INSERT statements using Docker..."
Write-Host "Dump file: $DumpFile"
Write-Host "Output file: $OutputFile"
Write-Host ""

docker rm -f $ContainerName 2>$null | Out-Null

try {
  Write-Host "Starting temporary PostgreSQL container..."
  docker run -d `
    --name $ContainerName `
    -e POSTGRES_PASSWORD=temp123 `
    -e POSTGRES_DB=$DbName `
    postgres:15 | Out-Null

  Write-Host "Waiting for PostgreSQL to be ready..."
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    docker exec $ContainerName pg_isready -U postgres -d $DbName 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }

  if (-not $ready) {
    throw "PostgreSQL container tidak siap setelah 30 detik."
  }

  Write-Host "Copying dump file to container..."
  docker cp $DumpFile "$ContainerName`:/tmp/postgres.dump"

  Write-Host "Restoring dump to database..."
  docker exec $ContainerName pg_restore `
    -U postgres `
    -d $DbName `
    --no-owner `
    --no-privileges `
    /tmp/postgres.dump

  if ($LASTEXITCODE -ne 0) {
    throw "pg_restore gagal."
  }

  Write-Host "Exporting database with INSERT statements..."
  docker exec $ContainerName pg_dump `
    -U postgres `
    -d $DbName `
    --data-only `
    --inserts `
    --column-inserts `
    --no-owner `
    --no-privileges |
    Set-Content -Encoding UTF8 $OutputFile

  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump gagal."
  }

  Write-Host ""
  Write-Host "Successfully converted to INSERT statements: $OutputFile"
}
finally {
  Write-Host "Cleaning up..."
  docker rm -f $ContainerName 2>$null | Out-Null
}
