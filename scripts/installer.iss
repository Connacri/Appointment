[Setup]
AppName=Planning Oran
AppVersion=1.0.0
AppPublisher=Planning Oran Lab
DefaultDirName={autopf}\PlanningOran
DefaultGroupName=Planning Oran
OutputDir=dist-windows
OutputBaseFilename=Planning-Oran-Setup-Inno
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist-windows\Planning-Oran-Setup.exe"; DestDir: "{app}"; DestName: "Planning-Oran.exe"; Flags: ignoreversion
Source: "dist-windows\launch.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Planning Oran"; Filename: "{app}\Planning-Oran.exe"
Name: "{autodesktop}\Planning Oran"; Filename: "{app}\Planning-Oran.exe"

[Run]
Filename: "{app}\Planning-Oran.exe"; Description: "Launch Planning Oran"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
