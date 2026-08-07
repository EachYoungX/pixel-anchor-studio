import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import https from 'node:https'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const resources = path.join(root, 'src-tauri/resources')
const lockPath = path.join(resources, 'webview2-bootstrapper.lock.json')
const destination = path.join(resources, 'MicrosoftEdgeWebView2Setup.exe')
const lock = JSON.parse(await fs.readFile(lockPath, 'utf8'))
const record = process.argv.includes('--record-sha256')

function download(url, redirects = 0) {
  if (redirects > 8) return Promise.reject(new Error('WebView2 下载重定向过多'))
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        resolve(download(new URL(response.headers.location, url), redirects + 1))
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`WebView2 下载失败：HTTP ${response.statusCode}`))
        response.resume()
        return
      }
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    }).on('error', reject)
  })
}

const bytes = await download(lock.url)
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
if (record) {
  lock.sha256 = sha256
  await fs.writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
} else if (!/^[a-f0-9]{64}$/i.test(lock.sha256) || sha256.toLowerCase() !== lock.sha256.toLowerCase()) {
  throw new Error(`WebView2 Bootstrapper SHA-256 不匹配。实际值：${sha256}。维护者审核后运行 --record-sha256 更新锁。`)
}
await fs.writeFile(destination, bytes)
console.log(`WebView2 Bootstrapper verified: ${sha256}`)
