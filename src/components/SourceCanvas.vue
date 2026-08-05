<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useViewportController } from '@/composables/useViewportController'
import { useCanvasGestures } from '@/composables/useCanvasGestures'
import { useRafDraw } from '@/composables/useRafDraw'
import { calculateOutputDimensions } from '@/core/dimensions'
import { calculateGridPreviewBounds, calculateGridPreviewStride, gridPreviewIndices } from '@/core/grid-preview'
import { clampSourceRect, snapSourceRect } from '@/domain/source/crop-service'
import type { Rect } from '@/types/project'

const store = useProjectStore()
const host = ref<HTMLDivElement | null>(null)
const tools = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const showGrid = ref(true)
let observer: ResizeObserver | null = null
let canvasCssSize = { width: 320, height: 400 }

interface ViewTransform {
  scale: number
  offsetX: number
  offsetY: number
}

interface DragState {
  action: 'move' | 'resize' | 'pan'
  handle: 'nw' | 'ne' | 'sw' | 'se' | null
  startX: number
  startY: number
  startRect: Rect
  snapStepX: number
  snapStepY: number
  snapOriginX: number
  snapOriginY: number
}

let view: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 }
const viewport = useViewportController({ initialZoom: 1, minZoom: 0.25, maxZoom: 16 })
let drag: DragState | null = null
const draftRect = ref<Rect | null>(null)

const activeRect = computed(() => (store.editTarget === 'anchor' ? store.anchor : store.effectiveCrop))
const displayedRect = computed(() => draftRect.value ?? activeRect.value)
const displayedCrop = computed(() => store.editTarget === 'crop' && draftRect.value ? draftRect.value : store.effectiveCrop)
const displayedAnchor = computed(() => store.editTarget === 'anchor' && draftRect.value ? draftRect.value : store.anchor)

function baseFitScale(): number {
  if (!store.source) return 1
  const padding = 24
  return Math.min(
    (canvasCssSize.width - padding * 2) / store.source.width,
    (canvasCssSize.height - padding * 2) / store.source.height,
  )
}

function resizeCanvas(): void {
  if (!host.value || !canvas.value) return
  const width = Math.max(320, Math.floor(host.value.clientWidth))
  const toolbarHeight = tools.value?.offsetHeight ?? 0
  const height = Math.max(320, Math.floor(host.value.clientHeight - toolbarHeight))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvasCssSize = { width, height }
  canvas.value.width = Math.floor(width * dpr)
  canvas.value.height = Math.floor(height * dpr)
  canvas.value.style.width = `${width}px`
  canvas.value.style.height = `${height}px`
  if (viewport.mode.value === 'fit') viewport.resetView()
  scheduleDraw()
}

function calculateView(): ViewTransform {
  if (!canvas.value || !store.source) return { scale: 1, offsetX: 0, offsetY: 0 }
  const fitScale = baseFitScale()
  return {
    scale: fitScale * viewport.zoom.value,
    offsetX: (canvasCssSize.width - store.source.width * fitScale) / 2 + viewport.panX.value,
    offsetY: (canvasCssSize.height - store.source.height * fitScale) / 2 + viewport.panY.value,
  }
}

function resetViewport(): void {
  viewport.resetView()
  scheduleDraw()
}

function toScreen(rect: Rect): Rect {
  return {
    x: view.offsetX + rect.x * view.scale,
    y: view.offsetY + rect.y * view.scale,
    width: rect.width * view.scale,
    height: rect.height * view.scale,
  }
}

