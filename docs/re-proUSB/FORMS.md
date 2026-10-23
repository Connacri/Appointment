# Recovered Delphi forms (CardLock.Exe)

## TData1 — `Data1`

- `TData1:Data1` — OnCreate=DataModuleCreate

## TData2 — `Data2`


## TDSSCubeEditor — `DSSCubeEditor`

- `TDSSCubeEditor:DSSCubeEditor` — "Decision Cube Editor" | OnKeyPress=FormKeyPress
  - `TPageControl:Pager` — OnChange=PagerChange
    - `TTabSheet:DimensionInfo` — "Dimension Settings"
      - `TLabel:CaptionLabel` — "Display &Name"
      - `TLabel:ActiveLabel` — "&Active Type"
      - `TLabel:BinLabel` — "&Grouping"
      - `TLabel:StartLabel` — "&Initial Value"
      - `TLabel:TypeLabel` — "&Type"
      - `TLabel:Label1` — "Available &Fields"
      - `TLabel:Label2` — "For&mat"
      - `TLabel:BaseNameLabel` — "&Base Field"
      - `TListBox:FieldList` — OnClick=FieldListClick OnDblClick=FieldListClick
      - `TEdit:CaptionEdit` — "CaptionEdit" | OnChange=HandleFieldEdit
      - `TComboBox:ActiveEdit` — "ActiveEdit" | OnChange=HandleFieldEdit | Hint="Control of when the information for this field is loaded"
      - `TComboBox:BinEdit` — "BinEdit" | OnChange=HandleFieldEdit | Hint="Group values for this field into ranges"
      - `TComboBox:TypeEdit` — "TypeEdit" | OnChange=HandleFieldEdit
      - `TEdit:FormatEdit` — "FormatEdit" | OnChange=HandleFieldEdit
      - `TMaskEdit:StartEdit` — OnChange=HandleFieldEdit | Hint="Starting value for date ranges, Intial value for single valued dimensions"
      - `TMaskEdit:BaseNameEdit` — "BaseNameEdit" | OnChange=HandleFieldEdit | Hint="Fieldname (for a summary, the original field used to calculate the summary)"
    - `TTabSheet:MemoryControl` — "Memory Control"
      - `TGroupBox:Panel1` — "Designer Data Options" | Hint="Control whether to load the decision cube at design time"
        - `TRadioButton:RadioMetaData` — "Display Dimension &Names" | OnClick=RadioMetaDataClick
        - `TRadioButton:RadioDimensionData` — "Display Names and &Values" | OnClick=RadioDimensionDataClick
        - `TRadioButton:RadioAllData` — "Display Names, Values, and &Totals" | OnClick=RadioAllDataClick
        - `TRadioButton:RadioNoData` — "&Run Time Display Only" | OnClick=RadioNoDataClick
      - `TGroupBox:CubeLimits` — "Cube Maximums"
        - `TLabel:NActiveDims` — "0"
        - `TLabel:nDemandDims` — "0"
        - `TLabel:Label4` — "Active"
        - `TLabel:Label7` — "Active+Needed"
        - `TLabel:Label9` — "&Dimensions"
        - `TLabel:NActiveSums` — "0"
        - `TLabel:NDemandSums` — "0"
        - `TLabel:Label6` — "&Summaries"
        - `TLabel:Label12` — "&Cells"
        - `TLabel:nDemandCells` — "0"
        - `TLabel:Label5` — "Maximum"
        - `TLabel:Label3` — "Current"
        - `TLabel:nCurrDims` — "0"
        - `TLabel:nCurrSums` — "0"
        - `TLabel:nCurrCells` — "0"
        - `TEdit:MaxDims` — Hint="Limit on the number of dimensions which can be loaded at one time"
        - `TEdit:MaxSums` — Hint="Limit on the number of summaries which can be loaded at one time"
        - `TEdit:MaxCells` — Hint="Limit on the number of storage cells which can be loaded at one time"
        - `TButton:GetCellCounts` — "&Get Cell Counts" | OnClick=GetCellCountsClick | Hint="Run a query to fetch information required to estimate cell usage"
  - `TButton:OKButton` — "OK" | OnClick=OKButtonClick
  - `TButton:CancelButton` — "Cancel" | OnClick=CancelButtonClick
  - `TButton:HelpButton` — "&Help" | OnClick=HelpButtonClick

