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

const surfaceDimensions = computed(() => ({
  width: (store.result?.width ?? 0) * zoom.value,
  height: (store.result?.height ?? 0) * zoom.value,
}))

const surfaceStyle = computed(() => ({
  width: `${surfaceDimensions.value.width}px`,
  height: `${surfaceDimensions.value.height}px`,
  transform: `translate(${viewportController.panX.value}px, ${viewportController.panY.value}px)`,
}))

const gridPath = computed(() => {
  const result = store.result
  if (!result) return ''
  const width = surfaceDimensions.value.width
  const height = surfaceDimensions.value.height
  const commands: string[] = []
  for (let x = 0; x <= result.width; x += 1) {
    const position = x === result.width ? width - 0.5 : x * zoom.value + 0.5
    commands.push(`M${position} 0V${height}`)
  }
  for (let y = 0; y <= result.height; y += 1) {
    const position = y === result.height ? height - 0.5 : y * zoom.value + 0.5
    commands.push(`M0 ${position}H${width}`)
  }
  return commands.join('')
})

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

const { scheduleDraw } = useRafDraw(drawImage)

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
  () => store.result,
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
        <svg
          v-if="showGrid && zoom >= 3"
          class="pixel-grid"
          :viewBox="`0 0 ${surfaceDimensions.width} ${surfaceDimensions.height}`"
          aria-hidden="true"
        >
          <path class="pixel-grid__lines" :d="gridPath" />
        </svg>
      </div>
    </div>
  </div>
  <div v-else class="canvas-empty-state checkerboard">
    生成预览后可在此查看像素结果并进行画笔、吸管、填充和透明处理。
  </div>
</template>

<style scoped>
.preview-shell { height: 100%; min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.pixel-viewport { position: relative; min-height: 0; min-width: 0; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; }
.pixel-surface { position: absolute; left: 0; top: 0; transform-origin: 0 0; image-rendering: pixelated; }
.pixel-canvas { position: absolute; left: 0; top: 0; display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.pixel-grid {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}
.pixel-grid__lines {
  fill: none;
  stroke: rgba(52, 58, 64, 0.42);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  shape-rendering: crispEdges;
}
.grid-toggle { display: flex; align-items: center; gap: 5px; color: #60676f; font-size: 12px; white-space: nowrap; }
.color-picker-label { display: flex; align-items: center; gap: 7px; color: #4f565e; font-size: 11px; }
.color-picker { width: 30px; height: 26px; padding: 1px; border: 1px solid var(--border-strong); border-radius: 5px; background: #ffffff; }
.color-picker-label code { color: #4b5158; font-size: 11px; }
</style>
