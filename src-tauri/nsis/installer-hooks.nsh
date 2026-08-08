; Extensions for Tauri's official NSIS template. The upstream uninstaller already
; deletes only declared binaries/resources and uses non-recursive RMDir for $INSTDIR.

!include nsDialogs.nsh
!include "${__FILEDIR__}\..\resources\install-manifest.nsh"

!define PAS_REGKEY "Software\EachYoung\PixelAnchorStudio"
!define PAS_OWNER_FILE "app-owner.json"
!define PAS_WEBVIEW_GUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

Var PasDataDirectory
Var PasInstallId
Var PasStartMenuCheckbox
Var PasDesktopCheckbox
Var PasStartMenuEnabled
Var PasDesktopEnabled

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
  ; Command-line /D overrides are intentionally ignored: the installation and
  ; data roots are fixed for the installed edition.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\PixelAnchorStudio"
  StrCpy $PasDataDirectory "$LOCALAPPDATA\PixelAnchorStudio\data"

  ; Keep dependency handling out of the page flow. Install the bundled official
  ; bootstrapper only when the shared runtime is missing.
  !insertmacro PAS_DETECT_WEBVIEW2 $0
  ${If} $0 == ""
    File /oname=$TEMP\MicrosoftEdgeWebView2Setup.exe "${__FILEDIR__}\..\resources\MicrosoftEdgeWebView2Setup.exe"
    ExecWait '"$TEMP\MicrosoftEdgeWebView2Setup.exe" /silent /install' $1
    Delete "$TEMP\MicrosoftEdgeWebView2Setup.exe"
    !insertmacro PAS_DETECT_WEBVIEW2 $0
    ${If} $0 == ""
      MessageBox MB_ICONSTOP "WebView2 Runtime 安装失败（代码 $1）。请安装 Microsoft Edge WebView2 Runtime 后重试。"
      Abort
    ${EndIf}
  ${EndIf}

  ${If} $PasInstallId == ""
    ReadRegStr $PasInstallId HKCU "${PAS_REGKEY}" "InstallId"
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
  StrCpy $PasDataDirectory "$LOCALAPPDATA\PixelAnchorStudio\data"
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