## TfrmKeysForStaff — `frmKeysForStaff`

- `TfrmKeysForStaff:frmKeysForStaff` — "Keys For Staff" | OnClose=FormClose OnCreate=FormCreate OnShow=FormShow
  - `TBitBtn:cmdExit` — "E&xit"
  - `TGroupBox:GroupBox1` — "Keys For Open Door"
    - `TBitBtn:cmdFloorCard` — "Floor Card" | OnClick=cmdFloorCardClick
    - `TBitBtn:cmdBuildingCard` — "Building Card" | OnClick=cmdBuildingCardClick
    - `TBitBtn:cmdMasterCard` — "Master Card" | OnClick=cmdMasterCardClick
    - `TBitBtn:cmdEmergencyCard` — "Emergency Card" | OnClick=cmdEmergencyCardClick
    - `TBitBtn:cmdGroupCard` — "Group Card" | OnClick=cmdGroupCardClick
  - `TGroupBox:GroupBox2` — "Function Cards"
    - `TBitBtn:cmdRecordCard` — "Record Card" | OnClick=cmdRecordCardClick
    - `TBitBtn:cmdBlackNameCard` — "Black Name Card" | OnClick=cmdBlackNameCardClick
    - `TBitBtn:cmdCheckOutCard` — "Check-Out Card" | OnClick=cmdCheckOutCardClick
  - `TGroupBox:GroupBox3` — "Cards"
      - `TLabel:Label1` — "Holder"
      - `TLabel:Label7` — "Memo"
      - `TEdit:edtMemo` — OnKeyDown=edtMemoKeyDown OnKeyPress=edtMemoKeyPress
      - `TBitBtn:cmdIssueCard` — "Issue Card" | OnClick=cmdIssueCardClick
        - `TCheckBox:chkCoverCardsBefore` — "Cover Cards Before"
        - `TCheckBox:chkOpenPublicDoor` — "Open Public Door" | OnClick=chkOpenPublicDoorClick
        - `TCheckBox:chkAccessBolt` — "Access Bolt"
      - `TBitBtn:cmdSearchCardNo` — "Search" | OnClick=cmdSearchCardNoClick
        - `TLabel:Label5` — "Building Name"
        - `TLabel:Label6` — "Floor No."
        - `TLabel:Label2` — "Expired Date"
        - `TLabel:Label3` — "Time"
        - `TLabel:Label4` — "-->"
        - `TComboBox:cmbBuildingName` — OnChange=cmbBuildingNameChange
  - `TTimer:Timer1` — OnTimer=Timer1Timer

## TfrmLockConfiguration — `frmLockConfiguration`

