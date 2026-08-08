; Extensions for Tauri's official NSIS template. The upstream uninstaller already
; deletes only declared binaries/resources and uses non-recursive RMDir for $INSTDIR.

!include nsDialogs.nsh
!include "${__FILEDIR__}\..\resources\install-manifest.nsh"

!define PAS_REGKEY "Software\EachYoung\PixelAnchorStudio"
!define PAS_OWNER_FILE "app-owner.json"
!define PAS_WEBVIEW_GUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

Var PasDataDirectory
Var PasInstallId
Var PasInstallDirectory
Var PasDataInput
Var PasDataBrowseButton
Var PasDataDefaultButton
Var PasDataInstallButton
Var PasDataMode
Var PasStartMenuCheckbox
Var PasDesktopCheckbox
Var PasStartMenuEnabled
Var PasDesktopEnabled
Var PasWebViewStatusLabel

!macro PAS_DETECT_WEBVIEW2 OUT
  StrCpy ${OUT} ""
  ReadRegStr ${OUT} HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\${PAS_WEBVIEW_GUID}" "pv"
  ${If} ${OUT} == ""
    ReadRegStr ${OUT} HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${PAS_WEBVIEW_GUID}" "pv"
  ${EndIf}
  ${If} ${OUT} == ""
    ReadRegStr ${OUT} HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${PAS_WEBVIEW_GUID}" "pv"
  ${EndIf}
!macroend

Function PasNormalizeInstallDirectory
  Exch $0
  GetFullPathName $0 "$0"
  ${GetFileName} "$0" $1
  ${StrCase} $1 "$1" "L"
  ${If} $1 != "pixelanchorstudio"
    StrCpy $0 "$0\PixelAnchorStudio"
  ${EndIf}
  Exch $0
FunctionEnd

Function PasInstallPagePre
  ${If} $PassiveMode = 1
    Abort
  ${EndIf}
  ${If} $PasInstallDirectory == ""
    StrCpy $PasInstallDirectory "$INSTDIR"
  ${EndIf}
FunctionEnd

Function PasInstallPageLeave
  ${If} $PasInstallDirectory == ""
    MessageBox MB_ICONEXCLAMATION "请选择安装位置。"
    Abort
  ${EndIf}
  Push $PasInstallDirectory
  Call PasNormalizeInstallDirectory
  Pop $PasInstallDirectory
  ${If} ${FileExists} "$PasInstallDirectory"
  ${AndIfNot} ${FileExists} "$PasInstallDirectory\*.*"
    MessageBox MB_ICONEXCLAMATION "安装位置指向了文件，请选择或输入目录。"
    Abort
  ${EndIf}
  StrCpy $INSTDIR "$PasInstallDirectory"
FunctionEnd

Function PasRefreshDataDirectory
  ${If} $PasDataMode == "default"
    StrCpy $PasDataDirectory "$LOCALAPPDATA\PixelAnchorStudio\data"
  ${ElseIf} $PasDataMode == "install"
    StrCpy $PasDataDirectory "$INSTDIR\data"
  ${EndIf}
FunctionEnd