function drawGrid(context: CanvasRenderingContext2D, cropRect: Rect): void {
  if (!showGrid.value || !store.source) return
  const crop = toScreen(cropRect)
  const output = calculateOutputDimensions(cropRect, displayedAnchor.value, store.scale)
  const geometry = output.geometry
  const stride = calculateGridPreviewStride(output.width, output.height, geometry.cellSize * view.scale)
  const bounds = calculateGridPreviewBounds(geometry, view.scale, view.offsetX, view.offsetY)
  context.save()
  context.beginPath()
  context.rect(crop.x, crop.y, crop.width, crop.height)
  context.clip()
  context.strokeStyle = 'rgba(52, 73, 94, 0.30)'
  context.lineWidth = 1
  for (const x of gridPreviewIndices(output.width, stride)) {
    const position = view.offsetX + (geometry.originX + x * geometry.cellSize) * view.scale
    context.beginPath()
    context.moveTo(Math.round(position) + 0.5, bounds.top)
    context.lineTo(Math.round(position) + 0.5, bounds.bottom)
    context.stroke()
  }
  for (const y of gridPreviewIndices(output.height, stride)) {
    const position = view.offsetY + (geometry.originY + y * geometry.cellSize) * view.scale
    context.beginPath()
    context.moveTo(bounds.left, Math.round(position) + 0.5)
    context.lineTo(bounds.right, Math.round(position) + 0.5)
    context.stroke()
  }
  context.restore()
}

function drawRect(context: CanvasRenderingContext2D, rect: Rect, active: boolean, label: string, color: string): void {
  const screen = toScreen(rect)
  const borderX = Math.round(screen.x) + 0.5
  const borderY = Math.round(screen.y) + 0.5
  const borderWidth = Math.max(1, Math.round(screen.width))
  const borderHeight = Math.max(1, Math.round(screen.height))
  context.save()
  context.strokeStyle = color
  context.lineWidth = active ? 2 : 1.2
  context.setLineDash(active ? [] : [6, 4])
  context.strokeRect(borderX, borderY, borderWidth, borderHeight)
  context.setLineDash([])
  context.fillStyle = color
  context.font = '12px sans-serif'
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  const labelWidth = context.measureText(label).width + 12
  const labelHeight = 20
  const labelX = Math.floor(borderX)
  const labelY = Math.floor(borderY - labelHeight)
  const labelVisible = labelX >= 0 && labelY >= 0 && labelX + labelWidth <= canvasCssSize.width && labelY + labelHeight <= canvasCssSize.height
  if (labelVisible) {
    context.fillRect(labelX, labelY, Math.ceil(labelWidth), labelHeight)
    context.fillStyle = '#FFFFFF'
    context.fillText(label, labelX + 6, labelY + labelHeight / 2)
  }

  if (active) {
    const handleSize = 8
    const points = [
      [screen.x, screen.y],
      [screen.x + screen.width, screen.y],
      [screen.x, screen.y + screen.height],
      [screen.x + screen.width, screen.y + screen.height],
    ]
    context.fillStyle = '#FFFFFF'
    context.strokeStyle = color
    for (const [x, y] of points) {
      context.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      context.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
    }
  }
  context.restore()
}

function draw(): void {
  const element = canvas.value
  if (!element) return
  const context = element.getContext('2d')
  if (!context) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, canvasCssSize.width, canvasCssSize.height)

  if (!store.sourceImage || !store.source) {
    context.fillStyle = '#69717A'
    context.font = '13px sans-serif'
    context.textAlign = 'center'
    context.fillText('导入图片后在此调整裁剪、锚点与网格', canvasCssSize.width / 2, canvasCssSize.height / 2)
    return
  }

  view = calculateView()
  const preview = store.sourcePreview
  const displayWidth = store.source.width * view.scale
  const displaySource = preview && displayWidth <= preview.width * 1.5 ? preview.image : store.sourceImage
  context.drawImage(
    displaySource,
    view.offsetX,
    view.offsetY,
    store.source.width * view.scale,
    store.source.height * view.scale,
  )

  const cropScreen = toScreen(displayedCrop.value)
  context.save()
  context.fillStyle = 'rgba(20, 24, 28, 0.48)'
  context.beginPath()
  context.rect(view.offsetX, view.offsetY, store.source.width * view.scale, store.source.height * view.scale)
  context.rect(cropScreen.x, cropScreen.y, cropScreen.width, cropScreen.height)
  context.fill('evenodd')
  context.restore()

  drawGrid(context, displayedCrop.value)
  drawRect(context, displayedCrop.value, store.editTarget === 'crop', '裁剪区域', '#34495E')
  if (store.scale.mode === 'anchor') {
    drawRect(context, displayedAnchor.value, store.editTarget === 'anchor', '特征锚点', '#8B4A43')
  }
}