- `TfrmLockConfiguration:frmLockConfiguration` — "Lock Configuration" | OnClose=FormClose OnCreate=FormCreate OnKeyDown=FormKeyDown OnShow=FormShow
  - `TBitBtn:cmdExit` — "E&xit"
  - `TGroupBox:GroupBox1` — "Normal Configuration" | Hint="Normal Setup for Lock"
    - `TBitBtn:cmdResetCard` — "Reset Card" | OnClick=cmdResetCardClick | Hint="1st step, Reset the Lock"
  - `TGroupBox:GroupBox2` — "Extra Configuration" | Hint="Extra Setup for Lock"
    - `TBitBtn:cmdRoomNoSetting` — "RoomNo. Setting" | OnClick=cmdRoomNoSettingClick | Hint="2nd step, Set a RoomNo. to Lock"
    - `TBitBtn:cmdClockSetting` — "Lock Clock Setting" | OnClick=cmdClockSettingClick | Hint="3rd, Initialize the Lock Clock"
    - `TBitBtn:cmdGroupNoSetting` — "GroupNo. Setting" | OnClick=cmdGroupNoSettingClick OnMouseMove=cmdGroupNoSettingMouseMove | Hint="GroupNo."
  - `TGroupBox:GroupBox3` — "Cards"
      - `TLabel:Label1` — "Holder"
      - `TLabel:Label2` — "Bld-Room No./CurrentTime/Group No."
      - `TLabel:Label3` — "Set/Clear One/All Group(s)"
      - `TBitBtn:cmdSearchRoomNo` — "Search" | OnClick=cmdSearchRoomNoClick
      - `TEdit:Edit1` — OnKeyPress=Edit1KeyPress
      - `TBitBtn:cmdIssueCard` — "Issue Card" | OnClick=cmdIssueCardClick
      - `TCheckBox:chkCover` — "Cover Cards Before"
  - `TGroupBox:GroupBox4` — "Guide"
  - `TTimer:Timer1` — OnTimer=Timer1Timer
  - `TTimer:Timer2` — OnTimer=Timer2Timer
    - `TMenuItem:SetOneGroup` — "Clear One Group" | OnClick=ClearOneGroupClick
    - `TMenuItem:ClearOneGroup` — "Set One Group" | OnClick=SetOneGroupClick
    - `TMenuItem:SetAllGroups` — "Clear All Groups" | OnClick=ClearAllGroupsClick
    - `TMenuItem:ClearAllGroups` — "Set All Groups" | OnClick=SetAllGroupsClick

## TfrmLogon — `frmLogon`

- `TfrmLogon:frmLogon` — "Logon" | OnClose=FormClose OnCreate=FormCreate OnShow=FormShow
  - `TLabel:Label1` — "Code"
  - `TLabel:Label2` — "Password"
  - `TLabel:Label3` — "WELCOME"
  - `TEdit:edtMiMa` — OnKeyDown=edtMiMaKeyDown | Hint="Press F5 For Help"
  - `TComboBox:edtGongHao` — OnChange=edtGongHaoChange OnExit=edtGongHaoExit OnKeyDown=edtGongHaoKeyDown
  - `TBitBtn:cmdEntry` — "Entry" | OnClick=cmdEntryClick
  - `TBitBtn:cmdExit` — "E&xit" | OnClick=cmdExitClick
  - `TBitBtn:cmdModiMiMa` — OnClick=cmdModiMiMaClick

## TfrmMain — `frmMain`

- `TfrmMain:frmMain` — "Card Lock Management System" | OnClose=FormClose OnCreate=FormCreate OnKeyDown=FormKeyDown OnShow=FormShow
  - `TLabel:Label1` — "Hotel Name"
  - `TLabel:Label3` — "Operator:"
  - `TLabel:Label2` — "Version:"
  - `TLabel:Label4` — "Ver"
  - `TLabel:Label5` — "Admin"
  - `TLabel:Label6` — "Please set the screen to 1024x768"
  - `TLabel:Label7` — "For Door Lock Installation Only"
  - `TImage:Image2` — OnDblClick=Image2DblClick
  - `TBitBtn:cmdReceiption` — "Receiption" | OnClick=cmdReceiptionClick | Hint="Check In"
  - `TBitBtn:cmdRoomsDefination` — "Rooms Defination" | OnClick=cmdRoomsDefinationClick
  - `TBitBtn:cmdLocksConfiguration` — "Locks Configuration" | OnClick=cmdLocksConfigurationClick
  - `TBitBtn:cmdKeysForStaff` — "Keys for Staff" | OnClick=cmdKeysForStaffClick
  - `TBitBtn:cmdSystemMaintenance` — "System Maintenance" | OnClick=cmdSystemMaintenanceClick
  - `TBitBtn:cmdExit` — "E&xit" | OnClick=cmdExitClick
  - `TBitBtn:cmdAbout` — "&About" | OnClick=cmdAboutClick
  - `TBitBtn:cmdReports` — "Reports" | OnClick=cmdReportsClick
  - `TTimer:Timer1` — OnTimer=Timer1Timer

