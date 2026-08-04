import { expect, test } from '@playwright/test'
import { deflateSync } from 'node:zlib'

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii')
  const payload = Buffer.concat([typeBytes, Buffer.from(data)])
  const header = Buffer.alloc(4)
  header.writeUInt32BE(data.length, 0)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(payload), 0)
  return Buffer.concat([header, payload, checksum])
}

function createSmokePng(width: number, height: number): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x += 1) {
      const offset = y * (width * 4 + 1) + 1 + x * 4
      raw[offset] = x < width / 2 ? 40 : 220
      raw[offset + 1] = y < height / 2 ? 80 : 160
      raw[offset + 2] = (x + y) % 2 === 0 ? 220 : 70
      raw[offset + 3] = 255
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ])
}

test('imports, processes, edits, and keeps both canvas viewports aligned', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')

  await page.locator('input[type="file"]').nth(0).setInputFiles({
    name: 'v040-smoke.png',
    mimeType: 'image/png',
    buffer: createSmokePng(48, 32),
  })
  await expect(page.getByText(/图片已导入/)).toBeVisible()

  const sourceCanvas = page.locator('canvas.source-canvas')
  await sourceCanvas.scrollIntoViewIfNeeded()
  const sourceBox = await sourceCanvas.boundingBox()
  expect(sourceBox).not.toBeNull()
  await sourceCanvas.hover()
  const sourceBeforeZoom = await sourceCanvas.screenshot()
  await page.keyboard.down('Control')
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.wheel(0, -240)
  await page.keyboard.up('Control')
  await expect.poll(async () => (await sourceCanvas.screenshot()).equals(sourceBeforeZoom)).toBe(false)

  const sourceBeforePan = await sourceCanvas.screenshot()
  await page.keyboard.down('Space')
  await page.mouse.move(sourceBox!.x + 80, sourceBox!.y + 80)
  await page.mouse.down()
  await page.mouse.move(sourceBox!.x + 140, sourceBox!.y + 120)
  await page.mouse.up()
  await page.keyboard.up('Space')
  await expect.poll(async () => (await sourceCanvas.screenshot()).equals(sourceBeforePan)).toBe(false)

  await page.getByRole('button', { name: '生成预览' }).click()
  await expect(page.getByText(/已生成 32 × 21/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'PNG原尺寸' })).toBeEnabled()
  await expect(page.getByRole('button', { name: '拼豆图导出' })).toBeEnabled()

  const pixelSurface = page.locator('.pixel-surface')
  await expect(pixelSurface).toHaveCount(1)
  const initialTransform = await pixelSurface.getAttribute('style')
  const pixelViewport = page.locator('.pixel-viewport')
  await pixelViewport.scrollIntoViewIfNeeded()
  const viewportBox = await pixelViewport.boundingBox()
  expect(viewportBox).not.toBeNull()

  await pixelViewport.hover()
  await page.keyboard.down('Control')
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 2)
  await page.mouse.wheel(0, -240)
  await page.keyboard.up('Control')
  await expect.poll(() => pixelSurface.getAttribute('style')).not.toBe(initialTransform)

  await page.keyboard.down('Space')
  await page.mouse.move(viewportBox!.x + 80, viewportBox!.y + 80)
  await page.mouse.down()
  await page.mouse.move(viewportBox!.x + 140, viewportBox!.y + 120)
  await page.mouse.up()
  await page.keyboard.up('Space')
  await expect.poll(() => pixelSurface.getAttribute('style')).not.toBe(initialTransform)

  await page.getByRole('button', { name: '透明' }).click()
  const pixelCanvas = page.locator('canvas.pixel-canvas')
  await pixelCanvas.click({ position: { x: 8, y: 8 } })
  await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByRole('button', { name: '重做' })).toBeEnabled()

  expect(pageErrors).toEqual([])
})