function pointerPosition(event: PointerEvent | WheelEvent): { x: number; y: number } {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function detectHandle(point: { x: number; y: number }, rect: Rect): DragState['handle'] {
  const screen = toScreen(rect)
  const threshold = 12
  const candidates: Array<[DragState['handle'], number, number]> = [
    ['nw', screen.x, screen.y],
    ['ne', screen.x + screen.width, screen.y],
    ['sw', screen.x, screen.y + screen.height],
    ['se', screen.x + screen.width, screen.y + screen.height],
  ]
  for (const [handle, x, y] of candidates) {
    if (Math.abs(point.x - x) <= threshold && Math.abs(point.y - y) <= threshold) return handle
  }
  return null
}

function contains(point: { x: number; y: number }, rect: Rect): boolean {
  const screen = toScreen(rect)
  return point.x >= screen.x && point.x <= screen.x + screen.width && point.y >= screen.y && point.y <= screen.y + screen.height
}

function onPrimaryPointerDown(event: PointerEvent): void {
  if (!store.source || !canvas.value) return
  const point = pointerPosition(event)
  const current = { ...activeRect.value }
  const handle = detectHandle(point, current)
  if (!handle && !contains(point, current)) return
  drag = {
    action: handle ? 'resize' : 'move',
    handle,
    startX: point.x,
    startY: point.y,
    startRect: current,
    snapStepX: store.effectiveCrop.width / Math.max(1, store.outputDimensions.width),
    snapStepY: store.effectiveCrop.height / Math.max(1, store.outputDimensions.height),
    snapOriginX: store.effectiveCrop.x,
    snapOriginY: store.effectiveCrop.y,
  }
  draftRect.value = current
  canvas.value.setPointerCapture(event.pointerId)
}

function resizedRect(start: Rect, handle: DragState['handle'], dx: number, dy: number): Rect {
  if (!handle) return { ...start }
  if (store.editTarget === 'anchor') {
    const signX = handle.includes('e') ? 1 : -1
    const signY = handle.includes('s') ? 1 : -1
    const delta = Math.abs(dx) > Math.abs(dy) ? dx * signX : dy * signY
    const side = Math.max(4, start.width + delta)
    return {
      x: handle.includes('w') ? start.x + start.width - side : start.x,
      y: handle.includes('n') ? start.y + start.height - side : start.y,
      width: side,
      height: side,
    }
  }

  const next = { ...start }
  if (handle.includes('w')) {
    next.x = start.x + dx
    next.width = start.width - dx
  }
  if (handle.includes('e')) next.width = start.width + dx
  if (handle.includes('n')) {
    next.y = start.y + dy
    next.height = start.height - dy
  }
  if (handle.includes('s')) next.height = start.height + dy
  return next
}

function onPointerMove(event: PointerEvent): void {
  if (!drag) return
  const point = pointerPosition(event)
  const dx = (point.x - drag.startX) / view.scale
  const dy = (point.y - drag.startY) / view.scale
  let next: Rect
  if (drag.action === 'move') {
    next = { ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy }
  } else {
    next = resizedRect(drag.startRect, drag.handle, dx, dy)
  }
  const canTargetSnap = store.scale.snapMode === 'target-cell' && !(store.editTarget === 'anchor' && drag.action === 'resize')
  if (canTargetSnap) {
    next.x = drag.snapOriginX + Math.round((next.x - drag.snapOriginX) / drag.snapStepX) * drag.snapStepX
    next.y = drag.snapOriginY + Math.round((next.y - drag.snapOriginY) / drag.snapStepY) * drag.snapStepY
    next.width = Math.max(drag.snapStepX, Math.round(next.width / drag.snapStepX) * drag.snapStepX)
    next.height = Math.max(drag.snapStepY, Math.round(next.height / drag.snapStepY) * drag.snapStepY)
  }
  if (store.source) {
    if (store.editTarget === 'anchor') {
      const side = Math.max(4, Math.min(next.width, next.height))
      const square = { ...next, width: side, height: side }
      draftRect.value = clampSourceRect(store.scale.snapMode === 'source-pixel' ? snapSourceRect(square) : square, store.source.width, store.source.height, 4)
    } else {
      draftRect.value = clampSourceRect(store.scale.snapMode === 'source-pixel' ? snapSourceRect(next) : next, store.source.width, store.source.height, 8)
    }
  }
  scheduleDraw()
}

function onPointerUp(event: PointerEvent): void {
  const committed = draftRect.value
  if (committed) {
    if (store.editTarget === 'anchor') store.updateAnchor(committed)
    else store.updateCrop(committed)
  }
  draftRect.value = null
  drag = null
  if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId)
  scheduleDraw()
}

