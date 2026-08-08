import { expect, test, type Download, type Page } from '@playwright/test'
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

async function openWorkbench(page: Page): Promise<void> {
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: '锚点像素工作台' })
  await expect(dialog).toBeVisible()
  await dialog.locator('.about-footer').getByRole('button', { name: '关闭' }).click()
}

async function chooseImage(page: Page, file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '导入图片' }).click()
  await (await chooser).setFiles(file)
}

async function chooseProject(page: Page, file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  await page.getByRole('button', { name: '项目' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: '打开项目' }).click()
  await (await chooser).setFiles(file)
}

async function discardUnsavedChanges(page: Page, detail: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: '保存当前修改？' })
  await expect(dialog).toContainText(detail)
  await dialog.getByRole('button', { name: '不保存' }).click()
}

interface BrowserDropFile {
  name: string
  mimeType: string
  buffer: Buffer
}

async function dispatchFileDrag(page: Page, type: 'dragenter' | 'drop', files: BrowserDropFile[]): Promise<void> {
  await page.evaluate(({ type, files }) => {
    const transfer = new DataTransfer()
    for (const descriptor of files) {
      const binary = atob(descriptor.base64)
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
      transfer.items.add(new File([bytes], descriptor.name, { type: descriptor.mimeType }))
    }
    window.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }))
  }, {
    type,
    files: files.map((file) => ({ name: file.name, mimeType: file.mimeType, base64: file.buffer.toString('base64') })),
  })
}

