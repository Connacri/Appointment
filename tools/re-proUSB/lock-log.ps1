<#
.SYNOPSIS
    Issues a "Record Card" for a proUSB/TEMIC lock and reads the lock event log back.

.DESCRIPTION
    The vendor software never talks to a lock directly. It uses a *record card*:

        1. the software writes a record card  (proRFL.RecordCard, type byte 0x10|n)
        2. the card is inserted in the lock   (the lock appends its event log to it)
        3. the card comes back to the reader  (proRFL.ReadRecord, frame AA 01 82 29)
        4. the log is stored in CardLock.mdb / RecordOpen

    Step 1 and 3 are reproduced here from the vendor DLL, so a card can be issued and
    read without the vendor application.

    The reader is reached through d12c.dll (x86), therefore this script must run under
    32-bit PowerShell:
        %WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -File lock-log.ps1 ...

    Only for cards and locks you own or administer.

.PARAMETER Action
    record-card  write a record card (step 1)
    read-log     stream the log out of a record card that came back from the lock (step 3)
    dump-memory  read the card EEPROM in 32-byte pages (ReadE2, AA 02 47 <a> <a^EF>)

.PARAMETER DateString
    YYMMDDHHMM packed into the record card, exactly like the vendor's Format('YYMMDDHHMM').
    Defaults to the current local time.

.PARAMETER Byte7 / Byte8
    The two caller-supplied bytes (param_5 / param_4 of proRFL.RecordCard). The vendor
    passes two globals there; 0 is the neutral value used when no option is ticked.

.EXAMPLE
    powershell -File lock-log.ps1 -Action record-card

.EXAMPLE
    powershell -File lock-log.ps1 -Action read-log

.EXAMPLE
    powershell -File lock-log.ps1 -Action dump-memory
#>
param(
    [ValidateSet('record-card', 'read-log', 'dump-memory')][string]$Action = 'read-log',
    [string]$DateString = '',
    [ValidateRange(0, 15)][int]$RecordIndex = 0,
    [ValidateRange(0, 255)][int]$Byte7 = 0,
    [ValidateRange(0, 255)][int]$Byte8 = 0,
    [string]$NonceHex = '',
    [int]$ReportId = 0x40,
    [int]$Retries = 6,
    [int]$ReadDelayMs = 500,
    [int]$WriteAttempts = 4,
    [int]$WriteSettleMs = 1800,
    [int]$MaxPackets = 256,
    [int]$PacketRetries = 3,
    [int]$PacketWaitMs = 150,
    [int]$PacketIntervalMs = 60
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

public static class ProUsbLog
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
    if ($clean.Length -eq 0 -or ($clean.Length % 2) -ne 0) {
        throw "Hex input must contain an even number of digits (got $($clean.Length))"
    }
    $out = New-Object byte[] ([int]($clean.Length / 2))
    for ($i = 0; $i -lt $out.Length; $i++) {
        $out[$i] = [Convert]::ToByte($clean.Substring($i * 2, 2), 16)
    }
    return $out
}

function To-Hex([byte[]]$bytes) {
    return (($bytes | ForEach-Object { $_.ToString('X2') }) -join '')
}

function Get-Xor([byte[]]$bytes) {
    $x = 0
    foreach ($b in $bytes) { $x = $x -bxor $b }
    return $x
}

function New-Frame([string]$bodyHex) {
    $bytes = ConvertTo-Bytes $bodyHex
    $all = New-Object byte[] ($bytes.Length + 1)
    [Array]::Copy($bytes, $all, $bytes.Length)
    $all[$bytes.Length] = Get-Xor $bytes
    return $all
}

function Send-Frame([byte[]]$frame) {
    $buf = New-Object byte[] 64
    [Array]::Copy($frame, $buf, [Math]::Min(64, $frame.Length))
    [ProUsbLog]::writePortPro($ReportId, $buf)
}

function Read-Response {
    $resp = New-Object byte[] 65
    [ProUsbLog]::readPortPro($ReportId, $resp)
    return $resp
}