function onPointerCaptureLost(): void {
  draftRect.value = null
  drag = null
  scheduleDraw()
}

const gestures = useCanvasGestures({
  element: canvas,
  viewport,
  getLocalPoint: (event) => {
    const point = pointerPosition(event)
    const fitScale = baseFitScale()
    return store.source
      ? { x: point.x - (canvasCssSize.width - store.source.width * fitScale) / 2, y: point.y - (canvasCssSize.height - store.source.height * fitScale) / 2 }
      : point
  },
  onZoomWheel: (event, point) => viewport.zoomAtPoint(point.x, point.y, Math.exp(-event.deltaY * 0.002)),
  onPrimaryPointerDown,
  onPrimaryPointerMove: onPointerMove,
  onPrimaryPointerUp: onPointerUp,
  onPointerCaptureLost,
})

const { scheduleDraw } = useRafDraw(draw)

watch(
  () => [store.source, store.effectiveCrop.x, store.effectiveCrop.y, store.effectiveCrop.width, store.effectiveCrop.height, store.anchor.x, store.anchor.y, store.anchor.width, store.scale.mode, store.scale.offsetX, store.scale.offsetY, store.outputDimensions.width, store.outputDimensions.height, store.editTarget, showGrid.value],
  () => nextTick(scheduleDraw),
  { deep: false },
)

watch(
  () => [viewport.zoom.value, viewport.panX.value, viewport.panY.value],
  () => scheduleDraw(),
  { deep: false },
)

onMounted(() => {
  observer = new ResizeObserver(resizeCanvas)
  if (host.value) observer.observe(host.value)
  resizeCanvas()
})

function onCanvasKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === '0') {
    event.preventDefault()
    resetViewport()
    return
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  if (!store.source) return
  const step = event.shiftKey ? 10 : 1
  const next = { ...activeRect.value }
  if (event.key === 'ArrowLeft') next.x -= step
  if (event.key === 'ArrowRight') next.x += step
  if (event.key === 'ArrowUp') next.y -= step
  if (event.key === 'ArrowDown') next.y += step
  event.preventDefault()
  if (store.editTarget === 'anchor') store.updateAnchor(next)
  else store.updateCrop(next)
}

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <div ref="host" class="source-canvas-host">
    <div ref="tools" class="viewport-toolbar">
      <span>当前编辑：{{ store.editTarget === 'crop' ? '裁剪框' : '锚点框' }}</span>
      <span class="viewport-toolbar__actions"><button class="button button-small" type="button" @click="resetViewport">恢复视图</button><label class="grid-toggle"><input v-model="showGrid" type="checkbox" /> 显示网格</label></span>
    </div>
    <canvas
      ref="canvas"
      class="source-canvas checkerboard"
      @pointerdown="gestures.onPointerDown"
      @pointermove="gestures.onPointerMove"
      @pointerup="gestures.onPointerUp"
      @pointercancel="gestures.onPointerCancel"
      @pointerenter="gestures.onPointerEnter"
      @pointerleave="gestures.onPointerLeave"
      @lostpointercapture="gestures.onLostPointerCapture"
      @wheel="gestures.onWheel"
      @dblclick="resetViewport"
      tabindex="0"
      @keydown="onCanvasKeydown"
    />
  </div>
</template>

<style scoped>
.source-canvas-host { position: relative; height: 100%; min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); background: #e9ebee; }
.viewport-toolbar > span:first-child { color: #60676f; font-size: 12px; }
.source-canvas { width: 100%; display: block; touch-action: none; cursor: crosshair; }
</style>