test('shows passive drop feedback and applies safe multi-file import rules', async ({ page }) => {
  const blockingDialogs: string[] = []
  page.on('dialog', async (dialog) => {
    blockingDialogs.push(dialog.message())
    await dialog.dismiss()
  })
  await openWorkbench(page)
  const firstImage = { name: 'first-drop.png', mimeType: 'image/png', buffer: createSmokePng(40, 24) }
  const secondImage = { name: 'second-drop.png', mimeType: 'image/png', buffer: createSmokePng(20, 20) }

  await dispatchFileDrag(page, 'dragenter', [firstImage])
  const overlay = page.getByRole('status', { name: '拖放文件导入' })
  await expect(overlay).toBeVisible()
  await expect(overlay.getByText('释放鼠标以导入图片')).toBeVisible()
  await expect(overlay.getByText(/PNG、JPEG、WebP、GIF、AVIF、BMP、SVG/)).toBeVisible()
  await expect(overlay.getByText(/文件仅在本地处理/)).toBeVisible()
  await expect(overlay).toHaveCSS('pointer-events', 'none')

  await dispatchFileDrag(page, 'drop', [firstImage, secondImage])
  await expect(overlay).toBeHidden()
  await expect(page.getByText('first-drop.png · 40 × 24', { exact: true })).toBeVisible()
  await expect(page.getByText(/另外 1 个文件未处理/)).toBeVisible()

  await dispatchFileDrag(page, 'drop', [{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') }])
  const unsupportedNotice = page.getByRole('alert')
  await expect(unsupportedNotice).toContainText('notes.txt')
  await expect(unsupportedNotice).toContainText('文件类型不受支持')
  await expect(unsupportedNotice).toContainText('支持类型')
  const noticeBox = await unsupportedNotice.boundingBox()
  const closeBox = await unsupportedNotice.getByRole('button', { name: '关闭导入提示' }).boundingBox()
  expect(noticeBox).not.toBeNull()
  expect(closeBox).not.toBeNull()
  expect(closeBox!.x).toBeGreaterThan(noticeBox!.x + noticeBox!.width * 0.8)
  await expect(page.getByText('first-drop.png · 40 × 24', { exact: true })).toBeVisible()

  await dispatchFileDrag(page, 'drop', [{ name: 'broken-drop.png', mimeType: 'image/png', buffer: Buffer.from('not an image') }])
  await discardUnsavedChanges(page, '导入新图片将替换当前工作内容。')
  const failedImageNotice = page.getByRole('alert').filter({ hasText: 'broken-drop.png' })
  await expect(failedImageNotice).toContainText('无法解码图片')
  await expect(failedImageNotice).toContainText('当前项目未受影响')
  await expect(page.getByText('first-drop.png · 40 × 24', { exact: true })).toBeVisible()
  expect(blockingDialogs).toEqual([])

  await dispatchFileDrag(page, 'drop', [
    { name: 'mixed.pixel-anchor.json', mimeType: 'application/json', buffer: Buffer.from('{}') },
    secondImage,
  ])
  await expect(page.getByRole('alert').filter({ hasText: 'mixed.pixel-anchor.json' })).toContainText('项目文件需要单独拖入')
  await expect(page.getByText('first-drop.png · 40 × 24', { exact: true })).toBeVisible()
})

test('guards clearing the current project and preserves it on cancel', async ({ page }) => {
  await openWorkbench(page)
  await chooseImage(page, {
    name: 'clear-guard.png',
    mimeType: 'image/png',
    buffer: createSmokePng(24, 18),
  })
  await expect(page.getByText('clear-guard.png · 24 × 18', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '项目' }).click()
  await page.getByRole('menuitem', { name: '清空当前' }).click()
  const dialog = page.getByRole('dialog', { name: '保存当前修改？' })
  await expect(dialog).toContainText('清空后这些修改将无法恢复。')
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(page.getByText('clear-guard.png · 24 × 18', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '项目' }).click()
  await page.getByRole('menuitem', { name: '清空当前' }).click()
  await discardUnsavedChanges(page, '清空后这些修改将无法恢复。')
  await expect(page.getByText('clear-guard.png · 24 × 18', { exact: true })).toBeHidden()
  await expect(page.getByText('未导入图片', { exact: true })).toBeVisible()
})

test('imports, processes, edits, and keeps both canvas viewports aligned', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openWorkbench(page)

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

  await chooseImage(page, {
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
  await page.mouse.move(sourceBox!.x + 80, sourceBox!.y + 80)
  await page.keyboard.down('Space')
  await page.mouse.down()
  await page.mouse.move(sourceBox!.x + 140, sourceBox!.y + 120, { steps: 5 })
  await page.waitForTimeout(32)
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
  await expect(page.locator('.top-actions').getByText(/PNG原尺寸|PNG八倍/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: '导出PNG' })).toBeEnabled()
  await expect(page.getByRole('button', { name: '拼豆图导出' })).toBeEnabled()

  await page.getByRole('button', { name: '导出PNG' }).click()
  const pngDialog = page.getByRole('dialog', { name: '导出像素结果 PNG' })
  await expect(pngDialog.getByText('256 × 168')).toBeVisible()
  await page.locator('.pixel-export-backdrop').click({ position: { x: 5, y: 5 } })
  await expect(pngDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(pngDialog).toBeVisible()
  await pngDialog.getByLabel('PNG放大倍数').selectOption('custom')
  await pngDialog.getByLabel('自定义PNG倍数').fill('33')
  await expect(pngDialog.getByText('请输入 1–32 之间的整数倍。')).toBeVisible()
  await expect(pngDialog.getByRole('button', { name: '导出PNG' })).toBeDisabled()
  await pngDialog.getByLabel('自定义PNG倍数').fill('32')
  await expect(pngDialog.getByText('1024 × 672')).toBeVisible()
  await expect(pngDialog.getByText('导出时选择')).toBeVisible()
  await pngDialog.getByLabel('PNG放大倍数').selectOption('2')
  await expect(pngDialog.getByText('64 × 42')).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async (options: { suggestedName: string }) => ({
        createWritable: async () => ({
          write: async (blob: Blob) => { (window as typeof window & { savedPng?: { name: string; size: number } }).savedPng = { name: options.suggestedName, size: blob.size } },
          close: async () => undefined,
        }),
      }),
    })
  })
  await pngDialog.getByRole('button', { name: '导出PNG' }).click()
  await expect(pngDialog).toBeHidden()
  const savedPng = await page.evaluate(() => (window as typeof window & { savedPng?: { name: string; size: number } }).savedPng)
  expect(savedPng?.name).toMatch(/-32x21-2x\.png$/)
  expect(savedPng?.size).toBeGreaterThan(0)

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

  const pixelCanvas = page.locator('canvas.pixel-canvas')
  const beforeManualMerge = await pixelCanvas.screenshot()
  await page.locator('.merge-button:not(:disabled)').first().click()
  await expect.poll(async () => (await pixelCanvas.screenshot()).equals(beforeManualMerge)).toBe(false)
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByRole('button', { name: '撤销' })).toBeDisabled()

  await page.keyboard.down('Space')
  await page.mouse.move(viewportBox!.x + 80, viewportBox!.y + 80)
  await page.mouse.down()
  await page.mouse.move(viewportBox!.x + 140, viewportBox!.y + 120)
  await page.mouse.up()
  await page.keyboard.up('Space')
  await expect.poll(() => pixelSurface.getAttribute('style')).not.toBe(initialTransform)

  const beforePixelMiddlePan = await pixelSurface.getAttribute('style')
  await page.mouse.move(viewportBox!.x + 90, viewportBox!.y + 90)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(viewportBox!.x + 145, viewportBox!.y + 125)
  await page.mouse.up({ button: 'middle' })
  await expect.poll(() => pixelSurface.getAttribute('style')).not.toBe(beforePixelMiddlePan)

  await page.keyboard.down('Space')
  await page.mouse.move(viewportBox!.x + 100, viewportBox!.y + 100)
  await page.mouse.down()
  await page.mouse.move(viewportBox!.x + 130, viewportBox!.y + 120)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const transformAfterBlur = await pixelSurface.getAttribute('style')
  await page.mouse.move(viewportBox!.x + 190, viewportBox!.y + 160)
  await expect.poll(() => pixelSurface.getAttribute('style')).toBe(transformAfterBlur)
  await page.mouse.up()
  await page.keyboard.up('Space')

  await pixelViewport.dblclick({ position: { x: viewportBox!.width - 24, y: viewportBox!.height - 24 } })
  await expect.poll(() => pixelSurface.getAttribute('style')).toBe(initialTransform)

  await page.getByRole('button', { name: '画笔' }).click()
  await page.locator('.color-picker').fill('#01fe02')
  await page.keyboard.down('Control')
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 2)
  await page.mouse.wheel(0, -240)
  await page.keyboard.up('Control')
  await page.keyboard.down('Space')
  await page.mouse.move(viewportBox!.x + 100, viewportBox!.y + 100)
  await page.mouse.down()
  await page.mouse.move(viewportBox!.x + 135, viewportBox!.y + 120)
  await page.mouse.up()
  await page.keyboard.up('Space')
  const pixelCanvasBox = await pixelCanvas.boundingBox()
  expect(pixelCanvasBox).not.toBeNull()
  const targetPixel = { x: 5, y: 4 }
  const targetPosition = {
    x: (targetPixel.x + 0.5) * pixelCanvasBox!.width / 32,
    y: (targetPixel.y + 0.5) * pixelCanvasBox!.height / 21,
  }
  await pixelCanvas.click({ position: {
    x: targetPosition.x,
    y: targetPosition.y,
  } })
  await expect.poll(() => pixelCanvas.evaluate((canvas, target) => {
    const context = (canvas as HTMLCanvasElement).getContext('2d')
    return context ? [...context.getImageData(target.x, target.y, 1, 1).data] : []
  }, targetPixel)).toEqual([1, 254, 2, 255])
  await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByRole('button', { name: '重做' })).toBeEnabled()

  await page.locator('.preview-shell').getByRole('button', { name: '恢复视图' }).click()

  await page.getByRole('button', { name: '透明' }).click()
  await pixelCanvas.click({ position: { x: 8, y: 8 } })
  await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByRole('button', { name: '重做' })).toBeEnabled()

  expect(pageErrors).toEqual([])
})

