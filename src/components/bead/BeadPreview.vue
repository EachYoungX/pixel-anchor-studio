<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { createBeadDocumentLayout, type BeadPdfPageLayout } from '@/core/bead/document-layout'
import { renderBeadSvgMarkup } from '@/core/export/svg'
import { useViewportController } from '@/composables/useViewportController'
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
const viewport = ref<HTMLDivElement | null>(null)
const mode = ref<'pdf' | 'svg'>('pdf')
const viewportController = useViewportController({ initialZoom: 1, minZoom: 0.5, maxZoom: 3 })
const { zoom, panX, panY } = viewportController
let panning = false
let spacePressed = false
let panStart = { x: 0, y: 0, panX: 0, panY: 0 }

const layout = computed(() => store.result ? createBeadDocumentLayout(store.result, store.palette, store.bead) : null)
const svgMarkup = computed(() => layout.value ? renderBeadSvgMarkup(layout.value.svgOverview, store.palette) : '')

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)
}

function renderPdfPage(page: BeadPdfPageLayout): string {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.pageWidth} ${page.pageHeight}" role="img">`, '<rect width="100%" height="100%" fill="#fff"/>']
  parts.push(`<text x="12" y="12" font-size="8" fill="#23272a">${page.sliceX + 1}-${page.sliceX + page.sliceWidth} / ${page.sliceY + 1}-${page.sliceY + page.sliceHeight}</text>`)
  parts.push(`<text x="${page.pageWidth - 12}" y="12" text-anchor="end" font-size="8" fill="#23272a">第 ${page.pageNumber} / ${page.totalPages} 页</text>`)
  for (const cell of page.cells) {
    parts.push(`<rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}" fill="${cell.fill}" stroke="#aab0b6" stroke-width="0.35"/>`)
    if (cell.text && cell.width >= 4.2) parts.push(`<text x="${cell.x + cell.width / 2}" y="${cell.y + cell.height * 0.66}" text-anchor="middle" font-size="${Math.max(4, Math.min(7, cell.width * 0.9))}" fill="${cell.textColor}">${escapeXml(cell.text)}</text>`)
  }
  for (const label of page.columnLabels) {
    parts.push(`<text x="${label.x}" y="${label.y}" text-anchor="middle" font-size="5.5" fill="#282c30">${label.value}</text>`)
    parts.push(`<text x="${label.x}" y="${page.gridY + page.gridHeight + 4}" text-anchor="middle" font-size="5.5" fill="#282c30">${label.value}</text>`)
  }
  for (const label of page.rowLabels) {
    parts.push(`<text x="${label.x}" y="${label.y}" text-anchor="end" font-size="5.5" fill="#282c30">${label.value}</text>`)
    parts.push(`<text x="${page.gridX + page.gridWidth + 2}" y="${label.y}" font-size="5.5" fill="#282c30">${label.value}</text>`)
  }
  return `${parts.join('')}</svg>`
}

function renderLegendPage(): string {
  if (!layout.value?.pdfLegendPages[0]) return ''
  const legend = layout.value.pdfLegendPages[0]
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${legend.pageWidth} ${legend.pageHeight}" role="img">`, '<rect width="100%" height="100%" fill="#fff"/>', '<text x="14" y="16" font-size="14" fill="#1e2226">颜色与用量</text>']
  legend.entries.forEach((entry, index) => {
    const x = 14 + Math.floor(index / 16) * 68
    const y = 26 + (index % 16) * 10
    parts.push(`<rect x="${x}" y="${y - 5}" width="7" height="7" fill="${entry.hex}" stroke="#969ba0"/>`)
    parts.push(`<text x="${x + 11}" y="${y}" font-size="9" fill="#1e2226">${escapeXml(entry.code)}  ${escapeXml(entry.hex)}  ×${entry.count}</text>`)
  })
  return `${parts.join('')}</svg>`
}

const pdfMarkup = computed(() => layout.value ? [...layout.value.pdfPages.map(renderPdfPage), ...layout.value.pdfLegendPages.map(() => renderLegendPage())] : [])

function resetView(): void {
  viewportController.resetView()
  if (viewport.value) { viewport.value.scrollLeft = 0; viewport.value.scrollTop = 0 }
}

function handleWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  if (!viewport.value) return
  event.preventDefault()
  const bounds = viewport.value.getBoundingClientRect()
  const x = event.clientX - bounds.left
  const y = event.clientY - bounds.top
  viewportController.zoomAtPoint(x, y, Math.exp(-event.deltaY * 0.002))
}

function startPan(event: PointerEvent): void {
  if (!spacePressed && event.button !== 1) return
  panning = true
  panStart = { x: event.clientX, y: event.clientY, panX: panX.value, panY: panY.value }
  viewport.value?.setPointerCapture(event.pointerId)
}
function movePan(event: PointerEvent): void {
  if (!panning) return
  viewportController.panBy(event.clientX - panStart.x - (panX.value - panStart.panX), event.clientY - panStart.y - (panY.value - panStart.panY))
}
function endPan(event: PointerEvent): void {
  panning = false
  if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId)
}
function handleKeydown(event: KeyboardEvent): void {
  if (event.code === 'Space') { spacePressed = true; event.preventDefault() }
}
function handleKeyup(event: KeyboardEvent): void {
  if (event.code === 'Space') spacePressed = false
}

watch(layout, () => nextTick(resetView), { deep: false })
</script>

<template>
  <div v-if="store.result" class="bead-preview-shell" tabindex="0" @keydown="handleKeydown" @keyup="handleKeyup">
    <div class="bead-preview-toolbar">
      <button class="button button-small" :class="{ 'button-active': mode === 'pdf' }" type="button" @click="mode = 'pdf'">PDF 分页</button>
      <button class="button button-small" :class="{ 'button-active': mode === 'svg' }" type="button" @click="mode = 'svg'">SVG 总览</button>
      <button class="button button-small" type="button" @click="resetView">恢复视图</button>
    </div>
    <div ref="viewport" class="document-viewport" @wheel="handleWheel" @pointerdown="startPan" @pointermove="movePan" @pointerup="endPan" @pointercancel="endPan" @dblclick="resetView">
      <div class="document-stack" :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }">
        <template v-if="mode === 'pdf'">
          <div v-for="(markup, index) in pdfMarkup" :key="index" class="document-sheet" v-html="markup" />
        </template>
        <div v-else class="document-sheet document-sheet-svg" v-html="svgMarkup" />
      </div>
    </div>
  </div>
  <div v-else class="empty-state">请先生成像素结果。</div>
</template>

<style scoped>
.bead-preview-shell { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); outline: none; }
.bead-preview-toolbar { display: flex; flex-wrap: wrap; gap: 6px; padding: 9px 12px; border-bottom: 1px solid var(--border); background: #fff; }
.document-viewport { min-height: 0; overflow: auto; padding: 18px; background: #e9ebee; touch-action: none; }
.document-stack { width: max-content; min-width: 100%; transform-origin: top left; display: grid; justify-items: center; gap: 18px; padding: 4px; }
.document-sheet { width: min(920px, calc(100vw - 380px)); min-width: 560px; aspect-ratio: 297 / 210; background: #fff; border: 1px solid var(--border); box-shadow: 0 2px 8px rgba(20, 24, 28, 0.12); }
.document-sheet :deep(svg) { display: block; width: 100%; height: 100%; }
.document-sheet-svg { aspect-ratio: auto; height: auto; }
@media (max-width: 820px) { .document-sheet { width: calc(100vw - 48px); min-width: 0; } }
</style>