Function PasDataPageCreate
  ${If} $PassiveMode = 1
    Abort
  ${EndIf}
  ${If} $PasInstallId == ""
    ReadRegStr $PasInstallId HKCU "${PAS_REGKEY}" "InstallId"
  ${EndIf}
  ${If} $PasDataMode == ""
    ReadRegStr $PasDataDirectory HKCU "${PAS_REGKEY}" "DataDirectory"
    ${If} $PasDataDirectory == ""
      StrCpy $PasDataMode "default"
    ${Else}
      ${StrCase} $0 "$PasDataDirectory" "L"
      ${StrCase} $1 "$LOCALAPPDATA\PixelAnchorStudio\data" "L"
      ${StrCase} $2 "$INSTDIR\data" "L"
      ${If} $0 == $1
        StrCpy $PasDataMode "default"
      ${ElseIf} $0 == $2
        StrCpy $PasDataMode "install"
      ${Else}
        StrCpy $PasDataMode "custom"
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Call PasRefreshDataDirectory

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "应用数据位置" "选择工作台配置、缓存和恢复数据的位置"
  ${NSD_CreateLabel} 0 0 100% 26u "应用设置、缓存和恢复信息保存在此处。项目文件和导出结果不会自动保存到这里。"
  Pop $0
  ${NSD_CreateText} 0 34u 78% 13u "$PasDataDirectory"
  Pop $PasDataInput
  ${NSD_CreateButton} 80% 33u 20% 15u "浏览..."
  Pop $PasDataBrowseButton
  ${NSD_OnClick} $PasDataBrowseButton PasBrowseData
  ${NSD_CreateButton} 0 56u 27% 15u "使用默认位置"
  Pop $PasDataDefaultButton
  ${NSD_OnClick} $PasDataDefaultButton PasUseDefaultData
  ${NSD_CreateButton} 29% 56u 27% 15u "使用安装位置"
  Pop $PasDataInstallButton
  ${NSD_OnClick} $PasDataInstallButton PasUseInstallData
  ${NSD_CreateLabel} 0 82u 100% 26u "默认：%LOCALAPPDATA%\PixelAnchorStudio\data。也可直接输入或粘贴完整的最终数据路径。"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function PasUseDefaultData
  Pop $0
  StrCpy $PasDataMode "default"
  Call PasRefreshDataDirectory
  ${NSD_SetText} $PasDataInput "$PasDataDirectory"
FunctionEnd

Function PasUseInstallData
  Pop $0
  StrCpy $PasDataMode "install"
  Call PasRefreshDataDirectory
  ${NSD_SetText} $PasDataInput "$PasDataDirectory"
FunctionEnd

Function PasFindExistingParent
  Exch $0
  ${If} $0 == ""
    StrCpy $0 "$LOCALAPPDATA\PixelAnchorStudio"
  ${EndIf}
  ${GetFileName} "$0" $1
  ${StrCase} $1 "$1" "L"
  ${If} $1 == "data"
    ${GetParent} "$0" $0
  ${EndIf}
  pas_find_existing_parent:
    ${If} ${FileExists} "$0\*.*"
      Goto pas_existing_parent_found
    ${EndIf}
    ${GetParent} "$0" $1
    ${If} $1 == ""
    ${OrIf} $1 == $0
      StrCpy $0 "$LOCALAPPDATA"
      Goto pas_existing_parent_found
    ${EndIf}
    StrCpy $0 $1
    Goto pas_find_existing_parent
  pas_existing_parent_found:
  Exch $0
FunctionEnd

Function PasNormalizeDataRoot
  Exch $0
  ${GetFileName} "$0" $1
  ${StrCase} $1 "$1" "L"
  ${StrCase} $2 "$0" "L"
  ${StrCase} $3 "$INSTDIR" "L"
  ${GetParent} "$0" $4
  ${GetFileName} "$4" $5
  ${StrCase} $5 "$5" "L"
  ${If} $1 == "data"
  ${AndIf} $5 == "pixelanchorstudio"
    ; The user selected the final data directory itself.
  ${ElseIf} $1 == "pixelanchorstudio"
  ${OrIf} $2 == $3
    StrCpy $0 "$0\data"
  ${Else}
    StrCpy $0 "$0\PixelAnchorStudio\data"
  ${EndIf}
  Exch $0
FunctionEnd

Function PasBrowseData
  Pop $0
  ${NSD_GetText} $PasDataInput $0
  Push $0
  Call PasFindExistingParent
  Pop $0
  nsDialogs::SelectFolderDialog "选择应用根目录" "$0"
  Pop $0
  ${If} $0 != error
  ${AndIf} $0 != ""
    Push $0
    Call PasNormalizeDataRoot
    Pop $PasDataDirectory
    StrCpy $PasDataMode "custom"
    ${NSD_SetText} $PasDataInput "$PasDataDirectory"
  ${EndIf}
FunctionEnd