test('keeps the pixel result viewport visible in a narrow browser', async ({ page }) => {
  await page.setViewportSize({ width: 470, height: 738 })
  await openWorkbench(page)
  await chooseImage(page, {
    name: 'v042-narrow.png',
    mimeType: 'image/png',
    buffer: createSmokePng(48, 32),
  })
  await page.getByRole('button', { name: '生成预览' }).click()
  await expect(page.getByText(/已生成 32 × 21/)).toBeVisible()

  const layout = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('.pixel-viewport')
    const canvas = document.querySelector<HTMLCanvasElement>('.pixel-canvas')
    const resultPage = document.querySelector<HTMLElement>('.stage-page--result')
    const settingsPanel = document.querySelector<HTMLElement>('.panel-left')
    if (!viewport || !canvas || !resultPage || !settingsPanel) return null
    return {
      viewport: viewport.getBoundingClientRect().toJSON(),
      canvas: canvas.getBoundingClientRect().toJSON(),
      resultPage: resultPage.getBoundingClientRect().toJSON(),
      settingsPanel: settingsPanel.getBoundingClientRect().toJSON(),
    }
  })

  expect(layout).not.toBeNull()
  expect(layout!.viewport.height).toBeGreaterThan(200)
  expect(layout!.canvas.top).toBeGreaterThanOrEqual(layout!.viewport.top)
  expect(layout!.canvas.bottom).toBeLessThanOrEqual(layout!.viewport.bottom)
  expect(layout!.resultPage.bottom).toBeLessThanOrEqual(layout!.settingsPanel.top)
})

