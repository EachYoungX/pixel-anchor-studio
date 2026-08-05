import { expect, test, type Download } from '@playwright/test'
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

async function readDownload(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream()
  if (!stream) throw new Error('下载内容不可读')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

test('imports, processes, edits, and keeps both canvas viewports aligned', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')

  const sourceCanvas = page.locator('canvas.source-canvas')
  const resultEmptyState = page.locator('.canvas-empty-state')
  await expect(resultEmptyState).toBeVisible()
  const [sourceBackground, resultBackground, resultEmptyLayout] = await Promise.all([
    sourceCanvas.evaluate((element) => getComputedStyle(element).backgroundImage),
    resultEmptyState.evaluate((element) => getComputedStyle(element).backgroundImage),
    resultEmptyState.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        height: element.getBoundingClientRect().height,
        parentHeight: element.parentElement?.getBoundingClientRect().height,
        placeItems: style.placeItems,
        userSelect: style.userSelect,
      }
    }),
  ])
  expect(resultBackground).toBe(sourceBackground)
  expect(resultEmptyLayout.placeItems).toBe('center')
  expect(resultEmptyLayout.userSelect).toBe('none')
  expect(resultEmptyLayout.height).toBeCloseTo(resultEmptyLayout.parentHeight ?? 0, 0)

  await page.locator('input[type="file"]').nth(0).setInputFiles({
    name: 'v040-smoke.png',
    mimeType: 'image/png',
    buffer: createSmokePng(48, 32),
  })
  await expect(page.getByText(/图片已导入/)).toBeVisible()

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

  const sourceBeforeMiddlePan = await sourceCanvas.screenshot()
  await page.mouse.move(sourceBox!.x + 80, sourceBox!.y + 80)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(sourceBox!.x + 130, sourceBox!.y + 110)
  await page.mouse.up({ button: 'middle' })
  await expect.poll(async () => (await sourceCanvas.screenshot()).equals(sourceBeforeMiddlePan)).toBe(false)
  const sourceChangedView = await sourceCanvas.screenshot()
  await page.locator('.source-canvas-host').getByRole('button', { name: '恢复视图' }).click()
  await expect.poll(async () => (await sourceCanvas.screenshot()).equals(sourceChangedView)).toBe(false)

  await page.getByRole('button', { name: '生成预览' }).click()
  await expect(page.getByText(/已生成 32 × 21/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'PNG原尺寸' })).toBeEnabled()
  await expect(page.getByRole('button', { name: '拼豆图导出' })).toBeEnabled()

  const pixelSurface = page.locator('.pixel-surface')
  await expect(pixelSurface).toHaveCount(1)
  const pixelGrid = page.locator('.pixel-grid')
  await expect(pixelGrid).toBeVisible()
  const gridRendering = await pixelGrid.evaluate((element) => {
    const path = element.querySelector('path')
    const image = element.previousElementSibling as HTMLCanvasElement
    const dimensions = element.getAttribute('viewBox')?.split(' ').map(Number) ?? []
    const pathData = path?.getAttribute('d') ?? ''
    return {
      dimensions,
      pathData,
      moveCount: pathData.match(/M/g)?.length ?? 0,
      renderedCellSize: element.getBoundingClientRect().width / image.width,
      shapeRendering: path ? getComputedStyle(path).shapeRendering : '',
      strokeWidth: path ? getComputedStyle(path).strokeWidth : '',
    }
  })
  expect(gridRendering.dimensions).toHaveLength(4)
  expect(gridRendering.dimensions[2] / 32).toBeCloseTo(gridRendering.renderedCellSize, 5)
  expect(gridRendering.moveCount).toBe(32 + 21 + 2)
  expect(gridRendering.pathData).toContain(`V${gridRendering.dimensions[3]}`)
  expect(gridRendering.pathData).toContain(`H${gridRendering.dimensions[2]}`)
  expect(gridRendering.shapeRendering).toBe('crispedges')
  expect(gridRendering.strokeWidth).toBe('1px')
  expect(gridRendering.renderedCellSize).toBeGreaterThanOrEqual(3)
  const gridToggle = page.locator('.preview-shell').getByLabel('显示网格')
  await gridToggle.uncheck()
  await expect(pixelGrid).toHaveCount(0)
  await gridToggle.check()
  await expect(pixelGrid).toBeVisible()
  const initialTransform = await pixelSurface.getAttribute('style')
  const pixelViewport = page.locator('.pixel-viewport')
  const mainStage = page.locator('.main-stage')
  await pixelViewport.scrollIntoViewIfNeeded()
  const viewportBox = await pixelViewport.boundingBox()
  expect(viewportBox).not.toBeNull()

  await pixelViewport.hover()
  const pixelScrollBeforeWheel = await mainStage.evaluate((element) => element.scrollTop)
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 2)
  await page.mouse.wheel(0, 420)
  await expect.poll(() => mainStage.evaluate((element) => element.scrollTop)).toBeGreaterThan(pixelScrollBeforeWheel)

  await page.keyboard.down('Control')
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 2)
  await page.mouse.wheel(0, -240)
  await page.keyboard.up('Control')
  await expect.poll(() => pixelSurface.getAttribute('style')).not.toBe(initialTransform)
  const zoomedGridRendering = await pixelGrid.evaluate((element) => {
    const path = element.querySelector('path')
    return {
      moveCount: path?.getAttribute('d')?.match(/M/g)?.length ?? 0,
      strokeWidth: path ? getComputedStyle(path).strokeWidth : '',
      vectorEffect: path ? getComputedStyle(path).vectorEffect : '',
    }
  })
  expect(zoomedGridRendering.moveCount).toBe(32 + 21 + 2)
  expect(zoomedGridRendering.strokeWidth).toBe('1px')
  expect(zoomedGridRendering.vectorEffect).toBe('non-scaling-stroke')

  await page.keyboard.down('Space')
  await page.mouse.move(viewportBox!.x + 80, viewportBox!.y + 80)
  await page.mouse.down()
  await page.mouse.move(viewportBox!.x + 140, viewportBox!.y + 120)
  await page.mouse.up()
  await page.keyboard.up('Space')
  await expect.poll(() => pixelSurface.getAttribute('style')).not.toBe(initialTransform)
  await page.locator('.preview-shell').getByRole('button', { name: '恢复视图' }).click()
  await expect.poll(() => pixelSurface.getAttribute('style')).toBe(initialTransform)

  await page.getByRole('button', { name: '画笔' }).click()
  const pixelCanvas = page.locator('canvas.pixel-canvas')
  const pixelCanvasBox = await pixelCanvas.boundingBox()
  expect(pixelCanvasBox).not.toBeNull()
  await page.mouse.move(pixelCanvasBox!.x + 12, pixelCanvasBox!.y + 12)
  await page.mouse.down()
  await page.mouse.move(pixelCanvasBox!.x + 60, pixelCanvasBox!.y + 30)
  await page.mouse.move(pixelCanvasBox!.x + 110, pixelCanvasBox!.y + 50)
  await page.mouse.up()
  await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByRole('button', { name: '重做' })).toBeEnabled()

  await page.getByRole('button', { name: '透明' }).click()
  await pixelCanvas.click({ position: { x: 8, y: 8 } })
  await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByRole('button', { name: '重做' })).toBeEnabled()

  expect(pageErrors).toEqual([])
})

