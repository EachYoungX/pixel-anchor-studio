<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useProjectStore } from '@/stores/project'
import type { PixelTool } from '@/types/project'
import { useViewportController } from '@/composables/useViewportController'
import { useCanvasGestures } from '@/composables/useCanvasGestures'
import { useRafDraw } from '@/composables/useRafDraw'
import { screenToContent } from '@/core/viewport/viewport-math'

const store = useProjectStore()
const editorShell = ref<HTMLDivElement | null>(null)
const viewport = ref<HTMLDivElement | null>(null)
const imageCanvas = ref<HTMLCanvasElement | null>(null)
const overlayCanvas = ref<HTMLCanvasElement | null>(null)
const viewportController = useViewportController({
  initialZoom: 4,
  minZoom: 1,
  maxZoom: 24,
  normalizeZoom: (requested, direction) => direction > 0 ? Math.ceil(requested) : Math.floor(requested),
})
const zoom = viewportController.zoom
const showGrid = ref(true)
const painting = ref(false)
const transactionOpen = ref(false)
let lastPixel = ''
let observer: ResizeObserver | null = null
let fullImageDraw = true
const toolOptions: Array<[PixelTool, string]> = [
  ['brush', '画笔'],
  ['eyedropper', '吸管'],
  ['fill', '填充'],
  ['eraser', '透明'],
]

const selectedColorForInput = computed({
  get: () => (store.selectedColor.length === 7 ? store.selectedColor : '#000000'),
  set: (value: string) => { store.selectedColor = value.toUpperCase() },
})

const surfaceStyle = computed(() => ({
  width: `${store.result?.width ?? 0}px`,
  height: `${store.result?.height ?? 0}px`,
  transform: `translate(${viewportController.panX.value}px, ${viewportController.panY.value}px) scale(${zoom.value})`,
}))

function getLocalPoint(event: PointerEvent | WheelEvent): { x: number; y: number } {
  const bounds = viewport.value?.getBoundingClientRect()
  if (!bounds) return { x: 0, y: 0 }
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

function pixelFromPointer(event: PointerEvent): { x: number; y: number } | null {
  const result = store.result
  if (!result) return null
  const content = screenToContent(getLocalPoint(event), {
    zoom: zoom.value,
    panX: viewportController.panX.value,
    panY: viewportController.panY.value,
  })
  const x = Math.floor(content.x)
  const y = Math.floor(content.y)
  if (x < 0 || y < 0 || x >= result.width || y >= result.height) return null
  return { x, y }
}

function drawImage(): void {
  const canvas = imageCanvas.value
  const result = store.result
  if (!canvas || !result) return
  if (canvas.width !== result.width || canvas.height !== result.height) {
    canvas.width = result.width
    canvas.height = result.height
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.imageSmoothingEnabled = false
  const imageData = context.createImageData(result.width, result.height)
  imageData.data.set(result.data)
  const dirty = fullImageDraw ? null : store.consumePixelEditDirtyBounds()
  if (dirty) {
    context.putImageData(imageData, 0, 0, dirty.minX, dirty.minY, dirty.maxX - dirty.minX + 1, dirty.maxY - dirty.minY + 1)
  } else {
    context.clearRect(0, 0, result.width, result.height)
    context.putImageData(imageData, 0, 0)
  }
  fullImageDraw = false
}

function drawOverlay(): void {
  const canvas = overlayCanvas.value
  const result = store.result
  if (!canvas || !result) return
  if (canvas.width !== result.width || canvas.height !== result.height) {
    canvas.width = result.width
    canvas.height = result.height
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, result.width, result.height)
  if (!showGrid.value || zoom.value < 3) return
  context.save()
  context.strokeStyle = 'rgba(70, 75, 82, 0.28)'
  context.lineWidth = 1 / zoom.value
  context.beginPath()
  for (let x = 0; x <= result.width; x += 1) {
    context.moveTo(x, 0)
    context.lineTo(x, result.height)
  }
  for (let y = 0; y <= result.height; y += 1) {
    context.moveTo(0, y)
    context.lineTo(result.width, y)
  }
  context.stroke()
  context.restore()
}

function draw(): void {
  drawImage()
  drawOverlay()
}

const { scheduleDraw } = useRafDraw(draw)

function resetView(): void {
  const result = store.result
  const element = viewport.value
  if (!result || !element) return
  const fitScale = Math.min((element.clientWidth - 36) / result.width, (element.clientHeight - 36) / result.height)
  const nextZoom = Math.max(1, Math.min(24, Math.floor(fitScale)))
  viewportController.fitView()
  zoom.value = nextZoom
  viewportController.panX.value = Math.max(0, (element.clientWidth - result.width * nextZoom) / 2)
  viewportController.panY.value = Math.max(0, (element.clientHeight - result.height * nextZoom) / 2)
  scheduleDraw()
}

function handlePrimaryPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !store.result) return
  editorShell.value?.focus({ preventScroll: true })
  const pixel = pixelFromPointer(event)
  if (!pixel) return
  lastPixel = `${pixel.x},${pixel.y}`
  if (store.pixelTool === 'brush' || store.pixelTool === 'eraser') {
    store.beginPixelEdit(store.pixelTool === 'eraser' ? '橡皮擦' : '画笔')
    transactionOpen.value = true
    store.applyTool(pixel.x, pixel.y, false)
  } else {
    fullImageDraw = store.pixelTool === 'fill'
    store.applyTool(pixel.x, pixel.y)
  }
  painting.value = store.pixelTool === 'brush' || store.pixelTool === 'eraser'
  viewport.value?.setPointerCapture(event.pointerId)
  scheduleDraw()
}

