<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useProjectStore } from '@/stores/project'
import type { PixelTool } from '@/types/project'

const store = useProjectStore()
const editorShell = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const viewport = ref<HTMLDivElement | null>(null)
const zoomLevels = [2, 3, 4, 5, 6, 8, 10, 12, 14]
const zoom = ref(8)
const painting = ref(false)
const panning = ref(false)
let panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 }
let lastPixel = ''
let spacePressed = false
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

  if (cell >= 6) {
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
  const modifier = event.ctrlKey || event.metaKey
  if (!modifier) return
  if (event.key.toLowerCase() === 'z' && event.shiftKey) {
    event.preventDefault()
    store.redo()
  } else if (event.key.toLowerCase() === 'z') {
    event.preventDefault()
    store.undo()
  } else if (event.key.toLowerCase() === 'y') {
    event.preventDefault()
    store.redo()
  }
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
  nextTick(() => {
    if (!viewport.value) return
    viewport.value.scrollLeft = logicalX * zoom.value - localX + padding
    viewport.value.scrollTop = logicalY * zoom.value - localY + padding
  })
}
function handleKeyup(event: KeyboardEvent): void {
  if (event.code === 'Space') spacePressed = false
}

watch(
  () => [store.result, store.palette, zoom.value],
  () => nextTick(draw),
  { deep: false },
)

onMounted(draw)
</script>

<template>
  <div ref="editorShell" v-if="store.result" class="preview-shell" tabindex="0" @keydown="handleKeydown" @keyup="handleKeyup">
    <div class="editor-toolbar">
      <div class="tool-group">
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
      <div class="tool-group">
        <label class="color-picker-label">
          当前颜色
          <input v-model="selectedColorForInput" class="color-picker" type="color" />
          <code>{{ store.selectedColor }}</code>
        </label>
      </div>
      <div class="tool-group">
        <button class="button button-small" type="button" :disabled="store.history.length === 0" @click="store.undo">撤销</button>
        <button class="button button-small" type="button" :disabled="store.future.length === 0" @click="store.redo">重做</button>
      </div>
      <label class="zoom-control">
        缩放
        <select v-model.number="zoom" class="select zoom-select">
          <option v-for="level in zoomLevels" :key="level" :value="level">{{ level }}×</option>
        </select>
        <output>{{ zoom }}×</output>
      </label>
    </div>
    <div ref="viewport" class="pixel-viewport" @wheel="handleWheel" @pointermove="handlePointerMove" @pointerup="handlePointerUp" @pointercancel="handlePointerUp">
      <canvas ref="canvas" class="pixel-canvas" @pointerdown="handlePointer" />
    </div>
  </div>
  <div v-else class="empty-state">
    生成预览后可在此查看像素结果并进行画笔、吸管、填充和透明处理。
  </div>
</template>

<style scoped>
.preview-shell { min-width: 0; }
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
.color-picker-label { display: flex; align-items: center; gap: 7px; color: #4f565e; font-size: 11px; }
.color-picker { width: 30px; height: 26px; padding: 1px; border: 1px solid var(--border-strong); border-radius: 5px; background: #ffffff; }
.color-picker-label code { color: #4b5158; font-size: 11px; }
.zoom-control { margin-left: auto; display: grid; grid-template-columns: auto 100px 28px; align-items: center; gap: 7px; color: #4f565e; font-size: 11px; }
.pixel-viewport { height: clamp(360px, 55vh, 620px); min-width: 0; overflow: auto; padding: 18px; background: #e9ebee; }
.pixel-canvas { display: block; margin: auto; background: #ffffff; touch-action: none; image-rendering: pixelated; cursor: crosshair; }
</style>
