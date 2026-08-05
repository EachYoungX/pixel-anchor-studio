import { computed, markRaw, reactive, ref, toRaw, watch } from 'vue'
import { defineStore } from 'pinia'
import { hexToRgba } from '@/core/color'
import { calculateOutputDimensions } from '@/core/dimensions'
import { mergeSimilarColors } from '@/core/processing/palette-merge'
import { base64ToBytes } from '@/core/export/project'
import { ProcessingService } from '@/domain/processing/processing-service'
import { SourceSession } from '@/domain/source/source-session'
import { imageToImageData } from '@/core/image/load'
import type { SourceRuntime } from '@/domain/source/source-types'
import type { SourcePreview } from '@/runtime/source-preview'
import { createPaletteSnapshot, replacePaletteColor } from '@/domain/palette/palette-service'
import { serializeProject } from '@/domain/project/serialization'
import { centerSquareRect, clampSourceRect, fullSourceRect, normalizeSourceAnchor, snapSourceRect } from '@/domain/source/crop-service'
import { floodFillRgba, pixelMatchesRgba, readPixelHex, setPixelRgba, type DirtyBounds } from '@/domain/editor/pixel-operations'
import { clonePixelResult } from '@/domain/editor/history'
import { EditorSession } from '@/domain/editor/editor-session'
import { defaultBead, defaultProcessing, defaultScale } from '@/domain/project/defaults'
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
  ScaleMode,
  SnapSettings,
} from '@/types/project'