function handlePrimaryPointerMove(event: PointerEvent): void {
  if (!painting.value) return
  const pixel = pixelFromPointer(event)
  if (!pixel) return
  const key = `${pixel.x},${pixel.y}`
  if (key === lastPixel) return
  lastPixel = key
  store.applyTool(pixel.x, pixel.y, false)
  scheduleDraw()
}

function handlePrimaryPointerUp(event: PointerEvent): void {
  if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId)
  if (transactionOpen.value) store.endPixelEdit()
  transactionOpen.value = false
  painting.value = false
  lastPixel = ''
  scheduleDraw()
}

const gestures = useCanvasGestures({
  element: viewport,
  viewport: viewportController,
  getLocalPoint,
  onPrimaryPointerDown: handlePrimaryPointerDown,
  onPrimaryPointerMove: handlePrimaryPointerMove,
  onPrimaryPointerUp: handlePrimaryPointerUp,
})

function handleDoubleClick(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  resetView()
}

watch(
  () => [store.result, showGrid.value],
  () => nextTick(() => {
    fullImageDraw = true
    if (viewportController.mode.value === 'fit') resetView()
    scheduleDraw()
  }),
  { deep: false },
)

onMounted(() => {
  observer = new ResizeObserver(() => {
    if (viewportController.mode.value === 'fit') resetView()
    else scheduleDraw()
  })
  if (viewport.value) observer.observe(viewport.value)
  scheduleDraw()
})
</script>

<template>
  <div v-if="store.result" ref="editorShell" class="preview-shell" tabindex="0">
    <div class="viewport-toolbar">
      <div class="viewport-toolbar__tools">
        <button
          v-for="tool in toolOptions"
          :key="tool[0]"
          class="button button-small"
          :class="{ 'button-active': store.pixelTool === tool[0] }"
          type="button"
          @click="store.pixelTool = tool[0]"
        >
          {{ tool[1] }}
        </button>
        <label class="color-picker-label">
          当前颜色
          <input v-model="selectedColorForInput" class="color-picker" type="color" />
          <code>{{ store.selectedColor }}</code>
        </label>
      </div>
      <div class="viewport-toolbar__actions">
        <button class="button button-small" type="button" @click="resetView">恢复视图</button>
        <label class="grid-toggle"><input v-model="showGrid" type="checkbox" /> 显示网格</label>
      </div>
    </div>
    <div
      ref="viewport"
      class="pixel-viewport checkerboard"
      @pointerdown="gestures.onPointerDown"
      @pointermove="gestures.onPointerMove"
      @pointerup="gestures.onPointerUp"
      @pointercancel="gestures.onPointerCancel"
      @pointerenter="gestures.onPointerEnter"
      @pointerleave="gestures.onPointerLeave"
      @wheel="gestures.onWheel"
      @dblclick="handleDoubleClick"
    >
      <div class="pixel-surface" :style="surfaceStyle">
        <canvas ref="imageCanvas" class="pixel-canvas" />
        <canvas ref="overlayCanvas" class="pixel-overlay" />
      </div>
    </div>
  </div>
  <div v-else class="empty-state">
    生成预览后可在此查看像素结果并进行画笔、吸管、填充和透明处理。
  </div>
</template>

<style scoped>
.preview-shell { height: 100%; min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.pixel-viewport { position: relative; min-height: 0; min-width: 0; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; }
.pixel-surface { position: absolute; left: 0; top: 0; transform-origin: 0 0; image-rendering: pixelated; }
.pixel-canvas, .pixel-overlay { position: absolute; left: 0; top: 0; display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.pixel-overlay { pointer-events: none; }
.grid-toggle { display: flex; align-items: center; gap: 5px; color: #60676f; font-size: 12px; white-space: nowrap; }
.color-picker-label { display: flex; align-items: center; gap: 7px; color: #4f565e; font-size: 11px; }
.color-picker { width: 30px; height: 26px; padding: 1px; border: 1px solid var(--border-strong); border-radius: 5px; background: #ffffff; }
.color-picker-label code { color: #4b5158; font-size: 11px; }
@media (max-width: 980px) {
  .viewport-toolbar__actions { width: 100%; justify-content: flex-end; }
}
</style>
