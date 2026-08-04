<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useProjectStore } from '@/stores/project'
import type { PixelTool } from '@/types/project'
import { useViewportController } from '@/composables/useViewportController'

const store = useProjectStore()
const editorShell = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const viewport = ref<HTMLDivElement | null>(null)
const zoomLevels = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]
const viewportController = useViewportController({ initialZoom: 8, minZoom: 1, maxZoom: 24 })
const zoom = viewportController.zoom
const showGrid = ref(true)
const painting = ref(false)
const panning = ref(false)
let panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 }
let lastPixel = ''
let spacePressed = false
let observer: ResizeObserver | null = null
const viewportRevision = ref(0)
const toolOptions: Array<[PixelTool, string]> = [
  ['brush', '画笔'],
  ['eyedropper', '吸管'],
  ['fill', '填充'],
  ['eraser', '透明'],
]

const selectedColorForInput = computed({
  get: () => (store.selectedColor.length === 7 ? store.selectedColor : '#000000'),
  set: (value: string) => {
    store.selectedColor = value.toUpperCase()
  },
})
const stageSize = computed(() => {
  viewportRevision.value
  if (!store.result || !viewport.value) return { width: 0, height: 0 }
  return {
    width: Math.max(viewport.value.clientWidth - 36, store.result.width * zoom.value),
    height: Math.max(viewport.value.clientHeight - 36, store.result.height * zoom.value),
  }
})

function draw(): void {
  const element = canvas.value
  const result = store.result
  if (!element || !result) return
  const cell = zoom.value
  element.width = result.width * cell
  element.height = result.height * cell
  const context = element.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, element.width, element.height)

  const checker = Math.max(4, Math.floor(cell / 2))
  context.fillStyle = '#F5F6F7'
  context.fillRect(0, 0, element.width, element.height)
  context.fillStyle = '#E1E4E8'
  for (let y = 0; y < element.height; y += checker) {
    for (let x = 0; x < element.width; x += checker) {
      if ((x / checker + y / checker) % 2 === 0) context.fillRect(x, y, checker, checker)
    }
  }

  for (let y = 0; y < result.height; y += 1) {
    for (let x = 0; x < result.width; x += 1) {
      const offset = (y * result.width + x) * 4
      const alpha = result.data[offset + 3] / 255
      if (alpha <= 0) continue
      context.fillStyle = `rgba(${result.data[offset]}, ${result.data[offset + 1]}, ${result.data[offset + 2]}, ${alpha})`
      context.fillRect(x * cell, y * cell, cell, cell)
    }
  }

  if (showGrid.value && cell >= 6) {
    context.strokeStyle = 'rgba(70, 75, 82, 0.26)'
    context.lineWidth = 1
    for (let x = 0; x <= result.width; x += 1) {
      context.beginPath()
      context.moveTo(x * cell + 0.5, 0)
      context.lineTo(x * cell + 0.5, element.height)
      context.stroke()
    }
    for (let y = 0; y <= result.height; y += 1) {
      context.beginPath()
      context.moveTo(0, y * cell + 0.5)
      context.lineTo(element.width, y * cell + 0.5)
      context.stroke()
    }
  }
}

function pixelFromPointer(event: PointerEvent): { x: number; y: number } | null {
  if (!store.result || !canvas.value) return null
  const bounds = canvas.value.getBoundingClientRect()
  const scaleX = canvas.value.width / bounds.width
  const scaleY = canvas.value.height / bounds.height
  const x = Math.floor(((event.clientX - bounds.left) * scaleX) / zoom.value)
  const y = Math.floor(((event.clientY - bounds.top) * scaleY) / zoom.value)
  return { x, y }
}

function handlePointer(event: PointerEvent): void {
  editorShell.value?.focus({ preventScroll: true })
  if (spacePressed || event.button === 1) {
    if (!viewport.value) return
    panning.value = true
    panStart = { x: event.clientX, y: event.clientY, scrollLeft: viewport.value.scrollLeft, scrollTop: viewport.value.scrollTop }
    viewport.value.setPointerCapture(event.pointerId)
    return
  }
  const pixel = pixelFromPointer(event)
  if (!pixel) return
  painting.value = true
  lastPixel = `${pixel.x},${pixel.y}`
  canvas.value?.setPointerCapture(event.pointerId)
  store.applyTool(pixel.x, pixel.y)
  draw()
}

function handlePointerMove(event: PointerEvent): void {
  if (panning.value && viewport.value) {
    viewport.value.scrollLeft = panStart.scrollLeft - (event.clientX - panStart.x)
    viewport.value.scrollTop = panStart.scrollTop - (event.clientY - panStart.y)
    return
  }
  if (!painting.value) return
  const pixel = pixelFromPointer(event)
  if (!pixel) return
  const key = `${pixel.x},${pixel.y}`
  if (key === lastPixel) return
  lastPixel = key
  store.applyTool(pixel.x, pixel.y, false)
  draw()
}