## TfrmReceiption — `frmReceiption`

- `TfrmReceiption:frmReceiption` — "Reception" | OnClose=FormClose OnCreate=FormCreate OnKeyDown=FormKeyDown OnShow=FormShow
  - `TLabel:lblBldNo` — "BldNo"
  - `TPanel:Panel2` — "2" | Hint="Floor"
  - `TComboBox:cmbBuildingName` — OnCloseUp=cmbBuildingNameCloseUp
    - `TBitBtn:BitBtn1` — "BitBtn1" | OnClick=BitBtn1Click
    - `TTntScrollBar:ScrlBar1` — OnChange=ScrlBar1Change
    - `TButton:Button1` — "-" | OnClick=Button1Click
    - `TButton:Button2` — "+" | OnClick=Button2Click
  - `TBitBtn:cmdExit` — "E&xit"
  - `TBitBtn:cmdWalkIn` — "Walk In" | OnClick=cmdWalkInClick
  - `TBitBtn:cmdTeamIn` — "Team In" | OnClick=cmdTeamInClick OnMouseMove=cmdTeamInMouseMove
  - `TBitBtn:cmdCardInfo` — "Card Info" | OnClick=cmdCardInfoClick
  - `TBitBtn:cmdCardErase` — "Card Erase" | OnClick=cmdCardEraseClick
  - `TBitBtn:cmdDispChart` — "Display Chart" | OnClick=cmdDispChartClick
  - `TBitBtn:cmdModiRoomStatus` — "Modify Room Status" | OnClick=cmdModiRoomStatusClick
    - `TBitBtn:BitBtnVC` — "BitBtnVC" | OnClick=BitBtnVCClick
    - `TBitBtn:BitBtnOH` — "BitBtnOH" | OnClick=BitBtnOHClick
    - `TBitBtn:BitBtnVD` — "BitBtnVD" | OnClick=BitBtnVDClick
    - `TBitBtn:BitBtnOO` — "BitBtnOO" | OnClick=BitBtnOOClick
    - `TBitBtn:BitBtnOC_WalkIn` — "BitBtnOC_WalkIn" | OnClick=BitBtnOC_WalkInClick
    - `TBitBtn:BitBtnOC_Team` — "BitBtnOC_Team" | OnClick=BitBtnOC_TeamClick
    - `TBitBtn:BitBtnTO` — "BitBtnTO" | OnClick=BitBtnTOClick
    - `TStringGrid:GridRoomStatus` — OnClick=GridRoomStatusClick OnDblClick=GridRoomStatusDblClick OnDrawCell=GridRoomStatusDrawCell OnKeyDown=GridRoomStatusKeyDown
    - `TGroupBox:GroupBox1` — "Guide"
    - `TBitBtn:cmdCloseModiRoomStatus` — "Close" | OnClick=cmdCloseModiRoomStatusClick
    - `TBitBtn:BitBtnVC2` — OnClick=BitBtnVCClick
    - `TBitBtn:BitBtnOH2` — OnClick=BitBtnOHClick
    - `TBitBtn:BitBtnTO2` — OnClick=BitBtnTOClick
    - `TBitBtn:BitBtnVD2` — OnClick=BitBtnVDClick
    - `TBitBtn:BitBtnOO2` — OnClick=BitBtnOOClick
    - `TBitBtn:BitBtnOC2` — OnClick=BitBtnOC_WalkInClick
    - `TBitBtn:BitBtnTeam2` — OnClick=BitBtnOC_TeamClick
    - `TPanel:pnlBuildingName` — "pnlBuildingName"
    - `TGroupBox:GroupBox3` — "Rooms Allocation"
      - `TLabel:lblAllVCRooms` — "All VC Rooms"
      - `TLabel:lblRoomsSelected` — "Rooms Selected"
      - `TListBox:ListBox1` — OnClick=ListBox1Click OnDblClick=cmdSelectClick OnKeyDown=ListBox1KeyDown
      - `TListBox:ListBox2` — OnClick=ListBox2Click OnDblClick=cmdUnSelectClick OnKeyDown=ListBox2KeyDown
      - `TBitBtn:cmdSelect` — OnClick=cmdSelectClick
      - `TBitBtn:cmdUnSelect` — OnClick=cmdUnSelectClick
    - `TGroupBox:GroupBox2` — "Guest Information"
      - `TLabel:lblSex` — "Sex"
      - `TLabel:lblCType` — "Credential Type"
      - `TLabel:lblCNo` — "Credential No."
      - `TLabel:lblPrice` — "Price"
      - `TLabel:lblDeposit` — "Deposit"
      - `TLabel:lblMemo` — "Memo"
      - `TLabel:lblCheckIn` — "Check In"
      - `TLabel:lblCheckOut` — "Check Out"
      - `TLabel:lblGuestName` — "GuestName"
      - `TComboBox:cmbName` — "cmbName" | OnSelect=cmbNameSelect
      - `TComboBox:cmbSex` — "cmbSex"
      - `TEdit:edtPrice` — OnKeyPress=edtPriceKeyPress
      - `TEdit:edtDeposit` — OnKeyPress=edtPriceKeyPress
      - `TComboBox:cmbCType` — "cmbCType"
      - `TLabel:lblRoomNo` — "[F3]Room No."
      - `TLabel:lblExpiredDate` — "Expiry"
      - `TLabel:lblDays` — "Days"
      - `TLabel:lblCardCount1` — "Card Count:"
      - `TLabel:lblCardCount2` — "5"
      - `TLabel:lblRoomType` — "Room Type"
      - `TLabel:lblRoomStatus` — "Room Status"
      - `TLabel:lblMenu` — "lblMenu"
      - `TLabel:lblReservationCheckIn` — "Reservation Check-In"
      - `TEdit:edtRoomNo` — "101" | OnEnter=edtRoomNoEnter OnExit=edtRoomNoExit OnKeyDown=edtRoomNoKeyDown
      - `TBitBtn:cmdSearchRoomNo` — "Search" | OnClick=cmdSearchRoomNoClick
      - `TSpinEdit:sedtDays` — OnChange=sedtDaysChange OnKeyDown=sedtDaysKeyDown
      - `TCheckBox:chkHourRate` — "Hour-rate Room" | OnClick=chkHourRateClick
      - `TCheckBox:chkCover` — "New Check In && Cover Cards Before" | OnClick=chkCoverClick
      - `TDateTimePicker:DateTimePicker1` — OnChange=DateTimePicker1Change
      - `TDateTimePicker:DateTimePicker2` — OnChange=DateTimePicker2Change
      - `TBitBtn:cmdIssueCard` — "Issue Guest Card" | OnClick=cmdIssueCardClick
      - `TBitBtn:cmdCheckOutNoCard` — "Check Out" | OnClick=cmdCheckOutNoCardClick
      - `TBitBtn:cmdCloseGuest` — "Close" | OnClick=cmdCloseGuestClick
      - `TBitBtn:cmdDetail` — "Detail >>" | OnClick=cmdDetailClick
      - `TDateTimePicker:DateTimePicker3` — OnChange=DateTimePicker3Change
      - `TDateTimePicker:DateTimePicker4` — OnChange=DateTimePicker4Change
      - `TCheckBox:chkVIP` — "VIP" | OnClick=chkVIPClick
      - `TCheckBox:chkChangKai` — "N.O." | OnClick=chkVIPClick | Hint="Normally Open"
    - `TMemo:memRoom` — OnDblClick=memRoomDblClick | Hint="Press F4 to toggle  this Memo"
  - `TBitBtn:cmdCheckOutByCard` — "Check Out By Card" | OnClick=cmdCheckOutByCardClick
  - `TBitBtn:cmdChange` — "Room Change" | OnClick=cmdChangeClick
  - `TBitBtn:cmdPostponed` — "Postpone" | OnClick=cmdPostponedClick
  - `TBitBtn:cmdReservation` — "Reservation" | OnClick=cmdReservationClick OnMouseMove=cmdReservationMouseMove
  - `TTimer:Timer1` — OnTimer=Timer1Timer
  - `TTimer:Timer2` — OnTimer=Timer2Timer
    - `TMenuItem:GroupCheckIn` — "Group Check-In" | OnClick=GroupCheckInClick
    - `TMenuItem:GroupView` — "Group View" | OnClick=GroupViewClick
    - `TMenuItem:Reservation` — "Reservation" | OnClick=ReservationClick
    - `TMenuItem:ReservationCheckIn` — "Reservation Check-In" | OnClick=ReservationCheckInClick

