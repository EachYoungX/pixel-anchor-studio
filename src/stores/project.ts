import { computed, markRaw, reactive, ref, toRaw, watch } from 'vue'
import { defineStore } from 'pinia'
import { hexToRgba, rgbToHsl, rgbaToHex } from '@/core/color'
import { calculateOutputDimensions } from '@/core/dimensions'
import { loadHtmlImage, loadSourceFile, imageToImageData } from '@/core/image/load'
import { buildPalette } from '@/core/palette'
import { mergeSimilarColors } from '@/core/processing/palette-merge'
import { base64ToBytes, bytesToBase64 } from '@/core/export/project'
import { releaseProcessingSource, runProcessing } from '@/core/worker-client'
import type {
  BeadSettings,
  CropMode,
  EditTarget,
  HistoryEntry,
  PaletteEntry,
  PixelResult,
  PixelTool,
  MergeStrength,
  PaletteSortMode,
  ProcessingSettings,
  Rect,
  ScaleSettings,
  SerializedProject,
  SourceState,
  ScaleMode,
  SnapSettings,
} from '@/types/project'

const defaultSnapSettings = (): SnapSettings => ({
  direct: 'source-pixel',
  anchor: 'source-pixel',
  pseudo: 'target-cell',
})

const defaultScale = (): ScaleSettings => ({
  mode: 'direct',
  directAxis: 'longSide',
  directValue: 64,
  anchorCells: 3,
  pseudoCellSize: 8,
  offsetX: 0,
  offsetY: 0,
  snapToGrid: false,
  snapMode: 'source-pixel',
  snapSettings: defaultSnapSettings(),
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

function snapRectToSourcePixels(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  }
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
  const mergeStrength = ref<MergeStrength>('off')
  const paletteSort = ref<PaletteSortMode>('count-desc')
  const editTarget = ref<EditTarget>('crop')
  const pixelTool = ref<PixelTool>('brush')
  const isProcessing = ref(false)
  const status = ref('导入图片后开始处理')
  const lastDurationMs = ref(0)
  const history = ref<HistoryEntry[]>([])
  const future = ref<HistoryEntry[]>([])
  const canUndo = computed(() => history.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const undoLabel = computed(() => history.value[history.value.length - 1]?.label ?? '撤销')
  const redoLabel = computed(() => future.value[future.value.length - 1]?.label ?? '重做')
  let latestProcessId = 0
  let sourceRevision = 0
  const sourceId = ref('source-0')
  let cachedProcessKey = ''
  let cachedProcessResult: PixelResult | null = null

  function releaseCurrentSource(): void {
    latestProcessId += 1
    sourceRevision += 1
    releaseProcessingSource(sourceId.value)
    sourceId.value = `source-${sourceRevision}`
    cachedProcessKey = ''
    cachedProcessResult = null
    source.value = null
    sourceImage.value = null
    sourceImageData.value = null
    result.value = null
    palette.value = []
    colorCodes.value = {}
    history.value = []
    future.value = []
    status.value = '已释放当前图片'
  }

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
    palette.value = [...built.entries].sort((a, b) => {
      if (paletteSort.value === 'code') return a.code.localeCompare(b.code)
      if (paletteSort.value === 'lightness') return (a.rgba[0] + a.rgba[1] + a.rgba[2]) - (b.rgba[0] + b.rgba[1] + b.rgba[2])
      if (paletteSort.value === 'hue') {
        const colorA = rgbToHsl(a.rgba[0], a.rgba[1], a.rgba[2])
        const colorB = rgbToHsl(b.rgba[0], b.rgba[1], b.rgba[2])
        const grayA = colorA.saturation < 0.08
        const grayB = colorB.saturation < 0.08
        if (grayA !== grayB) return grayA ? 1 : -1
        if (!grayA && colorA.hue !== colorB.hue) return colorA.hue - colorB.hue
        if (colorA.saturation !== colorB.saturation) return colorB.saturation - colorA.saturation
        return colorA.lightness - colorB.lightness
      }
      return b.count - a.count
    })
    colorCodes.value = built.codeMap
    if (palette.value.length > 0 && !palette.value.some((entry) => entry.hex === selectedColor.value)) {
      selectedColor.value = palette.value.find((entry) => entry.rgba[3] > 0)?.hex ?? '#202124'
    }
  }

  watch(paletteSort, refreshPalette)

  async function importImage(file: File): Promise<void> {
    releaseCurrentSource()
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
    const snapped = scale.snapMode === 'source-pixel' ? snapRectToSourcePixels(next) : next
    Object.assign(crop, clampRect(snapped, source.value.width, source.value.height, 8))
    cropSettings.mode = 'custom'
  }

  function updateAnchor(next: Rect): void {
    if (!source.value) return
    const square = Math.max(4, Math.min(next.width, next.height))
    const nextAnchor = { ...next, width: square, height: square }
    const snapped = scale.snapMode === 'source-pixel' ? snapRectToSourcePixels(nextAnchor) : nextAnchor
    Object.assign(anchor, clampRect(snapped, source.value.width, source.value.height, 4))
  }

  function useCustomCrop(): void {
    if (!source.value) return
    cropSettings.mode = 'custom'
    editTarget.value = 'crop'
  }

  function useFullCrop(): void {
    if (!source.value) return
    cropSettings.mode = 'full'
    editTarget.value = 'crop'
  }

  function useCenterSquareCrop(): void {
    if (!source.value) return
    cropSettings.mode = 'center-square'
    editTarget.value = 'crop'
  }

  function setScaleMode(mode: ScaleMode): void {
    const settings = scale.snapSettings ?? defaultSnapSettings()
    if (scale.snapMode) settings[scale.mode] = scale.snapMode
    scale.snapSettings = settings
    scale.mode = mode
    editTarget.value = mode === 'anchor' ? 'anchor' : 'crop'
    scale.snapMode = settings[mode]
  }

  function resetGridPhase(): void {
    scale.offsetX = 0
    scale.offsetY = 0
  }

  async function process(): Promise<void> {
    if (!sourceImageData.value || !source.value) return
    const processId = ++latestProcessId
    isProcessing.value = true
    status.value = '正在生成像素矩阵'
    try {
      const dimensions = outputDimensions.value
      const processKey = JSON.stringify({
        sourceRevision,
        crop: effectiveCrop.value,
        anchor,
        scale,
        processing,
      })
      if (cachedProcessKey === processKey && cachedProcessResult) {
        result.value = markRaw(cloneResult(cachedProcessResult))
        refreshPalette()
        status.value = `已复用 ${result.value.width} × ${result.value.height} 生成结果，${palette.value.length} 色`
        return
      }
      const response = await runProcessing({
        sourceId: sourceId.value,
        source: {
          width: sourceImageData.value.width,
          height: sourceImageData.value.height,
          data: sourceImageData.value.data,
        },
        crop: { ...toRaw(effectiveCrop.value) },
        output: { width: dimensions.width, height: dimensions.height },
        grid: {
          cellSize: dimensions.geometry.cellSize,
          originX: dimensions.geometry.originX,
          originY: dimensions.geometry.originY,
        },
        scaleOffset: { x: scale.offsetX, y: scale.offsetY },
        processing: { ...toRaw(processing) },
      }, sourceId.value)
      if (processId !== latestProcessId) return
      result.value = markRaw(response.result)
      cachedProcessKey = processKey
      cachedProcessResult = cloneResult(response.result)
      lastDurationMs.value = response.durationMs
      history.value = []
      future.value = []
      refreshPalette()
      const adjusted = dimensions.adjusted ? '，尺寸已约束到256以内' : ''
      status.value = `已生成 ${response.result.width} × ${response.result.height}，${palette.value.length} 色${adjusted}`
    } catch (error) {
      if (processId !== latestProcessId) return
      status.value = error instanceof Error ? error.message : '图像处理失败'
      throw error
    } finally {
      if (processId === latestProcessId) isProcessing.value = false
    }
  }

  function pushHistory(label: string): void {
    if (!result.value) return
    history.value.push({ label, result: cloneResult(result.value) })
    if (history.value.length > 20) history.value.shift()
    future.value = []
  }

  function setPixel(x: number, y: number, color = selectedColor.value, record = true, label = '像素编辑'): void {
    if (!result.value || x < 0 || y < 0 || x >= result.value.width || y >= result.value.height) return
    const rgba = hexToRgba(color)
    const offset = (y * result.value.width + x) * 4
    if (rgba.every((value, index) => value === result.value!.data[offset + index])) return
    if (record) pushHistory(label)
    cachedProcessKey = ''
    cachedProcessResult = null
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
    pushHistory('填充')
    cachedProcessKey = ''
    cachedProcessResult = null
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

  function applyTool(x: number, y: number, record = true): void {
    if (pixelTool.value === 'eyedropper') pickPixel(x, y)
    else if (pixelTool.value === 'fill') { if (record) fillPixel(x, y) }
    else if (pixelTool.value === 'eraser') setPixel(x, y, '#00000000', record, '橡皮擦')
    else setPixel(x, y, selectedColor.value, record, '画笔')
  }

  function mergeColor(fromHex: string, toHex: string): void {
    if (!result.value || fromHex === toHex) return
    const from = hexToRgba(fromHex)
    const to = hexToRgba(toHex)
    let changed = false
    for (let offset = 0; offset < result.value.data.length; offset += 4) {
      if (
        result.value.data[offset] === from[0] &&
        result.value.data[offset + 1] === from[1] &&
        result.value.data[offset + 2] === from[2] &&
        result.value.data[offset + 3] === from[3]
      ) {
        changed = true
        break
      }
    }
    if (!changed) return
    pushHistory('合并颜色')
    cachedProcessKey = ''
    cachedProcessResult = null
    for (let offset = 0; offset < result.value.data.length; offset += 4) {
      if (
        result.value.data[offset] === from[0] &&
        result.value.data[offset + 1] === from[1] &&
        result.value.data[offset + 2] === from[2] &&
        result.value.data[offset + 3] === from[3]
      ) result.value.data.set(to, offset)
    }
    refreshPalette()
  }

  function mergeSimilar(): void {
    if (!result.value || mergeStrength.value === 'off') return
    const merged = mergeSimilarColors(result.value, mergeStrength.value)
    if (merged.before === merged.after) {
      status.value = '没有找到符合条件的相近色'
      return
    }
    pushHistory('合并相近色')
    cachedProcessKey = ''
    cachedProcessResult = null
    result.value = markRaw(merged.result)
    refreshPalette()
    status.value = merged.before === merged.after ? '没有找到符合条件的相近色' : `已合并相近色：${merged.before} 色 → ${merged.after} 色`
  }

  function undo(): void {
    if (!result.value || history.value.length === 0) return
    const previous = history.value.pop()!
    future.value.push({ label: previous.label, result: cloneResult(result.value) })
    result.value = markRaw(previous.result)
    cachedProcessKey = ''
    cachedProcessResult = null
    refreshPalette()
  }

  function redo(): void {
    if (!result.value || future.value.length === 0) return
    const next = future.value.pop()!
    history.value.push({ label: next.label, result: cloneResult(result.value) })
    result.value = markRaw(next.result)
    cachedProcessKey = ''
    cachedProcessResult = null
    refreshPalette()
  }

  function serialize(): SerializedProject {
    return {
      format: 'pixel-anchor-project',
      version: 2,
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
    releaseCurrentSource()
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
    Object.assign(crop, project.cropSettings?.customRect ?? project.crop)
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
    mergeStrength,
    paletteSort,
    editTarget,
    pixelTool,
    isProcessing,
    status,
    lastDurationMs,
    history,
    future,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
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
    useCustomCrop,
    useFullCrop,
    useCenterSquareCrop,
    setScaleMode,
    resetGridPhase,
    process,
    applyTool,
    mergeColor,
    mergeSimilar,
    undo,
    redo,
    serialize,
    loadSerialized,
    refreshPalette,
    releaseCurrentSource,
  }
})