export const useProjectStore = defineStore('project', () => {
  const source = ref<SourceRuntime | null>(null)
  const sourceImage = ref<HTMLImageElement | null>(null)
  const sourcePreview = ref<SourcePreview | null>(null)
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
  const pixelEditDirtyBounds = ref<DirtyBounds | null>(null)
  const canUndo = computed(() => history.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const undoLabel = computed(() => history.value[history.value.length - 1]?.label ?? '撤销')
  const redoLabel = computed(() => future.value[future.value.length - 1]?.label ?? '重做')
  let latestProcessId = 0
  let sourceRevision = 0
  const sourceId = ref('source-0')
  let generatedResultRevision = 0
  const processingService = new ProcessingService()
  const sourceSession = new SourceSession()
  const editorSession = new EditorSession()

  function releaseCurrentSource(): void {
    latestProcessId += 1
    sourceRevision += 1
    processingService.releaseSource(sourceId.value)
    sourceSession.release()
    sourceId.value = `source-${sourceRevision}`
    source.value = null
    sourceImage.value = null
    sourcePreview.value = null
    result.value = null
    palette.value = []
    colorCodes.value = {}
    history.value = []
    future.value = []
    pixelEditDirtyBounds.value = null
    status.value = '已释放当前图片'
  }

  const effectiveCrop = computed<Rect>(() => {
    if (!source.value) return crop
    if (cropSettings.mode === 'full') return fullSourceRect(source.value.width, source.value.height)
    if (cropSettings.mode === 'center-square') return centerSquareRect(source.value.width, source.value.height)
    return crop
  })
  const outputDimensions = computed(() => calculateOutputDimensions(effectiveCrop.value, anchor, scale))
  const canProcess = computed(() => Boolean(source.value))
  const beadCount = computed(() => palette.value.reduce((total, entry) => total + entry.count, 0))
  const canExportBead = computed(() => Boolean(result.value && palette.value.length > 0 && palette.value.length <= bead.maxColors))
  const sourceLabel = computed(() => {
    if (!source.value) return '未导入图片'
    return `${source.value.name} · ${source.value.width} × ${source.value.height}`
  })

  function refreshPalette(): void {
    const snapshot = createPaletteSnapshot(result.value, colorCodes.value, paletteSort.value, selectedColor.value)
    palette.value = snapshot.entries
    colorCodes.value = snapshot.codeMap
    selectedColor.value = snapshot.selectedColor
  }

  watch(paletteSort, refreshPalette)

  function invalidateGeneratedResult(_reason: 'source' | 'crop' | 'scale' | 'processing' | 'manual-edit'): void {
    generatedResultRevision += 1
  }

  async function importImage(file: File): Promise<void> {
    releaseCurrentSource()
    const loaded = await sourceSession.openFile(file)
    source.value = loaded.source
    sourceImage.value = markRaw(loaded.image)
    sourcePreview.value = markRaw(loaded.preview)
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
    invalidateGeneratedResult('source')
    palette.value = []
    history.value = []
    future.value = []
    colorCodes.value = {}
    const memoryHint = loaded.estimatedRgbaBytes >= 120 * 1024 * 1024 ? ' 图片较大，处理将交给后台并可能需要更多时间。' : ''
    status.value = `图片已导入，调整裁剪和转换参数后生成预览。${memoryHint}`
  }

  function updateCrop(next: Rect): void {
    if (!source.value) return
    const snapped = scale.snapMode === 'source-pixel' ? snapSourceRect(next) : next
    Object.assign(crop, clampSourceRect(snapped, source.value.width, source.value.height, 8))
    cropSettings.mode = 'custom'
  }

  function updateAnchor(next: Rect): void {
    if (!source.value) return
    const square = Math.max(4, Math.min(next.width, next.height))
    const nextAnchor = { ...next, width: square, height: square }
    const snapped = scale.snapMode === 'source-pixel' ? snapSourceRect(nextAnchor) : nextAnchor
    Object.assign(anchor, normalizeSourceAnchor(snapped, source.value.width, source.value.height))
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
    const settings = { ...scale.snapSettings }
    settings[scale.mode] = scale.snapMode
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
    if (!source.value) return
    const processId = ++latestProcessId
    isProcessing.value = true
    status.value = '正在生成像素矩阵'
    try {
      const dimensions = outputDimensions.value
      const response = await processingService.process({
        sourceId: sourceId.value,
        source: {
          width: source.value.width,
          height: source.value.height,
          data: new Uint8ClampedArray(),
        },
        sourceFile: source.value.file,
        crop: { ...toRaw(effectiveCrop.value) },
        output: { width: dimensions.width, height: dimensions.height },
        grid: {
          cellSize: dimensions.geometry.cellSize,
          originX: dimensions.geometry.originX,
          originY: dimensions.geometry.originY,
        },
        processing: { ...toRaw(processing) },
      }, sourceId.value, () => {
        if (!sourceImage.value) throw new Error('原图兼容数据不可用，请重新导入图片')
        return imageToImageData(sourceImage.value).data
      })
      if (processId !== latestProcessId) return
      result.value = markRaw(response.result)
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
    history.value.push({ label, result: clonePixelResult(result.value) })
    if (history.value.length > 20) history.value.shift()
    future.value = []
  }

  function setPixel(x: number, y: number, color = selectedColor.value, record = true, label = '像素编辑'): void {
    if (!result.value || x < 0 || y < 0 || x >= result.value.width || y >= result.value.height) return
    const rgba = hexToRgba(color)
    if (pixelMatchesRgba(result.value, x, y, rgba)) return
    if (record) pushHistory(label)
    else if (editorSession.active && !editorSession.hasChanges) {
      const entry = editorSession.historyEntry()
      if (entry) history.value.push(entry)
      if (history.value.length > 20) history.value.shift()
      future.value = []
    }
    invalidateGeneratedResult('manual-edit')
    if (!setPixelRgba(result.value, x, y, rgba)) return
    if (editorSession.active) {
      const dirty = editorSession.recordChange(x, y)
      pixelEditDirtyBounds.value = { ...dirty }
    } else {
      refreshPalette()
    }
  }

  function beginPixelEdit(label: string): void {
    if (!result.value || editorSession.active) return
    pixelEditDirtyBounds.value = null
    editorSession.begin(result.value, label)
  }

  function endPixelEdit(): void {
    if (!editorSession.active) return
    if (editorSession.hasChanges) refreshPalette()
    editorSession.end()
  }

  function cancelPixelEdit(): void {
    if (!editorSession.active || !result.value) return
    const changed = editorSession.hasChanges
    const before = editorSession.cancel()
    if (before && changed) {
      result.value = markRaw(before)
      const last = history.value[history.value.length - 1]
      if (last?.label === '画笔' || last?.label === '橡皮擦') history.value.pop()
      refreshPalette()
    }
    pixelEditDirtyBounds.value = null
  }

  function consumePixelEditDirtyBounds(): DirtyBounds | null {
    const bounds = pixelEditDirtyBounds.value ? { ...pixelEditDirtyBounds.value } : null
    pixelEditDirtyBounds.value = null
    return bounds
  }

  function applyPixelChange(x: number, y: number, color: string): void {
    setPixel(x, y, color, false)
  }

  function pickPixel(x: number, y: number): void {
    if (!result.value) return
    const color = readPixelHex(result.value, x, y)
    if (!color) return
    selectedColor.value = color
    pixelTool.value = 'brush'
  }

  function fillPixel(x: number, y: number): void {
    if (!result.value) return
    pushHistory('填充')
    if (!floodFillRgba(result.value, x, y, hexToRgba(selectedColor.value))) {
      history.value.pop()
      return
    }
    invalidateGeneratedResult('manual-edit')
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
    pushHistory('合并颜色')
    invalidateGeneratedResult('manual-edit')
    if (!replacePaletteColor(result.value, fromHex, toHex)) {
      history.value.pop()
      return
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
    invalidateGeneratedResult('manual-edit')
    result.value = markRaw(merged.result)
    refreshPalette()
    status.value = merged.before === merged.after ? '没有找到符合条件的相近色' : `已合并相近色：${merged.before} 色 → ${merged.after} 色`
  }

  function undo(): void {
    if (!result.value || history.value.length === 0) return
    const previous = history.value.pop()!
    future.value.push({ label: previous.label, result: clonePixelResult(result.value) })
    result.value = markRaw(previous.result)
    invalidateGeneratedResult('manual-edit')
    refreshPalette()
  }

  function redo(): void {
    if (!result.value || future.value.length === 0) return
    const next = future.value.pop()!
    history.value.push({ label: next.label, result: clonePixelResult(result.value) })
    result.value = markRaw(next.result)
    invalidateGeneratedResult('manual-edit')
    refreshPalette()
  }

  async function serialize(): Promise<SerializedProject> {
    const largeSource = source.value ? source.value.width * source.value.height * 4 >= 120 * 1024 * 1024 : false
    status.value = largeSource
      ? '正在整理大型项目文件并写入原图，可能需要较多内存和时间……'
      : '正在整理项目文件并写入原图……'
    try {
      const document = await serializeProject({
        source: source.value,
        crop: { ...toRaw(crop) },
        cropSettings: { mode: cropSettings.mode, customRect: { ...toRaw(crop) } },
        anchor: { ...toRaw(anchor) },
        scale: { ...toRaw(scale), snapSettings: { ...scale.snapSettings } },
        processing: { ...toRaw(processing) },
        bead: { ...toRaw(bead) },
        result: result.value,
        colorCodes: colorCodes.value,
      })
      status.value = '项目文件已整理完成'
      return document
    } catch (error) {
      status.value = '项目文件整理失败，当前项目未受影响'
      throw error
    }
  }

  async function loadSerialized(project: SerializedProject): Promise<void> {
    releaseCurrentSource()
    if (project.source) {
      const bytes = base64ToBytes(project.source.dataBase64)
      const rawBytes = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(rawBytes).set(bytes)
      const blob = new Blob([rawBytes], { type: project.source.mime || 'image/png' })
      const loaded = await sourceSession.openBlob({ name: project.source.name, mime: project.source.mime, width: project.source.width, height: project.source.height, blob })
      source.value = loaded.source
      sourceImage.value = markRaw(loaded.image)
      sourcePreview.value = markRaw(loaded.preview)
    } else {
      source.value = null
      sourceImage.value = null
      sourcePreview.value = null
    }
    Object.assign(crop, project.cropSettings.customRect)
    cropSettings.mode = project.cropSettings.mode
    const sourceWidth = source.value?.width ?? Math.max(4, project.crop.x + project.crop.width)
    const sourceHeight = source.value?.height ?? Math.max(4, project.crop.y + project.crop.height)
    Object.assign(anchor, normalizeSourceAnchor(project.anchor, sourceWidth, sourceHeight))
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
    sourcePreview,
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
    beginPixelEdit,
    applyPixelChange,
    endPixelEdit,
    cancelPixelEdit,
    consumePixelEditDirtyBounds,
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
