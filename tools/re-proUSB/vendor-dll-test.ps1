<#
.SYNOPSIS
    Calls the vendor d12c.dll directly (IniUsbPro / writePortPro / readPortPro).

.DESCRIPTION
    This is the ground truth: it runs the exact code path CardLock.Exe uses, so any
    difference with our own HID harness (hid-probe.ps1) is a framing difference.

    Must run under 32-bit PowerShell (d12c.dll is x86):
        %WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -File vendor-dll-test.ps1

.EXAMPLE
    powershell -File vendor-dll-test.ps1 -FrameHex "AA01963D"
    powershell -File vendor-dll-test.ps1 -FrameHex "AA21EC...checksum" -ReadDelayMs 1200
#>
param(
    [string]$FrameHex = "AA01963D",
    [int]$ReadDelayMs = 1200,
    [switch]$FillCc,
    # ReadRecord streams packets: dump several reads to see the sequence/stream shape.
    [int]$ReadCount = 1,
    [int]$IntervalMs = 60
)

$ErrorActionPreference = 'Stop'
$dir = "C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem"

if (-not (Test-Path (Join-Path $dir 'd12c.dll'))) {
    Write-Output "ERROR=d12c.dll_not_found"
    exit 1
}

# Make the vendor DLL resolvable the way the vendor's own EXE does it.
$env:PATH = "$dir;$env:PATH"
[Environment]::CurrentDirectory = $dir

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class VendorD12c
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

$clean = ($FrameHex -replace '[^0-9A-Fa-f]', '')
if ($clean.Length -lt 2) { Write-Output "ERROR=hex_required"; exit 1 }

$frame = New-Object byte[] 64
for ($i = 0; $i -lt ($clean.Length / 2); $i++) {
    $frame[$i] = [Convert]::ToByte($clean.Substring($i * 2, 2), 16)
}
if ($FillCc) {
    for ($i = ($clean.Length / 2); $i -lt 64; $i++) { $frame[$i] = 0xCC }
}

Write-Output ("frame64=" + [VendorD12c]::Hex($frame))
Write-Output "calling IniUsbPro() ..."
[VendorD12c]::IniUsbPro()
Write-Output ("calling writePortPro(0x40, frame) at " + (Get-Date -Format 'HH:mm:ss.fff'))
[VendorD12c]::writePortPro(0x40, $frame)
Write-Output ("sleeping " + $ReadDelayMs + " ms before read")
Start-Sleep -Milliseconds $ReadDelayMs
for ($i = 0; $i -lt $ReadCount; $i++) {
    $resp = New-Object byte[] 65
    $sw = [Diagnostics.Stopwatch]::StartNew()
    [VendorD12c]::readPortPro(0x40, $resp)
    $sw.Stop()
    Write-Output ("read[$i] elapsed_ms=" + $sw.ElapsedMilliseconds + " resp=" + [VendorD12c]::Hex($resp))
    if ($i -lt ($ReadCount - 1)) { Start-Sleep -Milliseconds $IntervalMs }
}
