<#
.SYNOPSIS
    Reads or writes one card record through the vendor encoder (d12c.dll, USB HID).

.DESCRIPTION
    Implements the verified frame format documented in docs/re-proUSB/CARD-API.md §5:

        AA <n> EC | payload | XOR        n = 0x11 (16-byte payload) or 0x21 (32 bytes)
                                         XOR = XOR of every byte before it

    A write sends cmd 0xEC and gets no reply by design; the script reads the card back and
    compares the 16-byte record so a write is only reported as successful when the card agrees.

    d12c.dll is x86, so run this under 32-bit PowerShell:
        %WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -File card-rw.ps1 ...

    Only for cards and locks you own or administer.

.EXAMPLE
    powershell -File card-rw.ps1 -Action read

.EXAMPLE
    powershell -File card-rw.ps1 -Action write -RecordHex C91224B6E3818101016265DB1565E300

.EXAMPLE
    # 32-byte payload, the shape proRFL.WriteCard emits
    powershell -File card-rw.ps1 -Action write -PayloadLen 32 -RecordHex C9121722FF00298000B919D2C029D5FB
#>
param(
    [ValidateSet('read', 'write')][string]$Action = 'read',
    [string]$RecordHex = '',
    [ValidateSet(16, 32)][int]$PayloadLen = 16,
    [int]$ReportId = 0x40,
    [int]$ReadDelayMs = 500,
    [int]$Retries = 6
)

$ErrorActionPreference = 'Stop'
$dir = "C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem"

if (-not (Test-Path (Join-Path $dir 'd12c.dll'))) {
    Write-Output "ERROR=d12c.dll_not_found"
    exit 1
}

$env:PATH = "$dir;$env:PATH"
[Environment]::CurrentDirectory = $dir

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class CardRw
{
    [DllImport("d12c.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void IniUsbPro();

    [DllImport("d12c.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void writePortPro(int cmd, byte[] buf);

    [DllImport("d12c.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void readPortPro(int cmd, byte[] buf);

    public static string Hex(byte[] b)
    {
        if (b == null) return "";
        System.Text.StringBuilder sb = new System.Text.StringBuilder(b.Length * 3);
        for (int i = 0; i < b.Length; i++)
        {
            sb.Append(b[i].ToString("X2"));
            if (i != b.Length - 1) sb.Append(' ');
        }
        return sb.ToString();
    }
}
'@ -Language CSharp

function ConvertTo-Bytes([string]$hex) {
    $clean = ($hex -replace '[^0-9A-Fa-f]', '')
    $out = New-Object byte[] ($clean.Length / 2)
    for ($i = 0; $i -lt $out.Length; $i++) {
        $out[$i] = [Convert]::ToByte($clean.Substring($i * 2, 2), 16)
    }
    return $out
}

function New-CardFrame([string]$record, [int]$payloadLen) {
    $rec = ($record -replace '[^0-9A-Fa-f]', '').ToUpper()
    if ($rec.Length -ne 32) { throw "RecordHex must be exactly 32 hex characters (16 bytes)" }
    $payload = $rec
    if ($payloadLen -eq 32) { $payload += ('00' * 16) }
    $n = ($payload.Length / 2) + 1
    $body = 'AA' + ('{0:X2}' -f $n) + 'EC' + $payload
    $bytes = ConvertTo-Bytes $body
    $xor = 0
    foreach ($b in $bytes) { $xor = $xor -bxor $b }
    return ($body + ('{0:X2}' -f $xor)).ToUpper()
}

function Send-Report([byte[]]$frame) {
    $buf = New-Object byte[] 64
    [Array]::Copy($frame, $buf, [Math]::Min(64, $frame.Length))
    [CardRw]::writePortPro($ReportId, $buf)
}

function Read-Card {
    # The reader re-enumerates every few hundred ms: retry until a 0x55 frame comes back.
    $req = ConvertTo-Bytes 'AA01E44F'
    for ($i = 1; $i -le $Retries; $i++) {
        Send-Report $req
        Start-Sleep -Milliseconds $ReadDelayMs
        $resp = New-Object byte[] 65
        [CardRw]::readPortPro($ReportId, $resp)
        # d12c stores the report starting at index 1; accept either layout defensively.
        $start = if ($resp[0] -eq 0x55) { 0 } elseif ($resp[1] -eq 0x55) { 1 } else { -1 }
        if ($start -ge 0 -and ($start + 18) -lt $resp.Length) {
            $record = ($resp[($start + 3)..($start + 18)] | ForEach-Object { $_.ToString('X2') }) -join ''
            if ($record -match '^[0-9A-F]{32}$') { return $record }
        }
        Start-Sleep -Milliseconds 300
    }
    return $null
}

[CardRw]::IniUsbPro()

if ($Action -eq 'read') {
    $rec = Read-Card
    if (-not $rec) { Write-Output "ERROR=no_response"; exit 2 }
    Write-Output "record16=$rec"
    exit 0
}

$frame = New-CardFrame $RecordHex $PayloadLen
Write-Output "frame=$frame"
$before = Read-Card
if ($before) { Write-Output "before=$before" } else { Write-Output "before=unreadable" }
Send-Report (ConvertTo-Bytes $frame)
Start-Sleep -Milliseconds 1500
$after = Read-Card
if (-not $after) { Write-Output "ERROR=no_readback"; exit 2 }
Write-Output "after=$after"
$expected = ($RecordHex -replace '[^0-9A-Fa-f]', '').ToUpper()
if ($after -eq $expected) {
    Write-Output "verify=ok"
    exit 0
}
Write-Output "verify=MISMATCH"
exit 3
