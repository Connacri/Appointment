; Version is injected by CI: ISCC /DAppVersion=<package.json version>
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppName=Appointment PMS
AppVersion={#AppVersion}
AppPublisher=Appointment PMS Lab
DefaultDirName={autopf}\AppointmentPMS
DefaultGroupName=Appointment PMS
OutputDir=..\dist-windows
OutputBaseFilename=Appointment-PMS-Setup-Inno
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-windows\Appointment-PMS-Setup.exe"; DestDir: "{app}"; DestName: "Appointment-PMS.exe"; Flags: ignoreversion
Source: "..\dist-windows\launch.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Appointment PMS"; Filename: "{app}\Appointment-PMS.exe"
Name: "{autodesktop}\Appointment PMS"; Filename: "{app}\Appointment-PMS.exe"

[Run]
Filename: "{app}\Appointment-PMS.exe"; Description: "Launch Appointment PMS"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
