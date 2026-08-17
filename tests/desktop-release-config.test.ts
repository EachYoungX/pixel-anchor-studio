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

  it('removes directory selection while keeping dependency and confirmation pages', () => {
    const template = readWorkspaceFile('src-tauri/nsis/installer.nsi')
    const hooks = readWorkspaceFile('src-tauri/nsis/installer-hooks.nsh')
    const preinstall = hooks.slice(hooks.indexOf('!macro NSIS_HOOK_PREINSTALL'), hooks.indexOf('!macro NSIS_HOOK_POSTINSTALL'))

    expect(template).not.toContain('MUI_PAGE_DIRECTORY')
    expect(template).not.toContain('PasDataPageCreate')
    expect(template).toContain('Page custom PasOptionsPageCreate PasOptionsPageLeave')
    expect(template).toContain('Page custom PasWebViewPageCreate PasWebViewPageLeave')
    expect(template).toContain('Page custom PasConfirmPageCreate')
    expect(hooks).not.toContain('PasBrowseData')
    expect(hooks).not.toContain('PasInstallPage')
    expect(hooks).toContain('Function PasWebViewPageCreate')
    expect(hooks).toContain('Function PasWebViewPageLeave')
    expect(hooks).toContain('Function PasConfirmPageCreate')
    expect(hooks).toMatch(/Function PasConfirmPageCreate[\s\S]*StrCpy \$INSTDIR "\$LOCALAPPDATA\\Programs\\PixelAnchorStudio"/)
    expect(hooks).toMatch(/Function PasConfirmPageCreate[\s\S]*StrCpy \$PasDataDirectory "\$LOCALAPPDATA\\PixelAnchorStudio\\data"/)
    expect(preinstall).toContain('MicrosoftEdgeWebView2Setup.exe')
    expect(preinstall.indexOf('PAS_DETECT_WEBVIEW2')).toBeLessThan(preinstall.indexOf('PAS_CREATE_OWNER_MARKER'))
  })

  it('freezes the WebView2 bootstrapper source before Tauri expands installer hooks', () => {
    const hooks = readWorkspaceFile('src-tauri/nsis/installer-hooks.nsh')
    const preinstall = hooks.slice(hooks.indexOf('!macro NSIS_HOOK_PREINSTALL'), hooks.indexOf('!macro NSIS_HOOK_POSTINSTALL'))

    expect(hooks).toContain(
      '!define PAS_WEBVIEW2_BOOTSTRAPPER_SOURCE "${__FILEDIR__}\\..\\resources\\MicrosoftEdgeWebView2Setup.exe"',
    )
    expect(hooks.match(/File \/oname=\$TEMP\\MicrosoftEdgeWebView2Setup\.exe "\$\{PAS_WEBVIEW2_BOOTSTRAPPER_SOURCE\}"/g)).toHaveLength(2)
    expect(preinstall).not.toContain('${__FILEDIR__}')
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
    const packageDocument = JSON.parse(readWorkspaceFile('package.json')) as { version: string; scripts: Record<string, string> }
    const tauriConfig = JSON.parse(readWorkspaceFile('src-tauri/tauri.conf.json')) as { version: string }
    const cargo = readWorkspaceFile('src-tauri/Cargo.toml')
    const portableReadme = readWorkspaceFile('src-tauri/resources/README-首次运行.txt')
    const versionSetter = readWorkspaceFile('scripts/set-version.mjs')
    const readme = readWorkspaceFile('README.md')
    const guide = readWorkspaceFile('docs/PixelAnchorStudio-INTERNAL-PACKAGING-GUIDE.md')

    expect(packageDocument.scripts['version:set']).toBe('node scripts/set-version.mjs')
    expect(tauriConfig.version).toBe(packageDocument.version)
    expect(cargo).toContain(`version = "${packageDocument.version}"`)
    expect(portableReadme).toContain(`PixelAnchorStudio-${packageDocument.version}-Portable.zip`)
    expect(versionSetter).toContain("'--no-git-tag-version'")
    expect(versionSetter).toContain("'desktop:sync-version'")
    expect(versionSetter).toContain("'desktop:manifest'")
    expect(readme).toContain('推荐使用便携版')
    expect(readme).toContain('%LOCALAPPDATA%\\Programs\\PixelAnchorStudio')
    expect(readme).not.toContain('可以修改应用安装位置')
    expect(guide).toContain('package.json')
    expect(guide).toContain('npm run version:set -- 1.0.0')
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