test('keeps document scrolling and completes crop, project, and bead export flows', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.locator('input[type="file"]').nth(0).setInputFiles({
    name: 'v040-roundtrip.png',
    mimeType: 'image/png',
    buffer: createSmokePng(48, 32),
  })
  await expect(page.getByText(/图片已导入/)).toBeVisible()

  const sourceCanvas = page.locator('canvas.source-canvas')
  const mainStage = page.locator('.main-stage')
  await sourceCanvas.scrollIntoViewIfNeeded()
  const sourceBox = await sourceCanvas.boundingBox()
  expect(sourceBox).not.toBeNull()
  const scrollBeforeWheel = await mainStage.evaluate((element) => element.scrollTop)
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.wheel(0, 420)
  await expect.poll(() => mainStage.evaluate((element) => element.scrollTop)).toBeGreaterThan(scrollBeforeWheel)

  await page.getByRole('button', { name: '居中正方形' }).click()
  await page.getByRole('button', { name: '生成预览' }).click()
  await expect(page.getByText(/已生成 32 × 32/)).toBeVisible()

  const savedDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '保存项目' }).click()
  const savedDownload = await savedDownloadPromise
  expect(savedDownload.suggestedFilename()).toContain('.pixel-anchor.json')
  const savedProject = await readDownload(savedDownload)

  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name: 'v040-roundtrip.pixel-anchor.json',
    mimeType: 'application/json',
    buffer: savedProject,
  })
  await expect(page.getByText('项目已打开', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '拼豆图导出' }).click()
  await expect(page.getByRole('button', { name: '导出 SVG' })).toBeEnabled()
  const svgDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 SVG' }).click()
  const svgDownload = await svgDownloadPromise
  expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/)

  expect(pageErrors).toEqual([])
})