function handlePointerUp(event: PointerEvent): void {
  if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId)
  if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId)
  panning.value = false
  painting.value = false
  lastPixel = ''
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
  if (event.code === 'Space') { spacePressed = true; event.preventDefault(); return }
}

function handleWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  if (!viewport.value) return
  event.preventDefault()
  const bounds = viewport.value.getBoundingClientRect()
  const localX = event.clientX - bounds.left
  const localY = event.clientY - bounds.top
  const padding = 18
  const oldZoom = zoom.value
  const logicalX = (viewport.value.scrollLeft + localX - padding) / oldZoom
  const logicalY = (viewport.value.scrollTop + localY - padding) / oldZoom
  const currentIndex = zoomLevels.indexOf(zoom.value)
  const direction = event.deltaY < 0 ? 1 : -1
  const nextIndex = Math.max(0, Math.min(zoomLevels.length - 1, currentIndex + direction))
  const nextZoom = zoomLevels[nextIndex]
  if (nextZoom === zoom.value) return
  zoom.value = nextZoom
  viewportController.setManual()
  nextTick(() => {
    if (!viewport.value) return
    viewport.value.scrollLeft = logicalX * zoom.value - localX + padding
    viewport.value.scrollTop = logicalY * zoom.value - localY + padding
  })
}

function resetView(): void {
  if (!store.result || !viewport.value) return
  const fitScale = Math.min((viewport.value.clientWidth - 36) / store.result.width, (viewport.value.clientHeight - 36) / store.result.height)
  const fit = Math.max(1, Math.floor(fitScale))
  viewportController.fitView()
  zoom.value = zoomLevels.reduce((best, level) => (level <= fit ? level : best), zoomLevels[0])
  viewport.value.scrollLeft = 0
  viewport.value.scrollTop = 0
}

function handleDoubleClick(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  resetView()
}
function handleKeyup(event: KeyboardEvent): void {
  if (event.code === 'Space') spacePressed = false
}

watch(
  () => [store.result, store.palette, zoom.value, showGrid.value],
  () => nextTick(draw),
  { deep: false },
)

onMounted(() => {
  draw()
  if (viewport.value) {
    observer = new ResizeObserver(() => {
      viewportRevision.value += 1
      if (viewportController.mode.value === 'fit') resetView()
      else nextTick(draw)
    })
    observer.observe(viewport.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="editorShell" v-if="store.result" class="preview-shell" tabindex="0" @keydown="handleKeydown" @keyup="handleKeyup">
    <div class="editor-toolbar">
      <div class="tool-group editor-tools">
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
      </div>
      <div class="tool-group color-tools">
        <label class="color-picker-label">
          当前颜色
          <input v-model="selectedColorForInput" class="color-picker" type="color" />
          <code>{{ store.selectedColor }}</code>
        </label>
      </div>
      <div class="tool-group view-actions">
        <button class="button button-small" type="button" @click="resetView">恢复视图</button>
        <label class="grid-toggle"><input v-model="showGrid" type="checkbox" /> 显示网格</label>
      </div>
    </div>
    <div ref="viewport" class="pixel-viewport" @wheel="handleWheel" @pointermove="handlePointerMove" @pointerup="handlePointerUp" @pointercancel="handlePointerUp" @dblclick="handleDoubleClick">
      <div class="pixel-stage" :style="{ width: `${stageSize.width}px`, height: `${stageSize.height}px` }"><canvas ref="canvas" class="pixel-canvas" @pointerdown="handlePointer" /></div>
    </div>
  </div>
  <div v-else class="empty-state">
    生成预览后可在此查看像素结果并进行画笔、吸管、填充和透明处理。
  </div>
</template>

<style scoped>
.preview-shell { height: 100%; min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
  background: #ffffff;
}
.tool-group { display: flex; align-items: center; gap: 5px; }
.view-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.grid-toggle { display: flex; align-items: center; gap: 5px; color: #60676f; font-size: 12px; white-space: nowrap; }
.color-picker-label { display: flex; align-items: center; gap: 7px; color: #4f565e; font-size: 11px; }
.color-picker { width: 30px; height: 26px; padding: 1px; border: 1px solid var(--border-strong); border-radius: 5px; background: #ffffff; }
.color-picker-label code { color: #4b5158; font-size: 11px; }
.pixel-viewport { min-height: 0; min-width: 0; overflow: auto; padding: 18px; background: #e9ebee; user-select: none; -webkit-user-select: none; }
.pixel-stage { min-width: 100%; min-height: 100%; display: grid; place-items: center; user-select: none; -webkit-user-select: none; }
.pixel-canvas { display: block; margin: auto; background: #ffffff; touch-action: none; image-rendering: pixelated; cursor: crosshair; user-select: none; -webkit-user-select: none; }
@media (max-width: 980px) {
  .view-actions { width: 100%; justify-content: flex-end; }
}
</style>