Function PasDataPageLeave
  ${NSD_GetText} $PasDataInput $PasDataDirectory
  ${If} $PasDataDirectory == ""
    MessageBox MB_ICONEXCLAMATION "请选择应用数据位置。"
    Abort
  ${EndIf}
  ${If} ${FileExists} "$PasDataDirectory"
  ${AndIfNot} ${FileExists} "$PasDataDirectory\*.*"
    MessageBox MB_ICONEXCLAMATION "应用数据位置指向了文件，请选择或输入目录。"
    Abort
  ${EndIf}
  ${StrCase} $0 "$PasDataDirectory" "L"
  ${StrCase} $1 "$LOCALAPPDATA\PixelAnchorStudio\data" "L"
  ${StrCase} $2 "$INSTDIR\data" "L"
  ${If} $0 == $1
    StrCpy $PasDataMode "default"
  ${ElseIf} $0 == $2
    StrCpy $PasDataMode "install"
  ${Else}
    StrCpy $PasDataMode "custom"
  ${EndIf}
  Push $PasDataDirectory
  Call PasFindExistingParent
  Pop $0
  ClearErrors
  GetTempFileName $1 "$0"
  ${If} ${Errors}
    MessageBox MB_ICONSTOP "无法在所选路径的现有父目录中创建临时测试项：$\r$\n$0$\r$\n$\r$\n请重新选择。"
    Abort
  ${EndIf}
  Delete "$1"
  CreateDirectory "$1"
  ClearErrors
  FileOpen $2 "$1\write-test" w
  ${If} ${Errors}
    RMDir "$1"
    MessageBox MB_ICONSTOP "无法写入应用数据位置：$\r$\n$PasDataDirectory$\r$\n$\r$\n请重新选择。"
    Abort
  ${EndIf}
  FileWrite $2 "test"
  FileClose $2
  Delete "$1\write-test"
  RMDir "$1"
FunctionEnd

Function PasOptionsPageCreate
  ${If} $PassiveMode = 1
    Abort
  ${EndIf}
  ReadRegDWORD $PasStartMenuEnabled HKCU "${PAS_REGKEY}" "StartMenuShortcut"
  ${If} $PasStartMenuEnabled == ""
    StrCpy $PasStartMenuEnabled ${BST_CHECKED}
  ${EndIf}
  ReadRegDWORD $PasDesktopEnabled HKCU "${PAS_REGKEY}" "DesktopShortcut"
  ${If} $PasDesktopEnabled == ""
    StrCpy $PasDesktopEnabled ${BST_UNCHECKED}
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "附加选项" "选择需要创建的快捷方式"
  ${NSD_CreateCheckbox} 0 8u 100% 14u "创建开始菜单快捷方式"
  Pop $PasStartMenuCheckbox
  ${NSD_SetState} $PasStartMenuCheckbox $PasStartMenuEnabled
  ${NSD_CreateCheckbox} 0 31u 100% 14u "创建桌面快捷方式"
  Pop $PasDesktopCheckbox
  ${NSD_SetState} $PasDesktopCheckbox $PasDesktopEnabled
  ${NSD_CreateLabel} 0 62u 100% 24u "升级安装会保留本页选择；卸载时只删除指向本应用的快捷方式。"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function PasOptionsPageLeave
  ${NSD_GetState} $PasStartMenuCheckbox $PasStartMenuEnabled
  ${NSD_GetState} $PasDesktopCheckbox $PasDesktopEnabled
FunctionEnd

Function PasWebViewPageCreate
  ${If} $PassiveMode = 1
    Abort
  ${EndIf}
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "WebView2 检查" "检查桌面界面所需的微软共享运行时"
  !insertmacro PAS_DETECT_WEBVIEW2 $1
  ${If} $1 == ""
    ${NSD_CreateLabel} 0 8u 100% 36u "未检测到 Microsoft Edge WebView2 Runtime。点击“下一步”可运行微软官方 Bootstrapper；该步骤可能需要网络。"
  ${Else}
    ${NSD_CreateLabel} 0 8u 100% 36u "已检测到 Microsoft Edge WebView2 Runtime：$\r$\n$1"
  ${EndIf}
  Pop $PasWebViewStatusLabel
  ${NSD_CreateLabel} 0 58u 100% 28u "工作台默认复用系统 Runtime，不捆绑固定版本。Bootstrapper 的来源和 SHA-256 在发布材料中锁定。"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function PasWebViewPageLeave
  !insertmacro PAS_DETECT_WEBVIEW2 $0
  ${If} $0 != ""
    Return
  ${EndIf}
  MessageBox MB_ICONEXCLAMATION|MB_YESNOCANCEL "锚点像素工作台需要 Microsoft Edge WebView2 Runtime。$\r$\n$\r$\n“是”：现在安装$\r$\n“否”：打开微软官方下载页$\r$\n“取消”：退出安装" IDYES pas_install_webview2_page IDNO pas_download_webview2_page
  Quit
  pas_download_webview2_page:
    ExecShell "open" "https://developer.microsoft.com/microsoft-edge/webview2/"
    Abort
  pas_install_webview2_page:
    File /oname=$TEMP\MicrosoftEdgeWebView2Setup.exe "${__FILEDIR__}\..\resources\MicrosoftEdgeWebView2Setup.exe"
    ExecWait '"$TEMP\MicrosoftEdgeWebView2Setup.exe" /silent /install' $1
    Delete "$TEMP\MicrosoftEdgeWebView2Setup.exe"
    !insertmacro PAS_DETECT_WEBVIEW2 $0
    ${If} $0 == ""
      MessageBox MB_ICONSTOP "WebView2 Runtime 安装失败（代码 $1）。请检查网络或从微软页面手动安装后重试。"
      Abort
    ${EndIf}
