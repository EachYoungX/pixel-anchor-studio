import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const releaseRoot = path.resolve(process.cwd(), 'release')
await fs.mkdir(releaseRoot, { recursive: true })
const files = (await fs.readdir(releaseRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(zip|exe)$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort()
if (files.length === 0) throw new Error('release 目录中没有 ZIP 或 EXE 产物')
const lines = []
for (const file of files) {
  const hash = crypto.createHash('sha256').update(await fs.readFile(path.join(releaseRoot, file))).digest('hex')
  lines.push(`${hash}  ${file}`)
}
await fs.writeFile(path.join(releaseRoot, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`)
console.log(`Generated SHA256SUMS.txt for ${files.length} artifacts`)
