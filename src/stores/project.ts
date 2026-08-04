import { computed, markRaw, reactive, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import { hexToRgba, rgbaToHex } from '@/core/color'
import { calculateOutputDimensions } from '@/core/dimensions'
import { loadHtmlImage, loadSourceFile, imageToImageData } from '@/core/image/load'
import { buildPalette } from '@/core/palette'
import { base64ToBytes, bytesToBase64 } from '@/core/export/project'
import { runProcessing } from '@/core/worker-client'
import type {
  BeadSettings,
  CropMode,
  EditTarget,
  PaletteEntry,
  PixelResult,
  PixelTool,
  ProcessingSettings,
  Rect,
  ScaleSettings,
  SerializedProject,
  SourceState,
} from '@/types/project'

const defaultScale = (): ScaleSettings => ({
  mode: 'direct',
  directAxis: 'longSide',
  directValue: 64,
  anchorCells: 3,
  pseudoCellSize: 8,
  offsetX: 0,
  offsetY: 0,
})

const defaultProcessing = (): ProcessingSettings => ({
  sampling: 'median',
  quantize: true,
  maxColors: 64,
  cleanup: 'off',
  preserveAlpha: true,
  transparentThreshold: 24,
})

const defaultBead = (): BeadSettings => ({
  maxColors: 64,
  cellSize: 24,
  pageColumns: 64,
  pageRows: 64,
  indexFromOne: true,
})

function clampRect(rect: Rect, width: number, height: number, minimum = 4): Rect {
  const result = { ...rect }
  result.width = Math.max(minimum, Math.min(width, result.width))
  result.height = Math.max(minimum, Math.min(height, result.height))
  result.x = Math.max(0, Math.min(width - result.width, result.x))
  result.y = Math.max(0, Math.min(height - result.height, result.y))
  return result
}

function cloneResult(result: PixelResult): PixelResult {
  return { width: result.width, height: result.height, data: new Uint8ClampedArray(result.data) }
}

export const useProjectStore = defineStore('project', () => {
  const source = ref<SourceState | null>(null)
  const sourceImage = ref<HTMLImageElement | null>(null)
  const sourceImageData = ref<ImageData | null>(null)
  const crop = reactive<Rect>({ x: 0, y: 0, width: 1, height: 1 })
  const cropSettings = reactive({ mode: 'custom' as CropMode, customRect: crop })
  const anchor = reactive<Rect>({ x: 0, y: 0, width: 32, height: 32 })
  const scale = reactive<ScaleSettings>(defaultScale())
  const processing = reactive<ProcessingSettings>(defaultProcessing())
  const bead = reactive<BeadSettings>(defaultBead())
  const result = ref<PixelResult | null>(null)
  const colorCodes = ref<Record<string, string>>({})
  const palette = ref<PaletteEntry[]>([])
  const selectedColor = ref('#202124')
  const editTarget = ref<EditTarget>('crop')
  const pixelTool = ref<PixelTool>('brush')
  const isProcessing = ref(false)
  const status = ref('导入图片后开始处理')
  const lastDurationMs = ref(0)
  const history = ref<PixelResult[]>([])
  const future = ref<PixelResult[]>([])

  const effectiveCrop = computed<Rect>(() => {
    if (!source.value) return crop
    if (cropSettings.mode === 'full') return { x: 0, y: 0, width: source.value.width, height: source.value.height }
    if (cropSettings.mode === 'center-square') {
      const side = Math.min(source.value.width, source.value.height)
      return { x: (source.value.width - side) / 2, y: (source.value.height - side) / 2, width: side, height: side }
    }
    return crop
  })
  const outputDimensions = computed(() => calculateOutputDimensions(effectiveCrop.value, anchor, scale))
  const canProcess = computed(() => Boolean(source.value && sourceImageData.value))
  const beadCount = computed(() => palette.value.reduce((total, entry) => total + entry.count, 0))
  const canExportBead = computed(() => Boolean(result.value && palette.value.length > 0 && palette.value.length <= bead.maxColors))
  const sourceLabel = computed(() => {
    if (!source.value) return '未导入图片'
    return `${source.value.name} · ${source.value.width} × ${source.value.height}`
  })

  function refreshPalette(): void {
    const built = buildPalette(result.value, colorCodes.value)
    palette.value = built.entries
    colorCodes.value = built.codeMap
    if (palette.value.length > 0 && !palette.value.some((entry) => entry.hex === selectedColor.value)) {
      selectedColor.value = palette.value.find((entry) => entry.rgba[3] > 0)?.hex ?? '#202124'
    }
  }

  async function importImage(file: File): Promise<void> {
    const loaded = await loadSourceFile(file)
    source.value = loaded.source
    sourceImage.value = markRaw(loaded.image)
    sourceImageData.value = markRaw(imageToImageData(loaded.image))
    Object.assign(crop, { x: 0, y: 0, width: loaded.source.width, height: loaded.source.height })
    cropSettings.mode = 'custom'
    const anchorSide = Math.max(8, Math.min(loaded.source.width, loaded.source.height) * 0.12)
    Object.assign(anchor, {
      x: Math.max(0, loaded.source.width * 0.5 - anchorSide / 2),
      y: Math.max(0, loaded.source.height * 0.35 - anchorSide / 2),
      width: anchorSide,
      height: anchorSide,
    })
    result.value = null
    palette.value = []
    history.value = []
    future.value = []
    colorCodes.value = {}
    status.value = '图片已导入，调整裁剪和转换参数后生成预览'
  }

  function updateCrop(next: Rect): void {
    if (!source.value) return
    Object.assign(crop, clampRect(next, source.value.width, source.value.height, 8))
    cropSettings.mode = 'custom'
  }

  function updateAnchor(next: Rect): void {
    if (!source.value) return
    const square = Math.max(4, Math.min(next.width, next.height))
    Object.assign(anchor, clampRect({ ...next, width: square, height: square }, source.value.width, source.value.height, 4))
  }

  function resetCrop(): void {
    if (!source.value) return
    cropSettings.mode = 'full'
  }

  function centerSquareCrop(): void {
    if (!source.value) return
    cropSettings.mode = 'center-square'
  }

  function resetGridPhase(): void {
    scale.offsetX = 0
    scale.offsetY = 0
  }

  async function process(): Promise<void> {
    if (!sourceImageData.value || !source.value) return
    isProcessing.value = true
    status.value = '正在生成像素矩阵'
    try {
      const dimensions = outputDimensions.value
      const response = await runProcessing({
        source: {
          width: sourceImageData.value.width,
          height: sourceImageData.value.height,
          data: sourceImageData.value.data,
        },
        crop: { ...toRaw(effectiveCrop.value) },
        output: { width: dimensions.width, height: dimensions.height },
        scaleOffset: { x: scale.offsetX, y: scale.offsetY },
        processing: { ...toRaw(processing) },
      })
      result.value = markRaw(response.result)
      lastDurationMs.value = response.durationMs
      history.value = []
      future.value = []
      refreshPalette()
      const adjusted = dimensions.adjusted ? '，尺寸已约束到256以内' : ''
      status.value = `已生成 ${response.result.width} × ${response.result.height}，${palette.value.length} 色${adjusted}`
    } catch (error) {
      status.value = error instanceof Error ? error.message : '图像处理失败'
      throw error
    } finally {
      isProcessing.value = false
    }
  }

  function pushHistory(): void {
    if (!result.value) return
    history.value.push(cloneResult(result.value))
    if (history.value.length > 20) history.value.shift()
    future.value = []
  }

  function setPixel(x: number, y: number, color = selectedColor.value, record = true): void {
    if (!result.value || x < 0 || y < 0 || x >= result.value.width || y >= result.value.height) return
    if (record) pushHistory()
    const rgba = hexToRgba(color)
    const offset = (y * result.value.width + x) * 4
    result.value.data[offset] = rgba[0]
    result.value.data[offset + 1] = rgba[1]
    result.value.data[offset + 2] = rgba[2]
    result.value.data[offset + 3] = rgba[3]
    refreshPalette()
  }

  function pickPixel(x: number, y: number): void {
    if (!result.value || x < 0 || y < 0 || x >= result.value.width || y >= result.value.height) return
    const offset = (y * result.value.width + x) * 4
    selectedColor.value = rgbaToHex(
      result.value.data[offset],
      result.value.data[offset + 1],
      result.value.data[offset + 2],
      result.value.data[offset + 3],
    )
    pixelTool.value = 'brush'
  }

  function fillPixel(x: number, y: number): void {
    if (!result.value || x < 0 || y < 0 || x >= result.value.width || y >= result.value.height) return
    pushHistory()
    const width = result.value.width
    const height = result.value.height
    const start = y * width + x
    const startOffset = start * 4
    const target = [
      result.value.data[startOffset],
      result.value.data[startOffset + 1],
      result.value.data[startOffset + 2],
      result.value.data[startOffset + 3],
    ]
    const replacement = hexToRgba(selectedColor.value)
    if (target.every((value, index) => value === replacement[index])) return
    const visited = new Uint8Array(width * height)
    const queue = [start]
    while (queue.length > 0) {
      const current = queue.pop()!
      if (visited[current]) continue
      visited[current] = 1
      const offset = current * 4
      if (!target.every((value, index) => result.value!.data[offset + index] === value)) continue
      result.value.data.set(replacement, offset)
      const cx = current % width
      const cy = Math.floor(current / width)
      if (cx > 0) queue.push(current - 1)
      if (cx + 1 < width) queue.push(current + 1)
      if (cy > 0) queue.push(current - width)
      if (cy + 1 < height) queue.push(current + width)
    }
    refreshPalette()
  }

  function applyTool(x: number, y: number): void {
    if (pixelTool.value === 'eyedropper') pickPixel(x, y)
    else if (pixelTool.value === 'fill') fillPixel(x, y)
    else if (pixelTool.value === 'eraser') setPixel(x, y, '#00000000')
    else setPixel(x, y)
  }

  function mergeColor(fromHex: string, toHex: string): void {
    if (!result.value || fromHex === toHex) return
    pushHistory()
    const from = hexToRgba(fromHex)
    const to = hexToRgba(toHex)
    for (let offset = 0; offset < result.value.data.length; offset += 4) {
      if (
        result.value.data[offset] === from[0] &&
        result.value.data[offset + 1] === from[1] &&
        result.value.data[offset + 2] === from[2] &&
        result.value.data[offset + 3] === from[3]
      ) {
        result.value.data.set(to, offset)
      }
    }
    refreshPalette()
  }

  function undo(): void {
    if (!result.value || history.value.length === 0) return
    future.value.push(cloneResult(result.value))
    result.value = markRaw(history.value.pop()!)
    refreshPalette()
  }

  function redo(): void {
    if (!result.value || future.value.length === 0) return
    history.value.push(cloneResult(result.value))
    result.value = markRaw(future.value.pop()!)
    refreshPalette()
  }

  function serialize(): SerializedProject {
    return {
      format: 'pixel-anchor-project',
      version: 1,
      savedAt: new Date().toISOString(),
      source: source.value ? { ...source.value } : null,
      crop: { ...toRaw(crop) },
      cropSettings: { mode: cropSettings.mode, customRect: { ...toRaw(crop) } },
      anchor: { ...toRaw(anchor) },
      scale: { ...toRaw(scale) },
      processing: { ...toRaw(processing) },
      bead: { ...toRaw(bead) },
      result: result.value
        ? { width: result.value.width, height: result.value.height, dataBase64: bytesToBase64(result.value.data) }
        : null,
      colorCodes: { ...colorCodes.value },
    }
  }

  async function loadSerialized(project: SerializedProject): Promise<void> {
    if (project.source) {
      const image = await loadHtmlImage(project.source.dataUrl)
      source.value = { ...project.source }
      sourceImage.value = markRaw(image)
      sourceImageData.value = markRaw(imageToImageData(image))
    } else {
      source.value = null
      sourceImage.value = null
      sourceImageData.value = null
    }
    Object.assign(crop, project.crop)
    cropSettings.mode = project.cropSettings?.mode ?? 'custom'
    Object.assign(anchor, project.anchor)
    Object.assign(scale, project.scale)
    Object.assign(processing, project.processing)
    Object.assign(bead, project.bead)
    result.value = project.result
      ? markRaw({
          width: project.result.width,
          height: project.result.height,
          data: base64ToBytes(project.result.dataBase64),
        })
      : null
    colorCodes.value = { ...project.colorCodes }
    history.value = []
    future.value = []
    refreshPalette()
    status.value = '项目已打开'
  }

  return {
    source,
    sourceImage,
    sourceImageData,
    crop,
    anchor,
    scale,
    processing,
    bead,
    result,
    palette,
    selectedColor,
    editTarget,
    pixelTool,
    isProcessing,
    status,
    lastDurationMs,
    history,
    future,
    outputDimensions,
    canProcess,
    beadCount,
    canExportBead,
    sourceLabel,
    cropSettings,
    effectiveCrop,
    importImage,
    updateCrop,
    updateAnchor,
    resetCrop,
    centerSquareCrop,
    resetGridPhase,
    process,
    applyTool,
    mergeColor,
    undo,
    redo,
    serialize,
    loadSerialized,
    refreshPalette,
  }
})