FunctionEnd

Function PasConfirmPageCreate
  ${If} $PassiveMode = 1
    Abort
  ${EndIf}
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "确认安装" "确认以下设置后开始复制文件"
  ${NSD_CreateLabel} 0 0 100% 66u "安装位置：$\r$\n$INSTDIR$\r$\n$\r$\n应用数据：$\r$\n$PasDataDirectory"
  Pop $0
  ${If} $PasStartMenuEnabled == ${BST_CHECKED}
    StrCpy $1 "创建"
  ${Else}
    StrCpy $1 "不创建"
  ${EndIf}
  ${If} $PasDesktopEnabled == ${BST_CHECKED}
    StrCpy $2 "创建"
  ${Else}
    StrCpy $2 "不创建"
  ${EndIf}
  ${NSD_CreateLabel} 0 76u 100% 30u "开始菜单快捷方式：$1$\r$\n桌面快捷方式：$2"
  Pop $0
  nsDialogs::Show
FunctionEnd

!macro PAS_CREATE_OWNER_MARKER
  CreateDirectory "$PasDataDirectory"
  CreateDirectory "$PasDataDirectory\webview"
  CreateDirectory "$PasDataDirectory\config"
  CreateDirectory "$PasDataDirectory\cache"
  CreateDirectory "$PasDataDirectory\logs"
  CreateDirectory "$PasDataDirectory\temp"
  CreateDirectory "$PasDataDirectory\recovery"
  FileOpen $0 "$PasDataDirectory\${PAS_OWNER_FILE}" w
  ; Rust reads this marker as UTF-8 JSON. The payload is ASCII, so FileWrite
  ; keeps it compatible without a UTF-16 BOM.
  FileWrite $0 '{$\r$\n  $\"appId$\": $\"com.eachyoung.pixel-anchor-studio$\",$\r$\n  $\"installId$\": $\"$PasInstallId$\",$\r$\n  $\"dataVersion$\": 1$\r$\n}$\r$\n'
  FileClose $0
!macroend