test('keeps document scrolling and completes crop, project, and bead export flows', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openWorkbench(page)
  await chooseImage(page, {
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
  await page.locator('.merge-button:not(:disabled)').first().click()
  await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()

  await chooseImage(page, {
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not-an-image'),
  })
  await discardUnsavedChanges(page, '导入新图片将替换当前工作内容。')
  await expect(page.getByRole('alert').filter({ hasText: 'broken.png' })).toContainText('无法解码图片')
  await expect(page.getByText('v040-roundtrip.png · 48 × 32', { exact: true })).toBeVisible()
  await expect(page.getByText(/输出 32 × 32/)).toBeVisible()
  await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()
  await page.getByRole('button', { name: '撤销' }).click()

  await page.getByRole('button', { name: '项目' }).click()
  await expect(page.getByRole('menuitem', { name: '打开项目' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '打开项目' })).toBeFocused()
  await page.getByRole('heading', { name: '原图与网格' }).click()
  await expect(page.getByRole('menuitem', { name: '打开项目' })).toBeHidden()

  await page.getByRole('button', { name: '项目' }).click()
  await expect(page.getByRole('menuitem', { name: '保存项目' })).toBeVisible()
  const savedDownloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: '保存项目' }).click()
  const savedDownload = await savedDownloadPromise
  expect(savedDownload.suggestedFilename()).toContain('.pixel-anchor.json')
  const savedProject = await readDownload(savedDownload)

  await page.locator('.merge-button:not(:disabled)').first().click()
  await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()
  const corruptedProject = JSON.parse(savedProject.toString('utf8'))
  corruptedProject.source.dataBase64 = Buffer.from('not-an-image').toString('base64')
  await chooseProject(page, {
    name: 'broken.pixel-anchor.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(corruptedProject)),
  })
  await discardUnsavedChanges(page, '打开其他项目将替换当前工作内容。')
  await expect(page.getByRole('alert').filter({ hasText: 'broken.pixel-anchor.json' })).toContainText('无法解码图片')
  await expect(page.getByText('v040-roundtrip.png · 48 × 32', { exact: true })).toBeVisible()
  await expect(page.getByText(/输出 32 × 32/)).toBeVisible()
  await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()
  await page.getByRole('button', { name: '撤销' }).click()

  await dispatchFileDrag(page, 'drop', [{
    name: 'v040-roundtrip.pixel-anchor.json',
    mimeType: 'application/json',
    buffer: savedProject,
  }])
  await discardUnsavedChanges(page, '打开其他项目将替换当前工作内容。')
  await expect(page.getByText('项目已打开', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '拼豆图导出' }).click()
  await expect(page.getByRole('button', { name: '导出 SVG' })).toBeEnabled()
  const svgDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 SVG' }).click()
  const svgDownload = await svgDownloadPromise
  expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/)

  expect(pageErrors).toEqual([])
})

