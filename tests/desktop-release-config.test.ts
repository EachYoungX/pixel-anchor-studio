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

  it('uses controlled install browsing and preserves explicit data modes', () => {
    const template = readWorkspaceFile('src-tauri/nsis/installer.nsi')
    const hooks = readWorkspaceFile('src-tauri/nsis/installer-hooks.nsh')

    expect(template).toContain('Page custom PasInstallPageCreate PasInstallPageLeave')
    expect(template).not.toContain('!insertmacro MUI_PAGE_DIRECTORY')
    expect(hooks).toContain('Call PasFindExistingDirectory')
    expect(hooks).toContain('nsDialogs::SelectFolderDialog "选择安装根目录" "$0"')
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
