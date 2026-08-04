<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { buildLegendPageCommands, buildPatternPageCommands, buildSvgOverviewCommands } from '@/core/bead/document-commands'
import { createBeadDocumentLayout } from '@/core/bead/document-layout'
import { renderDocumentSvg } from '@/core/bead/render-document-svg'
import { useViewportController } from '@/composables/useViewportController'
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
const viewport = ref<HTMLDivElement | null>(null)
const mode = ref<'pdf' | 'svg'>('pdf')
const controller = useViewportController({ initialZoom: 1, minZoom: 0.25, maxZoom: 3 })
const { zoom, panX, panY } = controller
let panning = false
let spacePressed = false
let panStart = { x: 0, y: 0, panX: 0, panY: 0 }

const layout = computed(() => store.result ? createBeadDocumentLayout(store.result, store.palette, store.bead) : null)
const pdfMarkup = computed(() => layout.value ? [...layout.value.pdfPages.map((page) => renderDocumentSvg(buildPatternPageCommands(page), page.pageWidth, page.pageHeight)), ...layout.value.pdfLegendPages.map((page) => renderDocumentSvg(buildLegendPageCommands(page), page.pageWidth, page.pageHeight))] : [])
const svgMarkup = computed(() => layout.value ? renderDocumentSvg(buildSvgOverviewCommands(layout.value.svgOverview, store.palette), layout.value.svgOverview.width, layout.value.svgOverview.height) : '')
const documentBaseSize = computed(() => {
  const width = 900
  if (!layout.value) return { width, height: 636 }
  if (mode.value === 'svg') return { width, height: width * layout.value.svgOverview.height / layout.value.svgOverview.width }
  const count = layout.value.pdfPages.length + layout.value.pdfLegendPages.length
  return { width, height: count * (width * 210 / 297) + Math.max(0, count - 1) * 18 }
})

function resetView(): void {
  if (viewport.value) controller.fitContent({ viewportWidth: viewport.value.clientWidth, viewportHeight: viewport.value.clientHeight, contentWidth: documentBaseSize.value.width, contentHeight: documentBaseSize.value.height, padding: 18 })
  else controller.resetView()
}

function handleWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  if (!viewport.value) return
  event.preventDefault()
  const bounds = viewport.value.getBoundingClientRect()
  controller.zoomAtPoint(event.clientX - bounds.left, event.clientY - bounds.top, Math.exp(-event.deltaY * 0.002))
}
function startPan(event: PointerEvent): void {
  if (!spacePressed && event.button !== 1) return
  panning = true
  panStart = { x: event.clientX, y: event.clientY, panX: panX.value, panY: panY.value }
  viewport.value?.setPointerCapture(event.pointerId)
}
function movePan(event: PointerEvent): void {
  if (!panning) return
  controller.panBy(event.clientX - panStart.x - (panX.value - panStart.panX), event.clientY - panStart.y - (panY.value - panStart.panY))
}
function endPan(event: PointerEvent): void {
  panning = false
  if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId)
}
function handleKeydown(event: KeyboardEvent): void { if (event.code === 'Space') { spacePressed = true; event.preventDefault() } }
function handleKeyup(event: KeyboardEvent): void { if (event.code === 'Space') spacePressed = false }

watch([layout, mode], () => nextTick(resetView), { deep: false })
onMounted(() => nextTick(resetView))
</script>

<template>
  <div v-if="store.result" class="bead-preview-shell" tabindex="0" @keydown="handleKeydown" @keyup="handleKeyup">
    <div class="bead-preview-toolbar">
      <button class="button button-small" :class="{ 'button-active': mode === 'pdf' }" type="button" @click="mode = 'pdf'">PDF 分页</button>
      <button class="button button-small" :class="{ 'button-active': mode === 'svg' }" type="button" @click="mode = 'svg'">SVG 总览</button>
      <button class="button button-small" type="button" @click="resetView">恢复视图</button>
    </div>
    <div ref="viewport" class="document-viewport" @wheel="handleWheel" @pointerdown="startPan" @pointermove="movePan" @pointerup="endPan" @pointercancel="endPan" @dblclick="resetView">
      <div class="document-transform-space" :style="{ width: `${documentBaseSize.width * zoom}px`, height: `${documentBaseSize.height * zoom}px` }">
        <div class="document-stack" :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }">
          <template v-if="mode === 'pdf'"><div v-for="(markup, index) in pdfMarkup" :key="index" class="document-sheet" v-html="markup" /></template>
          <div v-else class="document-sheet document-sheet-svg" v-html="svgMarkup" />
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty-state">请先生成像素结果。</div>
</template>

<style scoped>
.bead-preview-shell { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); outline: none; }
.bead-preview-toolbar { display: flex; flex-wrap: wrap; gap: 6px; padding: 9px 12px; border-bottom: 1px solid var(--border); background: #fff; }
.document-viewport { min-height: 0; overflow: auto; padding: 18px; background: #e9ebee; touch-action: none; }
.document-transform-space { position: relative; flex: none; }
.document-stack { width: 900px; transform-origin: top left; display: grid; justify-items: center; gap: 18px; padding: 4px; }
.document-sheet { width: 900px; aspect-ratio: 297 / 210; background: #fff; border: 1px solid var(--border); }
.document-sheet :deep(svg) { display: block; width: 100%; height: 100%; }
.document-sheet-svg { aspect-ratio: auto; height: auto; }
</style>
