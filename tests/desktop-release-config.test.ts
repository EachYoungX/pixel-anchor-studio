import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readWorkspaceFile(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

describe('desktop installer configuration', () => {
  it('keeps physical install and data directories in the English app root', () => {
    const template = readWorkspaceFile('src-tauri/nsis/installer.nsi')
    const hooks = readWorkspaceFile('src-tauri/nsis/installer-hooks.nsh')
    const dataDirectory = readWorkspaceFile('src-tauri/src/data_directory.rs')

    expect(template).toContain('!define INSTALLFOLDERNAME "PixelAnchorStudio"')
    expect(template).toContain('"$LOCALAPPDATA\\Programs\\${INSTALLFOLDERNAME}"')
    expect(template).not.toContain('placeholder\\${PRODUCTNAME}')
    expect(hooks).toContain('"$LOCALAPPDATA\\PixelAnchorStudio\\data"')
    expect(dataDirectory).toMatch(/\.join\("PixelAnchorStudio"\)\s*\.join\("data"\)/)
  })

  it('keeps the data path editable and defers final creation to preinstall', () => {
    const hooks = readWorkspaceFile('src-tauri/nsis/installer-hooks.nsh')
    const preinstall = hooks.slice(hooks.indexOf('!macro NSIS_HOOK_PREINSTALL'), hooks.indexOf('!macro NSIS_HOOK_POSTINSTALL'))

    expect(hooks).not.toContain('EM_SETREADONLY')
    expect(hooks).toContain('使用默认位置')
    expect(hooks).toContain('使用安装位置')
    expect(hooks).toContain('GetTempFileName')
    expect(preinstall.indexOf('PAS_DETECT_WEBVIEW2')).toBeLessThan(preinstall.indexOf('PAS_CREATE_OWNER_MARKER'))
  })

  it('uses the native directory page with dedicated install and data session state', () => {
    const template = readWorkspaceFile('src-tauri/nsis/installer.nsi')
    const hooks = readWorkspaceFile('src-tauri/nsis/installer-hooks.nsh')
    const installPagePre = hooks.match(/Function PasInstallPagePre[\s\S]*?FunctionEnd/)?.[0] ?? ''

    expect(template).not.toContain('Page custom PasInstallPageCreate PasInstallPageLeave')
    expect(template).toContain('!define MUI_DIRECTORYPAGE_VARIABLE $PasInstallDirectory')
    expect(template).toContain('!define MUI_PAGE_CUSTOMFUNCTION_PRE PasInstallPagePre')
    expect(template).toContain('!define MUI_PAGE_CUSTOMFUNCTION_LEAVE PasInstallPageLeave')
    expect(template).toContain('!insertmacro MUI_PAGE_DIRECTORY')
    expect(hooks).toContain('Var PasInstallDirectory')
    expect(hooks).toContain('Var PasInstallDirectoryInitialized')
    expect(installPagePre).toMatch(
      /\$PasInstallDirectoryInitialized != 1[\s\S]*StrCpy \$PasInstallDirectory "\$INSTDIR"[\s\S]*StrCpy \$PasInstallDirectoryInitialized 1/,
    )
    expect(installPagePre).not.toContain('$PasInstallDirectory == ""')
    expect(hooks).toMatch(/Function PasInstallPageLeave[\s\S]*\$\{GetRoot\} "\$PasInstallDirectory" \$0/)
    expect(hooks).toContain('StrCpy $INSTDIR "$PasInstallDirectory"')
    expect(hooks).not.toContain('Function PasInstallPageCreate')
    expect(hooks).not.toContain('Function PasBrowseInstall')
    expect(hooks).toMatch(/Function PasUseDefaultData\s+Pop \$0/)
    expect(hooks).toMatch(/Function PasUseInstallData\s+Pop \$0/)
    expect(hooks).toMatch(/Function PasBrowseData\s+Pop \$0\s+\$\{NSD_GetText\}/)
    expect(hooks).toContain('Var PasDataMode')
    expect(hooks).toContain('StrCpy $PasDataMode "install"')
    expect(hooks).toContain('StrCpy $PasDataDirectory "$INSTDIR\\data"')
    expect(hooks).toContain('Call PasRefreshDataDirectory')
  })

  it('uses safe shortcut and uninstall defaults', () => {
    const template = readWorkspaceFile('src-tauri/nsis/installer.nsi')
    const hooks = readWorkspaceFile('src-tauri/nsis/installer-hooks.nsh')

    expect(hooks).toContain('StrCpy $PasDesktopEnabled ${BST_UNCHECKED}')
    expect(hooks).toContain('StrCpy $PasStartMenuEnabled ${BST_CHECKED}')
    expect(template).toContain('SendMessage $DeleteAppDataCheckbox ${BM_SETCHECK} ${BST_CHECKED} 0')
    expect(hooks).toContain('${PAS_OWNER_FILE}')
    expect(hooks).toContain('RMDir "$6"')
    expect(hooks).not.toContain('RMDir /r "$INSTDIR"')
  })
})

describe('desktop build workflows', () => {
  it('keeps push CI package-free and desktop packaging manual', () => {
    const ci = readWorkspaceFile('.github/workflows/ci.yml')
    const desktop = readWorkspaceFile('.github/workflows/desktop-build.yml')

    expect(ci).not.toContain('desktop-windows')
    expect(ci).not.toContain('desktop:installer')
    expect(desktop).toContain('workflow_dispatch:')
    expect(desktop).not.toMatch(/\bpush:/)
    expect(desktop).toContain('npm run desktop:portable')
    expect(desktop).toContain('npm run desktop:installer')
    expect(desktop).toContain('retention-days: 14')
    expect(desktop).not.toContain('softprops/action-gh-release')
  })
})
