<script setup lang="ts">
import { useProjectStore } from '@/stores/project'
import { exportPaletteCsv } from '@/core/export/csv'
import { exportBeadPdf } from '@/core/export/pdf'
import { exportBeadSvg } from '@/core/export/svg'
import { sanitizeFilename } from '@/core/export/download'

const store = useProjectStore()

function baseName(): string { return sanitizeFilename(store.source?.name ?? 'pixel-art') }
function saveSvg(): void {
  if (!store.result || !store.canExportBead) return
  exportBeadSvg(store.result, store.palette, `${baseName()}-bead-chart.svg`, store.bead.cellSize, store.bead.indexFromOne)
}
function savePdf(): void {
  if (!store.result || !store.canExportBead) return
  exportBeadPdf(store.result, store.palette, store.bead, `${baseName()}-bead-chart.pdf`)
}
function saveCsv(): void {
  if (!store.result) return
  exportPaletteCsv(store.palette, `${baseName()}-palette.csv`)
}
</script>

<template>
  <aside>
    <section class="settings-section">
      <div class="section-title"><h2>拼豆图设置</h2></div>
      <div class="two-column">
        <label class="field">每页列数<input v-model.number="store.bead.pageColumns" class="input" type="number" min="5" max="80" /></label>
        <label class="field">每页行数<input v-model.number="store.bead.pageRows" class="input" type="number" min="5" max="80" /></label>
      </div>
      <label class="checkbox-row"><span>行列编号从 1 开始</span><input v-model="store.bead.indexFromOne" type="checkbox" /></label>
      <label class="field">拼豆最大颜色数<input v-model.number="store.bead.maxColors" class="input" type="number" min="2" max="256" /></label>
      <p v-if="store.palette.length > store.bead.maxColors" class="warning">当前 {{ store.palette.length }} 色，超过拼豆上限 {{ store.bead.maxColors }}。</p>
      <p v-if="store.bead.pageColumns > 48 || store.bead.pageRows > 48" class="warning">每页超过 48 格时，A4 导出单格和色号会较小，建议使用 32–48 格/页。</p>
    </section>
    <section class="settings-section bead-export-section">
      <div class="section-title"><h2>导出</h2></div>
      <strong>{{ store.beadCount }} 个有色格</strong>
      <p>{{ store.palette.length }} 种颜色 · {{ store.result ? Math.ceil(store.result.width / store.bead.pageColumns) * Math.ceil(store.result.height / store.bead.pageRows) : 0 }} 页</p>
      <div class="export-actions">
        <button class="button button-small" type="button" :disabled="!store.canExportBead" @click="saveSvg">导出 SVG</button>
        <button class="button button-small" type="button" :disabled="!store.canExportBead" @click="savePdf">导出 PDF</button>
        <button class="button button-small" type="button" :disabled="!store.result" @click="saveCsv">颜色 CSV</button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.settings-section { display: grid; gap: 12px; padding: 14px; border-bottom: 1px solid var(--border); }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.field { display: grid; gap: 6px; color: #3f454c; font-size: 13px; font-weight: 600; }
.two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.input { width: 100%; height: 33px; padding: 5px 8px; border: 1px solid var(--border-strong); border-radius: 7px; background: #fff; }
.checkbox-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
.warning { padding: 8px; border: 1px solid #e3c7c7; background: #fff8f8; border-radius: 7px; color: #8d3737; }
.bead-export-section strong { font-size: 26px; color: var(--accent); }
.export-actions { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
