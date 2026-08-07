import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const packageDocument = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const manifest = {
  appId: 'com.eachyoung.pixel-anchor-studio',
  version: packageDocument.version,
  files: [
    'PixelAnchorStudio.exe',
    'uninstall.exe',
    'runtime/MicrosoftEdgeWebView2Setup.exe',
    'install-manifest.json',
  ],
  directories: ['runtime'],
}
const output = path.join(root, 'src-tauri/resources/install-manifest.json')
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`)
const nsis = [
  '; Generated from install-manifest.json. Do not edit.',
  '!macro PAS_DELETE_MANIFEST_FILES',
  ...manifest.files.map((file) => `  Delete "$INSTDIR\\${file.replaceAll('/', '\\')}"`),
  '!macroend',
  '',
  '!macro PAS_DELETE_MANIFEST_DIRECTORIES',
  ...[...manifest.directories].reverse().map((directory) => `  RMDir "$INSTDIR\\${directory.replaceAll('/', '\\')}"`),
  '!macroend',
  '',
].join('\n')
await fs.writeFile(path.join(root, 'src-tauri/resources/install-manifest.nsh'), nsis)
console.log(`Install manifest generated for ${packageDocument.version}`)
