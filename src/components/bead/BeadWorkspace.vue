<script setup lang="ts">
import { useProjectStore } from '@/stores/project'
import BeadPreview from '@/components/bead/BeadPreview.vue'
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
  <section class="bead-workspace">
    <div v-if="!store.result" class="empty-state">请先在“像素化与编辑”工作区生成结果。</div>
    <div v-else class="bead-content">
      <aside class="bead-panel bead-legend-panel">
        <div class="bead-panel-heading">
          <h2>颜色图例</h2>
          <span>{{ store.palette.length }} 色</span>
        </div>
        <div class="bead-legend-list">
          <div v-for="entry in store.palette" :key="entry.hex" class="legend-entry">
            <span class="legend-swatch" :style="{ background: entry.hex }" />
            <span class="legend-code">{{ entry.code }}</span>
            <span class="legend-hex">{{ entry.hex }}</span>
            <span class="legend-count">×{{ entry.count }}</span>
          </div>
        </div>
      </aside>

      <main class="bead-panel bead-result-panel">
        <div class="bead-panel-heading">
          <div>
            <h2>拼豆图预览</h2>
            <p>当前结果直接映射为拼豆网格，可按需显示编号和分页边界。</p>
          </div>
          <span class="dimension-badge">{{ store.result.width }} × {{ store.result.height }}</span>
        </div>
        <BeadPreview />
      </main>

      <aside class="bead-panel bead-settings-panel">
        <div class="bead-panel-heading"><h2>导出设置</h2></div>
        <h3>分页与编号</h3>
        <div class="two-column">
          <label class="field">每页列数<input v-model.number="store.bead.pageColumns" class="input" type="number" min="5" max="80" /></label>
          <label class="field">每页行数<input v-model.number="store.bead.pageRows" class="input" type="number" min="5" max="80" /></label>
        </div>
        <label class="checkbox-row"><span>行列编号从 1 开始</span><input v-model="store.bead.indexFromOne" type="checkbox" /></label>
        <label class="field">拼豆最大颜色数<input v-model.number="store.bead.maxColors" class="input" type="number" min="2" max="256" /></label>
        <p v-if="store.palette.length > store.bead.maxColors" class="warning">当前 {{ store.palette.length }} 色，超过拼豆上限 {{ store.bead.maxColors }}。</p>
        <p v-if="store.bead.pageColumns > 48 || store.bead.pageRows > 48" class="warning">每页超过 48 格时，A4 导出单格和色号会较小，建议使用 32–48 格/页。</p>
        <h3>材料统计</h3>
        <strong>{{ store.beadCount }} 个有色格</strong>
        <span>{{ store.palette.length }} 种颜色 · {{ Math.ceil(store.result.width / store.bead.pageColumns) * Math.ceil(store.result.height / store.bead.pageRows) }} 页</span>
        <div class="export-actions">
          <button class="button button-small" type="button" :disabled="!store.canExportBead" @click="saveSvg">导出 SVG</button>
          <button class="button button-small" type="button" :disabled="!store.canExportBead" @click="savePdf">导出 PDF</button>
          <button class="button button-small" type="button" @click="saveCsv">颜色 CSV</button>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.bead-workspace { height: 100%; min-height: 0; background: #fff; }
.bead-content { height: 100%; min-height: 0; display: grid; grid-template-columns: 220px minmax(0, 1fr) 270px; gap: 12px; padding: 12px; }
.bead-panel { min-width: 0; min-height: 0; display: grid; gap: 12px; align-content: start; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-muted); overflow: auto; }
.bead-result-panel { grid-template-rows: auto minmax(0, 1fr); overflow: hidden; }
.bead-settings-panel strong { font-size: 26px; color: var(--accent); }
.bead-settings-panel > span { color: var(--muted); font-size: 12px; }
.bead-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.bead-panel-heading > span { color: var(--muted); font-size: 11px; }
.bead-legend-list { display: grid; gap: 6px; align-content: start; }
.legend-entry { display: grid; grid-template-columns: 18px 38px minmax(0, 1fr) auto; align-items: center; gap: 6px; font-size: 11px; }
.legend-swatch { width: 18px; height: 18px; border: 1px solid #aeb4ba; border-radius: 4px; }
.legend-code { font-weight: 700; }
.legend-hex, .legend-count { color: var(--muted); }
.legend-hex { overflow: hidden; text-overflow: ellipsis; }
.export-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.field { display: grid; gap: 6px; color: #3f454c; font-size: 12px; font-weight: 600; }
.two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.input { width: 100%; height: 33px; padding: 5px 8px; border: 1px solid var(--border-strong); border-radius: 7px; background: #fff; }
.checkbox-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
.warning { padding: 8px; border: 1px solid #e3c7c7; background: #fff8f8; border-radius: 7px; color: #8d3737; }
.empty-state { height: 100%; min-height: 420px; display: grid; place-items: center; color: var(--muted); }
@media (max-width: 1100px) { .bead-content { grid-template-columns: 190px minmax(0, 1fr) 240px; } }
@media (max-width: 820px) { .bead-workspace { height: auto; } .bead-content { height: auto; grid-template-columns: 1fr; } .bead-result-panel { min-height: 520px; } }
</style>
