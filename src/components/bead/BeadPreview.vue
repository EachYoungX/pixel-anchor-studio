<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildLegendPageCommands, buildPatternPageCommands, buildSvgOverviewCommands } from '@/core/bead/document-commands'
import { createBeadDocumentLayout } from '@/core/bead/document-layout'
import { renderDocumentSvg } from '@/core/bead/render-document-svg'
import { useDocumentZoom } from '@/composables/useDocumentZoom'
import { useProjectStore } from '@/stores/project'

const PAGE_BASE_WIDTH = 900
const PAGE_BASE_HEIGHT = PAGE_BASE_WIDTH * 210 / 297
const DOCUMENT_PADDING = 24

const store = useProjectStore()
const viewport = ref<HTMLDivElement | null>(null)
const mode = ref<'pdf' | 'svg'>('pdf')
const documentZoom = useDocumentZoom()
const { zoom, fitting } = documentZoom
let observer: ResizeObserver | null = null

const layout = computed(() => store.result ? createBeadDocumentLayout(store.result, store.palette, store.bead) : null)
const pdfMarkup = computed(() => layout.value ? [...layout.value.pdfPages.map((page) => renderDocumentSvg(buildPatternPageCommands(page), page.pageWidth, page.pageHeight)), ...layout.value.pdfLegendPages.map((page) => renderDocumentSvg(buildLegendPageCommands(page), page.pageWidth, page.pageHeight))] : [])
const svgMarkup = computed(() => layout.value ? renderDocumentSvg(buildSvgOverviewCommands(layout.value.svgOverview, store.palette), layout.value.svgOverview.width, layout.value.svgOverview.height) : '')
const documentBaseSize = computed(() => {
  if (mode.value === 'svg' && layout.value) return { width: PAGE_BASE_WIDTH, height: PAGE_BASE_WIDTH * layout.value.svgOverview.height / layout.value.svgOverview.width }
  return { width: PAGE_BASE_WIDTH, height: PAGE_BASE_HEIGHT }
})
const documentStackWidth = computed(() => documentBaseSize.value.width * zoom.value + DOCUMENT_PADDING * 2)
const documentSheetWidth = computed(() => documentBaseSize.value.width * zoom.value)
const documentSheetHeight = computed(() => documentBaseSize.value.height * zoom.value)

function resetView(): void {
  const element = viewport.value
  if (!element) return
  if (mode.value === 'pdf') documentZoom.fitPage(element, PAGE_BASE_WIDTH, PAGE_BASE_HEIGHT)
  else documentZoom.fitWidth(element, documentBaseSize.value.width)
}

function changeZoom(direction: -1 | 1): void {
  if (viewport.value) documentZoom.changeByStep(direction, viewport.value)
}

function handleWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  if (!viewport.value) return
  event.preventDefault()
  changeZoom(event.deltaY < 0 ? 1 : -1)
}

function sheetStyle(): { width: string; height: string } {
  return { width: `${documentSheetWidth.value}px`, height: `${documentSheetHeight.value}px` }
}

function resetIfFitting(): void {
  if (fitting.value !== 'manual') nextTick(resetView)
}

watch(mode, () => nextTick(resetView))
watch(layout, resetIfFitting, { deep: false })

onMounted(() => {
  nextTick(resetView)
  if (viewport.value) {
    observer = new ResizeObserver(() => resetIfFitting())
    observer.observe(viewport.value)
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div v-if="store.result" class="bead-preview-shell">
    <div class="bead-preview-toolbar">
      <button class="button button-small" :class="{ 'button-active': mode === 'pdf' }" type="button" @click="mode = 'pdf'">PDF 分页</button>
      <button class="button button-small" :class="{ 'button-active': mode === 'svg' }" type="button" @click="mode = 'svg'">SVG 总览</button>
      <button class="button button-small" type="button" :disabled="zoom <= 0.5" @click="changeZoom(-1)">缩小</button>
      <button class="button button-small" type="button" @click="resetView">{{ mode === 'pdf' ? '适应页面' : '适应宽度' }}</button>
      <button class="button button-small" type="button" :disabled="zoom >= 2.5" @click="changeZoom(1)">放大</button>
    </div>
    <div ref="viewport" class="document-viewport" @wheel="handleWheel" @dblclick="resetView">
      <div class="document-stack" :style="{ width: `${documentStackWidth}px` }">
        <template v-if="mode === 'pdf'">
          <div v-for="(markup, index) in pdfMarkup" :key="index" class="document-sheet" :style="sheetStyle()" v-html="markup" />
        </template>
        <div v-else class="document-sheet document-sheet-svg" :style="sheetStyle()" v-html="svgMarkup" />
      </div>
    </div>
  </div>
  <div v-else class="empty-state">请先生成像素结果。</div>
</template>

<style scoped>
.bead-preview-shell { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.bead-preview-toolbar { display: flex; flex-wrap: wrap; gap: 6px; padding: 9px 12px; border-bottom: 1px solid var(--border); background: #fff; }
.document-viewport { min-width: 0; min-height: 0; overflow: auto; background: #e9ebee; }
.document-stack { min-width: 100%; min-height: 100%; display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 20px; }
.document-sheet { flex: none; background: #fff; border: 1px solid var(--border); }
.document-sheet :deep(svg) { display: block; width: 100%; height: 100%; }
</style>
