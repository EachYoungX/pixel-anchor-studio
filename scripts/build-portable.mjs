import archiver from 'archiver'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(process.cwd())
const releaseRoot = path.join(root, 'release')
const portableRoot = path.join(releaseRoot, 'portable', 'PixelAnchorStudio-Portable')
if (!portableRoot.startsWith(`${releaseRoot}${path.sep}`)) throw new Error('便携输出目录越界')
const packageDocument = JSON.parse(await fsp.readFile(path.join(root, 'package.json'), 'utf8'))
const targetCandidates = [
  path.join(root, 'src-tauri/target/x86_64-pc-windows-msvc/release'),
  path.join(root, 'src-tauri/target/release'),
]
const targetRoot = (await Promise.all(targetCandidates.map(async (candidate) => ({ candidate, exists: await fsp.stat(candidate).then(() => true, () => false) })))).find((entry) => entry.exists)?.candidate
if (!targetRoot) throw new Error('未找到 Tauri release 输出，请先执行 desktop:build')

await fsp.rm(path.join(releaseRoot, 'portable'), { recursive: true, force: true })
await fsp.mkdir(path.join(portableRoot, 'runtime'), { recursive: true })
const runtimeFiles = (await fsp.readdir(targetRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(exe|dll)$/i.test(entry.name))
if (!runtimeFiles.some((entry) => entry.name.toLowerCase() === 'pixelanchorstudio.exe')) throw new Error('未找到 PixelAnchorStudio.exe')
for (const entry of runtimeFiles) await fsp.copyFile(path.join(targetRoot, entry.name), path.join(portableRoot, entry.name))
await fsp.copyFile(path.join(root, 'src-tauri/resources/MicrosoftEdgeWebView2Setup.exe'), path.join(portableRoot, 'runtime/MicrosoftEdgeWebView2Setup.exe'))
await fsp.copyFile(path.join(root, 'LICENSE'), path.join(portableRoot, 'LICENSE.txt'))
await fsp.copyFile(path.join(root, 'src-tauri/resources/README-首次运行.txt'), path.join(portableRoot, 'README-首次运行.txt'))
await fsp.writeFile(path.join(portableRoot, 'portable.flag'), '')

const zipPath = path.join(releaseRoot, `PixelAnchorStudio-${packageDocument.version}-Portable.zip`)
await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(zipPath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  output.on('close', resolve)
  archive.on('error', reject)
  archive.pipe(output)
  archive.directory(portableRoot, 'PixelAnchorStudio-Portable')
  archive.finalize()
})
const hash = crypto.createHash('sha256').update(await fsp.readFile(zipPath)).digest('hex')
await fsp.writeFile(`${zipPath}.sha256`, `${hash}  ${path.basename(zipPath)}\n`)
console.log(`Portable package created: ${zipPath}`)