test('keeps source drag capture outside the canvas and commits crop drafts on release', async ({ page }) => {
  await openWorkbench(page)
  await chooseImage(page, {
    name: 'v041-drag.png',
    mimeType: 'image/png',
    buffer: createSmokePng(48, 32),
  })
  await expect(page.getByText(/图片已导入/)).toBeVisible()

  const sourceCanvas = page.locator('canvas.source-canvas')
  await sourceCanvas.scrollIntoViewIfNeeded()
  await sourceCanvas.screenshot()
  const sourceBox = await sourceCanvas.boundingBox()
  expect(sourceBox).not.toBeNull()
  const outputBadge = page.getByText('32 × 21', { exact: true })
  const beforeOutput = await outputBadge.innerText()
  const fitScale = Math.min((sourceBox!.width - 48) / 48, (sourceBox!.height - 48) / 32)
  const handle = {
    x: sourceBox!.x + (sourceBox!.width - 48 * fitScale) / 2 + 48 * fitScale,
    y: sourceBox!.y + (sourceBox!.height - 32 * fitScale) / 2 + 32 * fitScale,
  }
  const beforeDraftFrame = await sourceCanvas.screenshot()

  await page.mouse.move(handle.x - 2, handle.y - 2)
  await page.mouse.down()
  await page.mouse.move(handle.x - 200, handle.y - 8)
  await page.waitForTimeout(32)
  const draftFrame = await sourceCanvas.screenshot()
  expect(draftFrame.equals(beforeDraftFrame)).toBe(false)
  expect(await outputBadge.innerText()).toBe(beforeOutput)
  await page.mouse.up()
  await expect.poll(async () => (await sourceCanvas.screenshot()).equals(draftFrame)).toBe(true)

  await page.locator('.source-canvas-host').getByRole('button', { name: '恢复视图' }).click()
  const panStart = { x: sourceBox!.x + sourceBox!.width / 2, y: sourceBox!.y + sourceBox!.height / 2 }
  await page.keyboard.down('Space')
  await page.mouse.move(panStart.x, panStart.y)
  await page.mouse.down()
  await page.mouse.move(sourceBox!.x + sourceBox!.width + 20, panStart.y)
  await page.waitForTimeout(32)
  const firstOutsideFrame = await sourceCanvas.screenshot()
  await page.mouse.move(sourceBox!.x + sourceBox!.width + 90, panStart.y + 20)
  await page.waitForTimeout(32)
  const secondOutsideFrame = await sourceCanvas.screenshot()
  await page.mouse.up()
  await page.keyboard.up('Space')
  expect(secondOutsideFrame.equals(firstOutsideFrame)).toBe(false)
})

test('shows quick start once and reopens release notes and license from the title', async ({ page }) => {
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: '锚点像素工作台' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '快速开始' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '快速开始' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '常用操作' })).toBeVisible()
  await expect(dialog.getByText(/关闭窗口后，点击页面左上角的“锚点像素工作台”标题/)).toBeVisible()
  await dialog.locator('.about-footer').getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()

  await page.reload()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: '锚点像素工作台 图片像素化与拼豆图工具' }).click()
  await expect(dialog.getByRole('heading', { name: '快速开始' })).toBeVisible()

  await dialog.getByRole('button', { name: '更新日志' }).click()
  await expect(dialog.getByText(/v0\.5\.1/)).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '桌面安装' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '文件操作' })).toBeVisible()

  await dialog.getByRole('button', { name: '项目与许可' }).click()
  await expect(dialog.getByRole('heading', { name: '项目声明' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '隐私说明' })).toBeVisible()
  await expect(dialog.locator('.license-text')).toContainText('Copyright (c) 2026 Pixel Anchor Studio contributors')
  await expect(dialog.getByRole('link', { name: '打开 GitHub 项目' })).toHaveCount(1)
  const githubFontSize = await dialog.getByRole('link', { name: '打开 GitHub 项目' }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(githubFontSize).toBeGreaterThanOrEqual(14)
  await dialog.locator('.about-footer').getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
})