## TfrmReports — `frmReports`

- `TfrmReports:frmReports` — "Reports" | OnClose=FormClose OnCreate=FormCreate OnShow=FormShow
    - `TLabel:lblRoomNo` — "1-205"
    - `TComboBox:cmbReport` — OnChange=cmbReportChange
    - `TBitBtn:cmdOption` — "Option" | OnClick=cmdOptionClick
    - `TBitBtn:cmdPrint` — "Print" | OnClick=cmdPrintClick
    - `TBitBtn:cmdExcel` — "Export to Excel" | OnClick=cmdExcelClick
    - `TBitBtn:cmdDel` — "Delete" | OnClick=cmdDelClick
    - `TBitBtn:cmdExit` — "E&xit"
    - `TBitBtn:cmdUpLoad` — "UpLoad" | OnClick=cmdUpLoadClick
    - `TStringGrid:GridReport` — OnClick=GridReportClick OnDblClick=GridReportDblClick OnDrawCell=GridReportDrawCell OnKeyDown=GridReportKeyDown
  - `TRzPanel:RzPanel2` — OnDblClick=RzPanel2DblClick
    - `TGroupBox:gbCheckIn` — "Check In"
      - `TLabel:Label4` — "-->"
    - `TGroupBox:gbCardType` — "Card Type"
    - `TGroupBox:gbOrderBy` — "Order By"
    - `TGroupBox:gbName` — "Guest Name"
    - `TBitBtn:cmdOK` — "OK" | OnClick=cmdOKClick
    - `TBitBtn:cmdCancel` — "Cancel" | OnClick=cmdCancelClick
    - `TGroupBox:gbGongHao` — "GongHao"
    - `TGroupBox:gbRoomNo` — "Room No."
      - `TBitBtn:cmdSearchRoomNo` — "Search" | OnClick=cmdSearchRoomNoClick
    - `TGroupBox:gbCheckOut` — "Check Out"
      - `TLabel:Label1` — "-->"
    - `TButton:Button1` — "清理数据库" | OnClick=Button1Click

