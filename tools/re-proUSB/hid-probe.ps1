<#
.SYNOPSIS
    HID probe / read / write harness for the proUSB card encoder.

.DESCRIPTION
    Mirrors exactly what d12c.dll does (IniUsbPro / FUN_10001a60 / FUN_100018c0):
      - HID class GUID -> SetupDiGetClassDevs(DIGCF_PRESENT|DIGCF_DEVICEINTERFACE)
      - SetupDiEnumDeviceInterfaces + SetupDiGetDeviceInterfaceDetailA
      - CreateFileA(path, ACCESS, FILE_SHARE_READ|WRITE, OPEN_EXISTING)
      - HidD_GetAttributes / HidP_GetCaps
      - write: CreateFile(GENERIC_WRITE) + WriteFile(report[0]=0x40, 64 bytes)
      - read : FILE_FLAG_OVERLAPPED ReadFile + WaitForSingleObject(2000)

    Read-only by default. A write only happens with -Action write -Hex <frame>.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File hid-probe.ps1 -Action probe

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File hid-probe.ps1 -Action read

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File hid-probe.ps1 -Action write -Hex "AA2156FD"
#>
param(
    [ValidateSet('probe', 'desc', 'read', 'write', 'send', 'listen', 'beep')]
    [string]$Action = 'probe',
    [string]$Hex = '',
    [int]$TimeoutMs = 2000,
    [int]$ReadDelayMs = 200,
    [int]$ReportId = 0x40,
    [int]$BeepMs = 700,
    [int]$VendorId = 0x9915,
    [int]$ProductId = 0x1116
)

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class HidProbe
{
    [StructLayout(LayoutKind.Sequential)]
    public struct HIDD_ATTRIBUTES
    {
        public int Size;
        public ushort VendorID;
        public ushort ProductID;
        public ushort VersionNumber;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct HIDP_CAPS
    {
        public ushort Usage;
        public ushort UsagePage;
        public ushort InputReportByteLength;
        public ushort OutputReportByteLength;
        public ushort FeatureReportByteLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 17)]
        public ushort[] Reserved;
        public ushort NumberLinkCollectionNodes;
        public ushort NumberInputButtonCaps;
        public ushort NumberInputValueCaps;
        public ushort NumberInputDataIndices;
        public ushort NumberOutputButtonCaps;
        public ushort NumberOutputValueCaps;
        public ushort NumberOutputDataIndices;
        public ushort NumberFeatureButtonCaps;
        public ushort NumberFeatureValueCaps;
        public ushort NumberFeatureDataIndices;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct SP_DEVICE_INTERFACE_DATA
    {
        public int cbSize;
        public Guid InterfaceClassGuid;
        public int Flags;
        public IntPtr Reserved;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct OVERLAPPED
    {
        public IntPtr Internal;
        public IntPtr InternalHigh;
        public int Offset;
        public int OffsetHigh;
        public IntPtr hEvent;
    }

    [DllImport("hid.dll")]
    public static extern void HidD_GetHidGuid(out Guid guid);
    [DllImport("hid.dll")]
    public static extern bool HidD_GetAttributes(IntPtr h, ref HIDD_ATTRIBUTES a);
    [DllImport("hid.dll")]
    public static extern bool HidD_GetPreparsedData(IntPtr h, out IntPtr pp);
    [DllImport("hid.dll")]
    public static extern bool HidD_FreePreparsedData(IntPtr pp);
    [DllImport("hid.dll")]
    public static extern int HidP_GetCaps(IntPtr pp, ref HIDP_CAPS caps);
    [DllImport("hid.dll", CharSet = CharSet.Unicode)]
    public static extern bool HidD_GetProductString(IntPtr h, StringBuilder buf, int len);
    [DllImport("hid.dll", CharSet = CharSet.Unicode)]
    public static extern bool HidD_GetManufacturerString(IntPtr h, StringBuilder buf, int len);
    [DllImport("hid.dll", CharSet = CharSet.Unicode)]
    public static extern bool HidD_GetSerialNumberString(IntPtr h, StringBuilder buf, int len);

    [DllImport("setupapi.dll", CharSet = CharSet.Ansi)]
    public static extern IntPtr SetupDiGetClassDevs(ref Guid g, IntPtr enumerator, IntPtr hwnd, int flags);
    [DllImport("setupapi.dll")]
    public static extern bool SetupDiEnumDeviceInterfaces(IntPtr set, IntPtr devInfo, ref Guid guid, int index, ref SP_DEVICE_INTERFACE_DATA data);
    [DllImport("setupapi.dll", CharSet = CharSet.Ansi)]
    public static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set, ref SP_DEVICE_INTERFACE_DATA data, IntPtr detail, int detailSize, out int required, IntPtr devInfo);
    [DllImport("setupapi.dll")]
    public static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);

    [DllImport("kernel32.dll", CharSet = CharSet.Ansi, SetLastError = true)]
    public static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr sec, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool ReadFile(IntPtr h, byte[] buf, int toRead, IntPtr read, ref OVERLAPPED ov);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool WriteFile(IntPtr h, byte[] buf, int toWrite, out int written, IntPtr ov);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetOverlappedResult(IntPtr h, ref OVERLAPPED ov, out int transferred, bool wait);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr CreateEvent(IntPtr sec, bool manual, bool initial, IntPtr name);
    [DllImport("kernel32.dll")]
    public static extern uint WaitForSingleObject(IntPtr h, uint ms);
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll")]
    public static extern bool CancelIo(IntPtr h);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool DeviceIoControl(IntPtr h, int code, IntPtr inBuf, int inSize, byte[] outBuf, int outSize, out int returned, IntPtr ov);

    public const int IOCTL_HID_GET_REPORT_DESCRIPTOR = 0x000B0000;

    public const uint GENERIC_WRITE = 0x40000000;
    public const uint FILE_SHARE_RW = 3;
    public const uint OPEN_EXISTING = 3;
    public const uint FILE_FLAG_OVERLAPPED = 0x40000000;
    public static readonly IntPtr INVALID = new IntPtr(-1);

    public static string Hex(byte[] b, int len)
    {
        if (b == null) return "";
        int n = Math.Min(len, b.Length);
        StringBuilder sb = new StringBuilder(n * 3);
        for (int i = 0; i < n; i++)
        {
            sb.Append(b[i].ToString("X2"));
            if (i != n - 1) sb.Append(' ');
        }
        return sb.ToString();
    }

    public static string[] Enumerate()
    {
        List<string> results = new List<string>();
        Guid hidGuid;
        HidD_GetHidGuid(out hidGuid);
        IntPtr set = SetupDiGetClassDevs(ref hidGuid, IntPtr.Zero, IntPtr.Zero, 0x12);
        if (set == INVALID || set == IntPtr.Zero)
        {
            results.Add("ERROR=SetupDiGetClassDevs:" + Marshal.GetLastWin32Error());
            return results.ToArray();
        }

        try
        {
            for (int index = 0; ; index++)
            {
                SP_DEVICE_INTERFACE_DATA did = new SP_DEVICE_INTERFACE_DATA();
                did.cbSize = Marshal.SizeOf(typeof(SP_DEVICE_INTERFACE_DATA));
                if (!SetupDiEnumDeviceInterfaces(set, IntPtr.Zero, ref hidGuid, index, ref did)) break;

                int required = 0;
                SetupDiGetDeviceInterfaceDetail(set, ref did, IntPtr.Zero, 0, out required, IntPtr.Zero);
                if (required <= 0) continue;

                IntPtr detail = Marshal.AllocHGlobal(required);
                try
                {
                    Marshal.WriteInt32(detail, 0, (IntPtr.Size == 8) ? 8 : 6);
                    int got = 0;
                    if (!SetupDiGetDeviceInterfaceDetail(set, ref did, detail, required, out got, IntPtr.Zero)) continue;
                    string path = Marshal.PtrToStringAnsi(new IntPtr(detail.ToInt64() + 4));

                    IntPtr h = CreateFile(path, 0, FILE_SHARE_RW, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
                    if (h == INVALID)
                    {
                        results.Add(path + "|ERROR=open:" + Marshal.GetLastWin32Error());
                        continue;
                    }

                    try
                    {
                        HIDD_ATTRIBUTES attr = new HIDD_ATTRIBUTES();
                        attr.Size = Marshal.SizeOf(typeof(HIDD_ATTRIBUTES));
                        bool hasAttr = HidD_GetAttributes(h, ref attr);

                        HIDP_CAPS caps = new HIDP_CAPS();
                        caps.Reserved = new ushort[17];
                        IntPtr pp;
                        bool hasCaps = false;
                        if (HidD_GetPreparsedData(h, out pp))
                        {
                            hasCaps = (HidP_GetCaps(pp, ref caps) == 0x110000);
                            HidD_FreePreparsedData(pp);
                        }

                        StringBuilder sb = new StringBuilder(260);
                        string product = HidD_GetProductString(h, sb, 260) ? sb.ToString() : "";
                        sb.Clear();
                        string mfg = HidD_GetManufacturerString(h, sb, 260) ? sb.ToString() : "";
                        sb.Clear();
                        string serial = HidD_GetSerialNumberString(h, sb, 260) ? sb.ToString() : "";

                        StringBuilder line = new StringBuilder();
                        line.Append(path);
                        line.Append("|VID=").Append(hasAttr ? attr.VendorID.ToString("X4") : "?");
                        line.Append("|PID=").Append(hasAttr ? attr.ProductID.ToString("X4") : "?");
                        line.Append("|VER=").Append(hasAttr ? attr.VersionNumber.ToString("X4") : "?");
                        line.Append("|USAGE_PAGE=").Append(hasCaps ? caps.UsagePage.ToString("X4") : "?");
                        line.Append("|USAGE=").Append(hasCaps ? caps.Usage.ToString("X4") : "?");
                        line.Append("|IN_LEN=").Append(hasCaps ? caps.InputReportByteLength.ToString() : "?");
                        line.Append("|OUT_LEN=").Append(hasCaps ? caps.OutputReportByteLength.ToString() : "?");
                        line.Append("|FEAT_LEN=").Append(hasCaps ? caps.FeatureReportByteLength.ToString() : "?");
                        line.Append("|MFG=").Append(mfg.Trim());
                        line.Append("|PRODUCT=").Append(product.Trim());
                        line.Append("|SERIAL=").Append(serial.Trim());
                        results.Add(line.ToString());
                    }
                    finally { CloseHandle(h); }
                }
                finally { Marshal.FreeHGlobal(detail); }
            }
        }
        finally { SetupDiDestroyDeviceInfoList(set); }

        return results.ToArray();
    }

    public static string Read(string path, int timeoutMs, int outLen)
    {
        uint[] accessModes = new uint[] { 0x80000000, 0xC0000000, 0 };  /* GENERIC_READ, RW, none */
        IntPtr h = INVALID;
        uint usedAccess = 0;
        int lastErr = 0;

        for (int i = 0; i < accessModes.Length; i++)
        {
            h = CreateFile(path, accessModes[i], FILE_SHARE_RW, IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_OVERLAPPED, IntPtr.Zero);
            if (h != INVALID) { usedAccess = accessModes[i]; break; }
            lastErr = Marshal.GetLastWin32Error();
        }
        if (h == INVALID) return "ERROR=open:" + lastErr;

        IntPtr ev = CreateEvent(IntPtr.Zero, true, false, IntPtr.Zero);
        try
        {
            int len = (outLen > 0) ? outLen : 64;
            byte[] buf = new byte[len];
            OVERLAPPED ov = new OVERLAPPED();
            ov.hEvent = ev;

            bool started = ReadFile(h, buf, len, IntPtr.Zero, ref ov);
            int err = Marshal.GetLastWin32Error();
            if (!started && err != 997)
            {
                return "ERROR=ReadFile:" + err;
            }

            uint wait = WaitForSingleObject(ev, (uint)timeoutMs);
            if (wait == 258)
            {
                CancelIo(h);
                return "RESULT=timeout|WAIT=" + timeoutMs + "ms";
            }
            if (wait != 0) return "RESULT=wait_failed:" + wait;

            int transferred = 0;
            if (!GetOverlappedResult(h, ref ov, out transferred, false))
            {
                return "ERROR=GetOverlappedResult:" + Marshal.GetLastWin32Error();
            }

            return "RESULT=ok|ACCESS=0x" + usedAccess.ToString("X8") + "|BYTES=" + transferred + "|DATA=" + Hex(buf, transferred);
        }
        finally
        {
            CloseHandle(ev);
            CloseHandle(h);
        }
    }

    /* Pending read issued BEFORE the write, then the frame, then wait. */
    public static string ListenAndSend(string path, byte[] frame, int preWaitMs, int postTimeoutMs, int inLen, int outLen)
    {
        IntPtr hr = CreateFile(path, 0x80000000, FILE_SHARE_RW, IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_OVERLAPPED, IntPtr.Zero);
        if (hr == INVALID) return "ERROR=open_read:" + Marshal.GetLastWin32Error();

        IntPtr hw = CreateFile(path, GENERIC_WRITE, FILE_SHARE_RW, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
        int writeOpenErr = (hw == INVALID) ? Marshal.GetLastWin32Error() : 0;

        IntPtr ev = CreateEvent(IntPtr.Zero, true, false, IntPtr.Zero);
        try
        {
            byte[] buf = new byte[inLen];
            OVERLAPPED ov = new OVERLAPPED();
            ov.hEvent = ev;

            bool started = ReadFile(hr, buf, inLen, IntPtr.Zero, ref ov);
            int rerr = Marshal.GetLastWin32Error();
            if (!started && rerr != 997) return "ERROR=read_start:" + rerr;

            System.Threading.Thread.Sleep(preWaitMs);

            if (hw == INVALID) return "ERROR=open_write:" + writeOpenErr;
            int declared = (outLen > 0) ? outLen : 65;
            byte[] report = new byte[declared];
            report[0] = 0x40;
            Array.Copy(frame, 0, report, 1, Math.Min(frame.Length, declared - 1));

            int written = 0;
            if (!WriteFile(hw, report, declared, out written, IntPtr.Zero))
                return "ERROR=WriteFile:" + Marshal.GetLastWin32Error();

            uint wait = WaitForSingleObject(ev, (uint)postTimeoutMs);
            if (wait == 258)
            {
                CancelIo(hr);
                return "WROTE=" + written + "|RESULT=timeout|WAIT=" + postTimeoutMs + "ms";
            }
            if (wait != 0) return "WROTE=" + written + "|RESULT=wait_failed:" + wait;

            int transferred = 0;
            if (!GetOverlappedResult(hr, ref ov, out transferred, false))
                return "WROTE=" + written + "|ERROR=GetOverlappedResult:" + Marshal.GetLastWin32Error();

            return "WROTE=" + written + "|RESULT=ok|BYTES=" + transferred + "|DATA=" + Hex(buf, transferred);
        }
        finally
        {
            CloseHandle(ev);
            CloseHandle(hr);
            if (hw != INVALID) CloseHandle(hw);
        }
    }

    /* Reads the raw HID report descriptor: which report IDs and report sizes exist. */
    public static string Descriptor(string path)
    {
        uint[] accessModes = new uint[] { 0x80000000, 0xC0000000, 0 };
        IntPtr h = INVALID;
        int lastErr = 0;
        for (int i = 0; i < accessModes.Length; i++)
        {
            h = CreateFile(path, accessModes[i], FILE_SHARE_RW, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
            if (h != INVALID) break;
            lastErr = Marshal.GetLastWin32Error();
        }
        if (h == INVALID) return "ERROR=open:" + lastErr;

        try
        {
            byte[] buf = new byte[4096];
            int returned = 0;
            if (!DeviceIoControl(h, IOCTL_HID_GET_REPORT_DESCRIPTOR, IntPtr.Zero, 0, buf, buf.Length, out returned, IntPtr.Zero))
                return "ERROR=ioctl:" + Marshal.GetLastWin32Error();
            return "RESULT=ok|BYTES=" + returned + "|DESC=" + Hex(buf, returned);
        }
        finally { CloseHandle(h); }
    }

    public static string Write(string path, byte[] report, int declaredLen)
    {
        IntPtr h = CreateFile(path, GENERIC_WRITE, FILE_SHARE_RW, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
        if (h == INVALID) return "ERROR=open:" + Marshal.GetLastWin32Error();

        try
        {
            byte[] buf = new byte[declaredLen];
            Array.Copy(report, buf, Math.Min(report.Length, declaredLen));

            int written = 0;
            bool ok = WriteFile(h, buf, declaredLen, out written, IntPtr.Zero);
            int err = Marshal.GetLastWin32Error();
            if (!ok) return "ERROR=WriteFile:" + err + "|REQUESTED=" + declaredLen;
            return "RESULT=ok|SENT=" + written + "|DATA=" + Hex(buf, written);
        }
        finally { CloseHandle(h); }
    }

    /* Same as the DLL: a write handle and a read handle open at the same time. */
    public static string SendAndRead(string path, byte[] frame, int sendDelayMs, int readTimeoutMs, int inLen, int outLen)
    {
        IntPtr hw = CreateFile(path, GENERIC_WRITE, FILE_SHARE_RW, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
        if (hw == INVALID) return "ERROR=open_write:" + Marshal.GetLastWin32Error();

        IntPtr hr = CreateFile(path, 0x80000000, FILE_SHARE_RW, IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_OVERLAPPED, IntPtr.Zero);
        int readOpenErr = (hr == INVALID) ? Marshal.GetLastWin32Error() : 0;

        try
        {
            int declared = (outLen > 0) ? outLen : 65;
            byte[] report = new byte[declared];
            report[0] = 0x40;
            int copy = Math.Min(frame.Length, declared - 1);
            Array.Copy(frame, 0, report, 1, copy);

            int written = 0;
            if (!WriteFile(hw, report, declared, out written, IntPtr.Zero))
                return "ERROR=WriteFile:" + Marshal.GetLastWin32Error() + "|DECLARED=" + declared;

            System.Threading.Thread.Sleep(sendDelayMs);

            if (hr == INVALID) return "WROTE=" + written + "|ERROR=open_read:" + readOpenErr;

            IntPtr ev = CreateEvent(IntPtr.Zero, true, false, IntPtr.Zero);
            try
            {
                byte[] buf = new byte[inLen];
                OVERLAPPED ov = new OVERLAPPED();
                ov.hEvent = ev;

                bool started = ReadFile(hr, buf, inLen, IntPtr.Zero, ref ov);
                int err = Marshal.GetLastWin32Error();
                if (!started && err != 997)
                    return "WROTE=" + written + "|ERROR=ReadFile:" + err;

                uint wait = WaitForSingleObject(ev, (uint)readTimeoutMs);
                if (wait == 258)
                {
                    CancelIo(hr);
                    return "WROTE=" + written + "|RESULT=timeout|WAIT=" + readTimeoutMs + "ms";
                }
                if (wait != 0) return "WROTE=" + written + "|RESULT=wait_failed:" + wait;

                int transferred = 0;
                if (!GetOverlappedResult(hr, ref ov, out transferred, false))
                    return "WROTE=" + written + "|ERROR=GetOverlappedResult:" + Marshal.GetLastWin32Error();

                return "WROTE=" + written + "|RESULT=ok|BYTES=" + transferred + "|DATA=" + Hex(buf, transferred);
            }
            finally { CloseHandle(ev); }
        }
        finally
        {
            CloseHandle(hw);
            if (hr != INVALID) CloseHandle(hr);
        }
    }
}
'@ -Language CSharp

function Select-Target {
    param([string[]]$Lines)
    $hits = @()
    foreach ($line in $Lines) {
        if ($line -match '\|VID=([0-9A-F]{4})\|PID=([0-9A-F]{4})') {
            $v = [Convert]::ToInt32($matches[1], 16)
            $p = [Convert]::ToInt32($matches[2], 16)
            if ($v -eq $VendorId -and $p -eq $ProductId) { $hits += $line }
        }
    }
    return $hits
}

$all = [HidProbe]::Enumerate()
Write-Output ("hid_interfaces_total=" + $all.Count)
foreach ($line in $all) { Write-Output ("iface|" + $line) }

$targets = @(Select-Target -Lines $all)
Write-Output ("target_matches=" + $targets.Count)
foreach ($t in $targets) { Write-Output ("target|" + $t) }

if ($targets.Count -eq 0) {
    Write-Output "RESULT=no_matching_device"
    exit 2
}

$path = ($targets[0] -split '\|')[0]
$outLen = 64
if ($targets[0] -match '\|IN_LEN=(\d+)') { $outLen = [int]$matches[1] }

function New-ReportBuffer {
    param([string]$FrameHex)
    $clean = ($FrameHex -replace '[^0-9A-Fa-f]', '')
    $count = [int]($clean.Length / 2)
    $buf = New-Object byte[] $outLen
    $buf[0] = [byte]$ReportId
    for ($i = 0; $i -lt $count; $i++) {
        if (($i + 1) -lt $outLen) {
            $buf[$i + 1] = [Convert]::ToByte($clean.Substring($i * 2, 2), 16)
        }
    }
    return $buf
}

switch ($Action) {
    'probe' {
        Write-Output ("selected_path=" + $path)
        Write-Output ("in_report_bytes=" + $outLen)
        Write-Output "PROBE_DONE"
    }
    'read' {
        Write-Output ("selected_path=" + $path)
        Write-Output ("reading up to " + $TimeoutMs + " ms ...")
        $r = [HidProbe]::Read($path, $TimeoutMs, $outLen)
        Write-Output ("read__" + $r)
    }
    'desc' {
        Write-Output ("selected_path=" + $path)
        $d = [HidProbe]::Descriptor($path)
        Write-Output ("desc__" + $d)
    }
    'write' {
        $clean = ($Hex -replace '[^0-9A-Fa-f]', '')
        if ($clean.Length -lt 2) { Write-Output "ERROR=hex_required"; exit 1 }
        $payload = New-Object byte[] ($clean.Length / 2)
        for ($i = 0; $i -lt $payload.Length; $i++) {
            $payload[$i] = [Convert]::ToByte($clean.Substring($i * 2, 2), 16)
        }
        $declared = $outLen
        if ($payload.Length -gt $declared) { $declared = $payload.Length }

        Write-Output ("selected_path=" + $path)
        Write-Output ("frame_bytes=" + $payload.Length + " declared_report_bytes=" + $declared)
        $w = [HidProbe]::Write($path, $payload, $declared)
        Write-Output ("write__" + $w)
    }
    'send' {
        $clean = ($Hex -replace '[^0-9A-Fa-f]', '')
        if ($clean.Length -lt 2) { Write-Output "ERROR=hex_required"; exit 1 }
        $payload = New-Object byte[] ($clean.Length / 2)
        for ($i = 0; $i -lt $payload.Length; $i++) {
            $payload[$i] = [Convert]::ToByte($clean.Substring($i * 2, 2), 16)
        }

        Write-Output ("selected_path=" + $path)
        Write-Output ("frame=" + $Hex + " read_delay_ms=" + $ReadDelayMs + " read_timeout_ms=" + $TimeoutMs)
        $r = [HidProbe]::SendAndRead($path, $payload, $ReadDelayMs, $TimeoutMs, $outLen, $outLen)
        Write-Output ("send__" + $r)
    }
    'listen' {
        $clean = ($Hex -replace '[^0-9A-Fa-f]', '')
        if ($clean.Length -lt 2) { Write-Output "ERROR=hex_required"; exit 1 }
        $payload = New-Object byte[] ($clean.Length / 2)
        for ($i = 0; $i -lt $payload.Length; $i++) {
            $payload[$i] = [Convert]::ToByte($clean.Substring($i * 2, 2), 16)
        }

        Write-Output ("selected_path=" + $path)
        Write-Output ("listen: pending read, then frame " + $Hex)
        $r = [HidProbe]::ListenAndSend($path, $payload, 80, $TimeoutMs, $outLen, $outLen)
        Write-Output ("listen__" + $r)
    }
    'beep' {
        Write-Output ("selected_path=" + $path)
        Write-Output ("beep: report_id=0x" + $ReportId.ToString("X2") + " duration=" + $BeepMs + "ms")
        $on = New-ReportBuffer -FrameHex "AA02800129"
        $off = New-ReportBuffer -FrameHex "AA02800028"
        Write-Output ("beep_on__" + [HidProbe]::Write($path, $on, $outLen))
        Start-Sleep -Milliseconds $BeepMs
        Write-Output ("beep_off__" + [HidProbe]::Write($path, $off, $outLen))
    }
}