!macro NSIS_HOOK_PREINSTALL
  ; Final dependency guard before application files are copied. The interactive
  ; install path already handled the dependency on its dedicated wizard page.
  !insertmacro PAS_DETECT_WEBVIEW2 $0
  ${If} $0 == ""
    Abort "未检测到 WebView2 Runtime，安装已停止。"
  ${EndIf}

  ${If} $PasDataDirectory == ""
    ReadRegStr $PasDataDirectory HKCU "${PAS_REGKEY}" "DataDirectory"
  ${EndIf}
  ${If} $PasInstallId == ""
    ReadRegStr $PasInstallId HKCU "${PAS_REGKEY}" "InstallId"
  ${EndIf}
  ${If} $PasDataDirectory == ""
    StrCpy $PasDataDirectory "$LOCALAPPDATA\PixelAnchorStudio\data"
  ${EndIf}
  ${If} $PasInstallId == ""
    System::Call 'ole32::CoCreateGuid(g .s) i.r0'
    Pop $PasInstallId
  ${EndIf}
  ${If} $PasStartMenuEnabled == ""
    ReadRegDWORD $PasStartMenuEnabled HKCU "${PAS_REGKEY}" "StartMenuShortcut"
    ${If} $PasStartMenuEnabled == ""
      StrCpy $PasStartMenuEnabled ${BST_CHECKED}
    ${EndIf}
  ${EndIf}
  ${If} $PasDesktopEnabled == ""
    ReadRegDWORD $PasDesktopEnabled HKCU "${PAS_REGKEY}" "DesktopShortcut"
    ${If} $PasDesktopEnabled == ""
      StrCpy $PasDesktopEnabled ${BST_UNCHECKED}
    ${EndIf}
  ${EndIf}
  !insertmacro PAS_CREATE_OWNER_MARKER
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "${PAS_REGKEY}" "InstallDirectory" "$INSTDIR"
  WriteRegStr HKCU "${PAS_REGKEY}" "DataDirectory" "$PasDataDirectory"
  WriteRegStr HKCU "${PAS_REGKEY}" "Version" "${VERSION}"
  WriteRegStr HKCU "${PAS_REGKEY}" "InstallId" "$PasInstallId"
  WriteRegDWORD HKCU "${PAS_REGKEY}" "StartMenuShortcut" $PasStartMenuEnabled
  WriteRegDWORD HKCU "${PAS_REGKEY}" "DesktopShortcut" $PasDesktopEnabled
  StrCpy $AppStartMenuFolder "${STARTMENUFOLDER}"
  ${If} $PasStartMenuEnabled == ${BST_CHECKED}
    Call CreateOrUpdateStartMenuShortcut
  ${Else}
    Delete "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
    RMDir "$SMPROGRAMS\$AppStartMenuFolder"
  ${EndIf}
  ${If} $PasDesktopEnabled == ${BST_CHECKED}
    Call CreateOrUpdateDesktopShortcut
  ${Else}
    Delete "$DESKTOP\${PRODUCTNAME}.lnk"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ReadRegStr $PasDataDirectory HKCU "${PAS_REGKEY}" "DataDirectory"
  ReadRegStr $PasInstallId HKCU "${PAS_REGKEY}" "InstallId"
!macroend

!macro NSIS_HOOK_MANIFEST_UNINSTALL
  !insertmacro PAS_DELETE_MANIFEST_FILES
  !insertmacro PAS_DELETE_MANIFEST_DIRECTORIES
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Tauri invokes this after its running-process guard and after removing only
  ; declared application files. Delete data only when the user's checkbox and
  ; both ownership identifiers agree.
  ${If} $UpdateMode <> 1
    ${If} $DeleteAppDataCheckboxState = ${BST_CHECKED}
    ${AndIf} $PasDataDirectory != ""
    ${AndIf} ${FileExists} "$PasDataDirectory\${PAS_OWNER_FILE}"
      FileOpen $0 "$PasDataDirectory\${PAS_OWNER_FILE}" r
      FileRead $0 $1
      FileRead $0 $2
      FileRead $0 $3
      FileClose $0
      ${UnStrLoc} $4 "$1$2$3" "com.eachyoung.pixel-anchor-studio" ">"
      ${UnStrLoc} $5 "$1$2$3" "$PasInstallId" ">"
      ${If} $4 != ""
      ${AndIf} $5 != ""
        RMDir /r "$PasDataDirectory\webview"
        RMDir /r "$PasDataDirectory\config"
        RMDir /r "$PasDataDirectory\cache"
        RMDir /r "$PasDataDirectory\logs"
        RMDir /r "$PasDataDirectory\temp"
        RMDir /r "$PasDataDirectory\recovery"
        Delete "$PasDataDirectory\${PAS_OWNER_FILE}"
        RMDir "$PasDataDirectory"
        ${GetParent} "$PasDataDirectory" $6
        RMDir "$6"
        ${If} ${FileExists} "$PasDataDirectory\*.*"
          MessageBox MB_ICONINFORMATION "应用内部数据目录中仍有未知文件，因此保留该目录：$\r$\n$PasDataDirectory"
        ${EndIf}
      ${EndIf}
    ${EndIf}
    DeleteRegKey HKCU "${PAS_REGKEY}"
    ${If} ${FileExists} "$INSTDIR\*.*"
      MessageBox MB_ICONINFORMATION "应用已卸载。安装目录中仍包含非应用文件，因此该目录未被删除：$\r$\n$INSTDIR$\r$\n请确认其中的项目或导出文件后自行处理。"
    ${EndIf}
  ${EndIf}
!macroend
