# Query the recovered CardLock.mdb with the recovered Jet password.
# MUST run under 32-bit PowerShell (Jet OLEDB 4.0 is x86 only):
#   %WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -File tools\re-proUSB\mdb-query.ps1 -Sql "..."
#
# The password is read from local.env (git-ignored) and never printed.

param(
  [Parameter(Mandatory = $true)][string]$Sql,
  [int]$Max = 200
)

$ErrorActionPreference = 'Stop'
$cfg = @{}
Get-Content (Join-Path $PSScriptRoot 'local.env') | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $cfg[$matches[1]] = $matches[2].Trim().Trim('"')
  }
}
$db = $cfg['PROUSB_MDB']
$pw = $cfg['PROUSB_MDB_PASSWORD']
if (-not $db -or -not $pw) { throw 'local.env is missing PROUSB_MDB / PROUSB_MDB_PASSWORD' }
if (-not (Test-Path $db)) { throw "database not found: $db" }

$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$db;Jet OLEDB:Database Password=$pw;"
$conn.Open()
try {
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $Sql
  $reader = $cmd.ExecuteReader()
  $cols = @()
  for ($i = 0; $i -lt $reader.FieldCount; $i++) { $cols += $reader.GetName($i) }
  Write-Output ('# ' + ($cols -join ' | '))
  $n = 0
  while ($reader.Read() -and $n -lt $Max) {
    $vals = @()
    for ($i = 0; $i -lt $cols.Count; $i++) {
      $v = $reader.GetValue($i)
      if ($v -is [byte[]]) { $v = ($v | ForEach-Object { $_.ToString('x2') }) -join '' }
      elseif ($v -eq [DBNull]::Value) { $v = '' }
      $vals += [string]$v
    }
    Write-Output ($vals -join ' | ')
    $n++
  }
  Write-Output "-- $n row(s)"
  $reader.Close()
}
finally {
  $conn.Close()
}
