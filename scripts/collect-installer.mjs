import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const packageDocument = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const bundleRoot = path.join(root, 'src-tauri/target/release/bundle/nsis')
const entries = await fs.readdir(bundleRoot)
const installer = entries.find((entry) => entry.toLowerCase().endsWith('.exe'))
if (!installer) throw new Error('未找到 NSIS 安装程序')
const releaseRoot = path.join(root, 'release')
await fs.mkdir(releaseRoot, { recursive: true })
const destination = path.join(releaseRoot, `PixelAnchorStudio-${packageDocument.version}-Setup.exe`)
await fs.copyFile(path.join(bundleRoot, installer), destination)
console.log(`Installer collected: ${destination}`)