## TfrmRoomsDefination — `frmRoomsDefination`

- `TfrmRoomsDefination:frmRoomsDefination` — "Rooms Defination" | OnClose=FormClose OnCreate=FormCreate OnKeyDown=FormKeyDown OnShow=FormShow
  - `TLabel:Label1` — "List of Buildings"
  - `TLabel:Label2` — "List of Rooms"
  - `TBitBtn:cmdExit` — "E&xit"
  - `TStringGrid:GridBlds` — OnClick=GridBldsClick OnDrawCell=GridBldsDrawCell OnKeyDown=GridBldsKeyDown
  - `TStringGrid:GridRooms` — OnClick=GridRoomsClick OnDblClick=GridRoomsDblClick OnDrawCell=GridRoomsDrawCell OnKeyDown=GridRoomsKeyDown
    - `TSpeedButton:cmdAddBld` — "Insert A New Building" | OnClick=cmdAddBldClick | Hint="Add a New Building"
    - `TSpeedButton:cmdDelBld` — "Remove a Building" | OnClick=cmdDelBldClick
    - `TSpeedButton:cmdModiBld` — "Modify Building Name" | OnClick=cmdModiBldClick
    - `TSpeedButton:cmdAddRoom` — "Insert New Room(s)" | OnClick=cmdAddRoomClick | Hint="Add a New Building"
    - `TSpeedButton:cmdDelRoom` — "Remove a Room" | OnClick=cmdDelRoomClick
    - `TSpeedButton:cmdModiRoom` — "Modify Room's Information" | OnClick=cmdModiRoomClick

