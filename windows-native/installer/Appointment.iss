#define AppName "Appointment PMS"
#ifndef AppVersion
  #define AppVersion "1.2.0"
#endif
#define AppPublisher "Connacri"
#define AppExeName "appointment-pms-native.exe"

[Setup]
AppId={{A8D26A8D-7E2F-4E9B-A3D2-5E82D9E9C101}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\Appointment PMS
DefaultGroupName={#AppName}
OutputDir=..\dist
OutputBaseFilename=Appointment-PMS-Setup-v{#AppVersion}
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#AppExeName}

[Files]
Source: "..\target\release\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName}"; Flags: postinstall nowait skipifsilent
