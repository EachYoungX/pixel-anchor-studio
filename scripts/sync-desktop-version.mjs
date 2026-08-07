import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const packageDocument = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const version = packageDocument.version

async function updateJson(relativePath) {
  const absolutePath = path.join(root, relativePath)
  const document = JSON.parse(await fs.readFile(absolutePath, 'utf8'))
  document.version = version
  await fs.writeFile(absolutePath, `${JSON.stringify(document, null, 2)}\n`)
}

await updateJson('src-tauri/tauri.conf.json')
const cargoPath = path.join(root, 'src-tauri/Cargo.toml')
const cargo = await fs.readFile(cargoPath, 'utf8')
const synchronized = cargo.replace(/(^\[package\][\s\S]*?^version\s*=\s*")[^"]+("$)/m, `$1${version}$2`)
if (cargo === synchronized && !cargo.includes(`version = "${version}"`)) throw new Error('无法同步 Cargo.toml 版本')
await fs.writeFile(cargoPath, synchronized)
console.log(`Desktop metadata synchronized to ${version}`)