## TfrmSystemMaintenance — `frmSystemMaintenance`

- `TfrmSystemMaintenance:frmSystemMaintenance` — "System Maintenance" | OnClose=FormClose OnCreate=FormCreate OnKeyDown=FormKeyDown OnShow=FormShow
  - `TBitBtn:cmdExit` — "E&xit"
    - `TTabSheet:TabSheet1` — "Options" | OnShow=TabSheet1Show
      - `TLabel:Label2` — "Check-Out"
      - `TLabel:Label1` — "Hotel Name"
      - `TLabel:Label5` — "Path of DB Backup"
      - `TLabel:Label8` — "VIP Check-Out"
      - `TCheckBox:chkGuestLLock` — "Guest Access Bolt"
      - `TGroupBox:GroupBox1` — "Extra Options"
        - `TCheckBox:chkAlarm` — "Alarm While Lockpin Forced "
        - `TCheckBox:chkRemind` — "Remind to Close Door"
        - `TCheckBox:chkNoDisturb` — "Don't Disturb"
        - `TCheckBox:chkKnob` — "Lock After Release Knob"
        - `TCheckBox:chkMusic` — "Music "
        - `TCheckBox:chkCover` — "Ignore Cover Function"
        - `TBitBtn:cmdReturnToDefault` — "Return To Default" | OnClick=cmdReturnToDefaultClick
      - `TEdit:edtHotelName` — OnKeyDown=edtHotelNameKeyDown
      - `TBitBtn:cmdSave` — "Save" | OnClick=cmdSaveClick
      - `TRadioButton:rbCheckOutToVC` — "Check Out To VC"
      - `TRadioButton:rbCheckOutToVD` — "Check Out To VD"
      - `TEdit:edtBakPath` — OnKeyDown=edtHotelNameKeyDown
    - `TTabSheet:TabSheet2` — "System Registe" | OnShow=TabSheet2Show
      - `TLabel:Label3` — "Steps of System Registe:"
      - `TLabel:Label6` — "Step 1: Get the Device No. and tell it to the vendor"
      - `TLabel:lblReaderNo` — "lblReaderNo"
      - `TLabel:Label7` — "Step 2: Input the Serial No. and  Click Registe"
      - `TEdit:edtRegistor1` — OnChange=edtRegistor1Change OnKeyPress=edtRegistor1KeyPress
      - `TEdit:edtRegistor2` — OnChange=edtRegistor1Change OnKeyPress=edtRegistor1KeyPress
      - `TEdit:edtRegistor3` — OnChange=edtRegistor1Change OnKeyPress=edtRegistor1KeyPress
      - `TEdit:edtRegistor4` — OnChange=edtRegistor1Change OnKeyPress=edtRegistor1KeyPress
      - `TBitBtn:cmdRegiste` — "Registe" | OnClick=cmdRegisteClick
      - `TGroupBox:GroupBox2` — "Guide"
      - `TCheckBox:chkTest` — "For Test Only" | OnClick=chkTestClick
    - `TTabSheet:TabSheet3` — "Operator Management" | OnShow=TabSheet3Show
      - `TLabel:Label4` — "List of Operators"
      - `TStringGrid:GridOperators` — OnClick=GridOperatorsClick OnDrawCell=GridOperatorsDrawCell OnKeyDown=GridOperatorsKeyDown
      - `TBitBtn:cmdAddOprt` — "Add a New Operator" | OnClick=cmdAddOprtClick
      - `TBitBtn:cmdRemoveOprt` — "Remove a Operator" | OnClick=cmdRemoveOprtClick
      - `TBitBtn:cmdModiOprt` — "Modify Operator's Data" | OnClick=cmdModiOprtClick
      - `TGroupBox:GroupBox5` — "Type of Operator"
        - `TRadioButton:RadioSuperAdmin` — "Super Administrator"
        - `TRadioButton:RadioAdmin` — "Administrator"
        - `TRadioButton:RadioManager` — "Manager"
        - `TRadioButton:RadioGenOprt` — "General Operator"