function Get-CardRecord {
    # ReadCard = AA 01 E4 4F, response 55 15 01 <16-byte record> <xor>
    $req = ConvertTo-Bytes 'AA01E44F'
    for ($i = 1; $i -le $Retries; $i++) {
        Send-Frame $req
        Start-Sleep -Milliseconds $ReadDelayMs
        $resp = Read-Response
        $start = if ($resp[0] -eq 0x55) { 0 } elseif ($resp[1] -eq 0x55) { 1 } else { -1 }
        if ($start -ge 0 -and ($start + 18) -lt $resp.Length) {
            $record = ($resp[($start + 3)..($start + 18)] | ForEach-Object { $_.ToString('X2') }) -join ''
            if ($record -match '^[0-9A-F]{32}$') { return $record }
        }
        Start-Sleep -Milliseconds 300
    }
    return $null
}

[ProUsbLog]::IniUsbPro()

# ---------------------------------------------------------------------------
# record-card : reproduce proRFL.RecordCard (type 0x10|n)
# ---------------------------------------------------------------------------
if ($Action -eq 'record-card') {
    if ([string]::IsNullOrWhiteSpace($DateString)) {
        $DateString = (Get-Date).ToString('yyMMddHHmm')
    }
    if ($DateString -notmatch '^\d{10}$') {
        Write-Output "ERROR=DateString_must_be_10_digits_YYMMDDHHMM"
        exit 1
    }

    $yy = [int]$DateString.Substring(0, 2)
    $mm = [int]$DateString.Substring(2, 2)
    $dd = [int]$DateString.Substring(4, 2)
    $hh = [int]$DateString.Substring(6, 2)
    $mi = [int]$DateString.Substring(8, 2)

    if ($mm -lt 1 -or $mm -gt 12 -or $dd -lt 1 -or $dd -gt 31 -or $hh -gt 23 -or $mi -gt 59) {
        Write-Output "ERROR=DateString_out_of_range"
        exit 1
    }

    if ($NonceHex) {
        $nonce = ConvertTo-Bytes $NonceHex
        if ($nonce.Length -ne 6) { Write-Output "ERROR=NonceHex_must_be_6_bytes"; exit 1 }
    }
    else {
        $nonce = New-Object byte[] 6
        (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($nonce)
        (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).Dispose()
    }

    $rec = New-Object byte[] 16
    $rec[0] = 0xC9
    $rec[1] = [byte]$yy
    $rec[2] = [byte]$mm
    $rec[3] = [byte]$dd
    $rec[4] = $nonce[0]
    $rec[5] = $nonce[1]
    $rec[6] = $nonce[2]
    $rec[7] = [byte]$Byte7
    $rec[8] = [byte]$Byte8
    $rec[9] = [byte](0x10 -bor ($RecordIndex -band 0x0F))
    # YY(4) MM(4) DD(5) HH(5) MIN(6) packed over three bytes, as proRFL does.
    $rec[10] = [byte](((($yy -band 0x0F)) -shl 4) -bor ($mm -band 0x0F))
    $rec[11] = [byte]((($dd -band 0x1F) -shl 3) -bor (($hh -shr 2) -band 0x07))
    $rec[12] = [byte]((($hh -band 0x03) -shl 6) -bor ($mi -band 0x3F))
    $rec[13] = $nonce[3]
    $rec[14] = $nonce[4]
    $rec[15] = $nonce[5]

    $recordHex = To-Hex $rec
    $frame = New-Frame ('AA11EC' + $recordHex)
    Write-Output ("date=" + $DateString)
    Write-Output ("record=" + $recordHex)
    Write-Output ("frame=" + (To-Hex $frame))

    $verified = $false
    for ($attempt = 1; $attempt -le $WriteAttempts; $attempt++) {
        $before = Get-CardRecord
        if (-not $before) { $before = 'unreadable' }
        Write-Output ("attempt={0} before={1}" -f $attempt, $before)
        if ($before -eq $recordHex) {
            Write-Output "verify=ok"
            Write-Output "note=record_already_present_no_write_sent"
            exit 0
        }
        Send-Frame $frame
        Start-Sleep -Milliseconds $WriteSettleMs
        $after = Get-CardRecord
        if (-not $after) { $after = 'unreadable' }
        Write-Output ("attempt={0} after={1}" -f $attempt, $after)
        if ($after -eq $recordHex) { $verified = $true; break }
        Start-Sleep -Milliseconds 400
    }

    if (-not $verified) {
        Write-Output "verify=MISMATCH"
        Write-Output "hint=card_write_protected_or_reader_unstable_after_${WriteAttempts}_attempts"
        exit 3
    }
    Write-Output "verify=ok"
    Write-Output "next=insert the card in the lock, then run: -Action read-log"
    exit 0
}

# ---------------------------------------------------------------------------
# read-log : reproduce proRFL.ReadRecord (AA 01 82 29, 37-byte packets)
# ---------------------------------------------------------------------------
if ($Action -eq 'read-log') {
    $current = Get-CardRecord
    if ($current) {
        $type = [Convert]::ToInt32($current.Substring(18, 2), 16)
        Write-Output ("card_type_byte=0x{0:X2}" -f $type)
        if (($type -band 0xF0) -ne 0x10) {
            Write-Output "note=not_a_record_card_the_lock_will_not_have_written_a_log"
        }
    }
    else {
        Write-Output "card=unreadable"
    }

    Send-Frame (ConvertTo-Bytes 'AA018229')
    Start-Sleep -Milliseconds $PacketWaitMs

    $packets = New-Object System.Collections.Generic.List[string]
    $expectedSeq = 0
    $emptyStreak = 0

    for ($i = 0; $i -lt $MaxPackets; $i++) {
        $got = $false
        for ($try = 1; $try -le $PacketRetries; $try++) {
            $resp = Read-Response
            if ($resp[0] -eq 0x55 -and $resp[36] -eq ($expectedSeq -band 0xFF)) {
                $packet = $resp[0..36]
                $hex = To-Hex $packet
                $packets.Add($hex) | Out-Null
                Write-Output ("packet[{0}] seq=0x{1:X2} {2}" -f $i, $expectedSeq, $hex)
                $expectedSeq++
                $got = $true
                break
            }
            Start-Sleep -Milliseconds $PacketIntervalMs
        }
        if (-not $got) {
            $emptyStreak++
            if ($emptyStreak -ge 1) { break }
        }
    }

    if ($packets.Count -eq 0) {
        Write-Output "packets=0"
        Write-Output "note=no_log_streamed"
        Write-Output "hint=the card must be a record card that went through the lock; check card_type_byte above"
        exit 2
    }

    $stream = $packets -join ''
    Write-Output ("packets=" + $packets.Count)
    Write-Output ("stream_bytes=" + ($stream.Length / 2))
    Write-Output ("stream=" + $stream)
    exit 0
}

# ---------------------------------------------------------------------------
# dump-memory : ReadE2 pages of 32 bytes
# ---------------------------------------------------------------------------
if ($Action -eq 'dump-memory') {
    for ($addr = 0; $addr -lt 0x100; $addr += 0x20) {
        $body = 'AA0247' + ('{0:X2}{1:X2}' -f $addr, ($addr -bxor 0xEF))
        Send-Frame (ConvertTo-Bytes $body)
        Start-Sleep -Milliseconds 400
        $resp = Read-Response
        $hex = To-Hex $resp
        # Response: 55 21 01 | 32 data bytes | xor
        $data = if ($resp[0] -eq 0x55 -and $resp[1] -eq 0x21) { To-Hex $resp[3..34] } else { '' }
        Write-Output ("addr=0x{0:X2} data={1}" -f $addr, $data)
        Write-Output ("addr=0x{0:X2} raw={1}" -f $addr, $hex)
        Start-Sleep -Milliseconds 400
    }
    exit 0
}
