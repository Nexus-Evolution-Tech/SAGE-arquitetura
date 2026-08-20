$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$serviceRoot = 'C:\Program Files\SAGE\service'
$statusFile = 'C:\SAGE-F8-Work\provision-status.json'
$status = [ordered]@{
  initializeState = 'pending'
  initializeMysql = 'pending'
  provisionServices = 'pending'
  error = $null
}

try {
  & (Join-Path $serviceRoot 'initialize-state.ps1')
  if (-not $?) { throw 'initialize-state.ps1 retornou falha' }
  $status.initializeState = 'passed'

  & (Join-Path $serviceRoot 'initialize-mysql.ps1')
  if (-not $?) { throw 'initialize-mysql.ps1 retornou falha' }
  $status.initializeMysql = 'passed'

  & (Join-Path $serviceRoot 'provision-services.ps1') -StartApi
  if (-not $?) { throw 'provision-services.ps1 retornou falha' }
  $status.provisionServices = 'passed'
} catch {
  $status.error = $_.Exception.Message
  throw
} finally {
  $status | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding UTF8
}