## TLoginDialog — `LoginDialog`

- `TLoginDialog:LoginDialog` — "Database Login" | OnShow=FormShow
  - `TButton:OKButton` — "&OK"
  - `TButton:CancelButton` — "Cancel"
    - `TLabel:Label3` — "Database:"
      - `TLabel:Label1` — "&User Name:"
      - `TLabel:Label2` — "&Password:"

## TPasswordDialog — `PasswordDialog`

- `TPasswordDialog:PasswordDialog` — "Enter password"
  - `TButton:OKButton` — "&OK" | OnClick=OKButtonClick
  - `TButton:CancelButton` — "Cancel"
  - `TGroupBox:GroupBox1` — "Password"
    - `TEdit:Edit` — OnChange=EditChange
    - `TButton:AddButton` — "&Add" | OnClick=AddButtonClick
    - `TButton:RemoveButton` — "&Remove" | OnClick=RemoveButtonClick
    - `TButton:RemoveAllButton` — "Re&move all" | OnClick=RemoveAllButtonClick

## TProgressDialog — `ProgressDialog`

- `TProgressDialog:ProgressDialog` — "ProgressDialog" | OnActivate=FormActivate OnCreate=FormCreate
  - `TButton:CancelButton` — "&Cancel" | OnClick=CancelButtonClick
  - `TStaticText:StatusText` — "StatusText"

## TRzFrmCustomizeToolbar — `RzFrmCustomizeToolbar`

- `TRzFrmCustomizeToolbar:RzFrmCustomizeToolbar` — "Customize Toolbar" | OnCreate=FormCreate
  - `TSpeedButton:BtnSpacer` — Hint="Add a Spacer"
  - `TSpeedButton:BtnGrooveSpacer` — Hint="Add a Grooved Spacer"
  - `TRzLabel:LblHint` — "LblHint"
  - `TRzLabel:LblTextOptions` — "LblTextOptions"
  - `TRzButton:BtnClose` — "Close"
  - `TRzCheckList:LstControls` — OnChange=LstControlsChange OnClick=LstControlsClick OnDragDrop=LstControlsDragDrop OnDragOver=LstControlsDragOver OnDrawItem=ListBoxDrawItem OnEndDrag=LstControlsEndDrag OnMouseDown=LstControlsMouseDown
  - `TRzComboBox:CbxTextOptions` — OnClick=CbxTextOptionsClick
  - `TRzButton:BtnMoveUp` — "MoveUp" | OnClick=BtnMoveUpClick
  - `TRzButton:BtnMoveDown` — "MoveDown" | OnClick=BtnMoveDownClick
  - `TTimer:Timer1` — OnTimer=Timer1Timer
