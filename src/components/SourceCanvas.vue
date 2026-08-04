<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useProjectStore } from '@/stores/project'
import type { Rect } from '@/types/project'

const store = useProjectStore()
const host = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const showGrid = ref(true)
const isPointerInside = ref(false)
let observer: ResizeObserver | null = null

interface ViewTransform {
  scale: number
  offsetX: number
  offsetY: number
}

interface Viewport {
  zoom: number
  panX: number
  panY: number
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
const viewport: Viewport = { zoom: 1, panX: 0, panY: 0 }
let drag: DragState | null = null
let spacePressed = false

const activeRect = computed(() => (store.editTarget === 'anchor' ? store.anchor : store.effectiveCrop))

function resizeCanvas(): void {
  if (!host.value || !canvas.value) return
  canvas.value.width = Math.max(320, Math.floor(host.value.clientWidth))
  canvas.value.height = Math.max(400, Math.min(620, Math.floor(window.innerHeight * 0.56)))
  draw()
}

function calculateView(): ViewTransform {
  if (!canvas.value || !store.source) return { scale: 1, offsetX: 0, offsetY: 0 }
  const padding = 24
  const fitScale = Math.min(
    (canvas.value.width - padding * 2) / store.source.width,
    (canvas.value.height - padding * 2) / store.source.height,
  )
  return {
    scale: fitScale * viewport.zoom,
    offsetX: (canvas.value.width - store.source.width * fitScale) / 2 + viewport.panX,
    offsetY: (canvas.value.height - store.source.height * fitScale) / 2 + viewport.panY,
  }
}

function resetViewport(): void {
  viewport.zoom = 1
  viewport.panX = 0
  viewport.panY = 0
  draw()
}

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  if (!canvas.value || !store.source) return
  const bounds = canvas.value.getBoundingClientRect()
  const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  const sourceX = (point.x - view.offsetX) / view.scale
  const sourceY = (point.y - view.offsetY) / view.scale
  const fitScale = view.scale / viewport.zoom
  viewport.zoom = Math.max(0.25, Math.min(16, viewport.zoom * Math.exp(-event.deltaY * 0.002)))
  const nextScale = fitScale * viewport.zoom
  viewport.panX = point.x - sourceX * nextScale - (canvas.value!.width - store.source!.width * fitScale) / 2
  viewport.panY = point.y - sourceY * nextScale - (canvas.value!.height - store.source!.height * fitScale) / 2
  draw()
}

function toScreen(rect: Rect): Rect {
  return {
    x: view.offsetX + rect.x * view.scale,
    y: view.offsetY + rect.y * view.scale,
    width: rect.width * view.scale,
    height: rect.height * view.scale,
  }
}

function drawChecker(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = '#F4F5F6'
  context.fillRect(0, 0, width, height)
  const size = 12
  context.fillStyle = '#E7E9EC'
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      if ((x / size + y / size) % 2 === 0) context.fillRect(x, y, size, size)
    }
  }
}

