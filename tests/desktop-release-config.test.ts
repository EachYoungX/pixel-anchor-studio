import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readWorkspaceFile(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

describe('desktop installer configuration', () => {
  it('fixes installed-edition program and data directories', () => {
    const template = readWorkspaceFile('src-tauri/nsis/installer.nsi')
    const hooks = readWorkspaceFile('src-tauri/nsis/installer-hooks.nsh')
    const dataDirectory = readWorkspaceFile('src-tauri/src/data_directory.rs')

    expect(template).toContain('!define INSTALLFOLDERNAME "PixelAnchorStudio"')
    expect(template).toContain('InstallDir "$LOCALAPPDATA\\Programs\\${INSTALLFOLDERNAME}"')
    expect(template).toContain('StrCpy $INSTDIR "$LOCALAPPDATA\\Programs\\${INSTALLFOLDERNAME}"')
    expect(hooks).toContain('StrCpy $INSTDIR "$LOCALAPPDATA\\Programs\\PixelAnchorStudio"')
    expect(hooks).toContain('StrCpy $PasDataDirectory "$LOCALAPPDATA\\PixelAnchorStudio\\data"')
    expect(template).not.toContain('PLACEHOLDER_INSTALL_DIR')
    expect(template).not.toContain('RestorePreviousInstallLocation')
    expect(dataDirectory).not.toContain('get_value("DataDirectory")')
    expect(dataDirectory).toMatch(/\.join\("PixelAnchorStudio"\)\s*\.join\("data"\)/)
  })

  it('removes directory selection and keeps only shortcut choices', () => {
    const template = readWorkspaceFile('src-tauri/nsis/installer.nsi')
    const hooks = readWorkspaceFile('src-tauri/nsis/installer-hooks.nsh')
    const preinstall = hooks.slice(hooks.indexOf('!macro NSIS_HOOK_PREINSTALL'), hooks.indexOf('!macro NSIS_HOOK_POSTINSTALL'))

    expect(template).not.toContain('MUI_PAGE_DIRECTORY')
    expect(template).not.toContain('PasDataPageCreate')
    expect(template).not.toContain('PasWebViewPageCreate')
    expect(template).not.toContain('PasConfirmPageCreate')
    expect(template).toContain('Page custom PasOptionsPageCreate PasOptionsPageLeave')
    expect(hooks).not.toContain('PasBrowseData')
    expect(hooks).not.toContain('PasInstallPage')
    expect(preinstall).toContain('MicrosoftEdgeWebView2Setup.exe')
    expect(preinstall.indexOf('PAS_DETECT_WEBVIEW2')).toBeLessThan(preinstall.indexOf('PAS_CREATE_OWNER_MARKER'))
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

  it('documents the portable recommendation and release version source', () => {
    const readme = readWorkspaceFile('README.md')
    const guide = readWorkspaceFile('docs/PixelAnchorStudio-INTERNAL-PACKAGING-GUIDE.md')

    expect(readme).toContain('推荐使用便携版')
    expect(readme).toContain('%LOCALAPPDATA%\\Programs\\PixelAnchorStudio')
    expect(readme).not.toContain('可以修改应用安装位置')
    expect(guide).toContain('package.json')
    expect(guide).toContain('npm version')
    expect(guide).toContain('git tag -a')
    expect(guide).toContain('Draft Release')
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