function drawGrid(context: CanvasRenderingContext2D): void {
  if (!showGrid.value || !store.source) return
  const crop = toScreen(store.effectiveCrop)
  const output = store.outputDimensions
  const stepX = Math.max(1, Math.ceil(output.width / 64))
  const stepY = Math.max(1, Math.ceil(output.height / 64))
  context.save()
  context.beginPath()
  context.rect(crop.x, crop.y, crop.width, crop.height)
  context.clip()
  context.strokeStyle = 'rgba(52, 73, 94, 0.30)'
  context.lineWidth = 1
  for (let x = 0; x <= output.width; x += stepX) {
    const position = crop.x + ((x + store.scale.offsetX) / output.width) * crop.width
    context.beginPath()
    context.moveTo(Math.round(position) + 0.5, crop.y)
    context.lineTo(Math.round(position) + 0.5, crop.y + crop.height)
    context.stroke()
  }
  for (let y = 0; y <= output.height; y += stepY) {
    const position = crop.y + ((y + store.scale.offsetY) / output.height) * crop.height
    context.beginPath()
    context.moveTo(crop.x, Math.round(position) + 0.5)
    context.lineTo(crop.x + crop.width, Math.round(position) + 0.5)
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
  const labelY = borderY >= labelHeight ? borderY - labelHeight : borderY
  context.fillRect(Math.floor(borderX), Math.floor(labelY), Math.ceil(labelWidth), labelHeight)
  context.fillStyle = '#FFFFFF'
  context.fillText(label, Math.floor(borderX + 6), Math.floor(labelY + labelHeight / 2))

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
  context.clearRect(0, 0, element.width, element.height)
  drawChecker(context, element.width, element.height)

  if (!store.sourceImage || !store.source) {
    context.fillStyle = '#69717A'
    context.font = '13px sans-serif'
    context.textAlign = 'center'
    context.fillText('导入图片后在此调整裁剪、锚点与网格', element.width / 2, element.height / 2)
    return
  }

  view = calculateView()
  context.drawImage(
    store.sourceImage,
    view.offsetX,
    view.offsetY,
    store.source.width * view.scale,
    store.source.height * view.scale,
  )

  const cropScreen = toScreen(store.effectiveCrop)
  context.save()
  context.fillStyle = 'rgba(20, 24, 28, 0.48)'
  context.beginPath()
  context.rect(view.offsetX, view.offsetY, store.source.width * view.scale, store.source.height * view.scale)
  context.rect(cropScreen.x, cropScreen.y, cropScreen.width, cropScreen.height)
  context.fill('evenodd')
  context.restore()

  drawGrid(context)
  drawRect(context, store.effectiveCrop, store.editTarget === 'crop', '裁剪区域', '#34495E')
  if (store.scale.mode === 'anchor') {
    drawRect(context, store.anchor, store.editTarget === 'anchor', '特征锚点', '#8B4A43')
  }
}

function pointerPosition(event: PointerEvent): { x: number; y: number } {
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

function onPointerDown(event: PointerEvent): void {
  if (!store.source || !canvas.value) return
  const point = pointerPosition(event)
  if (spacePressed || event.button === 1) {
    drag = { action: 'pan', handle: null, startX: point.x, startY: point.y, startRect: { x: viewport.panX, y: viewport.panY, width: 0, height: 0 }, snapStepX: 1, snapStepY: 1, snapOriginX: 0, snapOriginY: 0 }
    canvas.value.setPointerCapture(event.pointerId)
    return
  }
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
  if (drag.action === 'pan') {
    viewport.panX = drag.startRect.x + (point.x - drag.startX)
    viewport.panY = drag.startRect.y + (point.y - drag.startY)
    draw()
    return
  }
  let next: Rect
  if (drag.action === 'move') {
    next = { ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy }
  } else {
    next = resizedRect(drag.startRect, drag.handle, dx, dy)
  }
  if (store.scale.snapMode === 'target-cell') {
    next.x = drag.snapOriginX + Math.round((next.x - drag.snapOriginX) / drag.snapStepX) * drag.snapStepX
    next.y = drag.snapOriginY + Math.round((next.y - drag.snapOriginY) / drag.snapStepY) * drag.snapStepY
    next.width = Math.max(drag.snapStepX, Math.round(next.width / drag.snapStepX) * drag.snapStepX)
    next.height = Math.max(drag.snapStepY, Math.round(next.height / drag.snapStepY) * drag.snapStepY)
  }
  if (store.editTarget === 'anchor') store.updateAnchor(next)
  else store.updateCrop(next)
  draw()
}

function onPointerUp(event: PointerEvent): void {
  if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId)
  drag = null
}

watch(
  () => [store.source, store.effectiveCrop.x, store.effectiveCrop.y, store.effectiveCrop.width, store.effectiveCrop.height, store.anchor.x, store.anchor.y, store.anchor.width, store.scale.mode, store.scale.offsetX, store.scale.offsetY, store.outputDimensions.width, store.outputDimensions.height, store.editTarget, showGrid.value],
  () => nextTick(draw),
  { deep: false },
)

onMounted(() => {
  observer = new ResizeObserver(resizeCanvas)
  if (host.value) observer.observe(host.value)
  resizeCanvas()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

function onKeyDown(event: KeyboardEvent): void {
  const canvasFocused = document.activeElement === canvas.value
  if (!canvasFocused && !isPointerInside.value) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
  if (event.code === 'Space') { spacePressed = true; event.preventDefault() }
  if ((event.ctrlKey || event.metaKey) && event.key === '0') { event.preventDefault(); resetViewport() }
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.code === 'Space') spacePressed = false
}

function onCanvasKeydown(event: KeyboardEvent): void {
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
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <div ref="host" class="source-canvas-host">
    <div class="canvas-tools">
      <span>当前编辑：{{ store.editTarget === 'crop' ? '裁剪框' : '锚点框' }}</span>
      <span class="canvas-actions"><button class="button button-small" type="button" @click="resetViewport">适应窗口</button><span>{{ Math.round(viewport.zoom * 100) }}%</span><label><input v-model="showGrid" type="checkbox" /> 显示网格</label></span>
    </div>
    <canvas
      ref="canvas"
      class="source-canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerenter="isPointerInside = true"
      @pointerleave="isPointerInside = false; spacePressed = false"
      @wheel="onWheel"
      @dblclick="resetViewport"
      tabindex="0"
      @keydown="onCanvasKeydown"
    />
  </div>
</template>

<style scoped>
.source-canvas-host { position: relative; min-width: 0; background: #e9ebee; }
.canvas-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  background: #ffffff;
  border-bottom: 1px solid var(--border);
  color: #60676f;
  font-size: 11px;
}
.canvas-tools label { display: flex; align-items: center; gap: 5px; }
.canvas-actions { display: flex; align-items: center; gap: 8px; }
.source-canvas { width: 100%; display: block; touch-action: none; cursor: crosshair; }
</style>
