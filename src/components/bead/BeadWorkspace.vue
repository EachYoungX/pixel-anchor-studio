<script setup lang="ts">
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
</script>

<template>
  <section class="bead-workspace">
    <div class="bead-header">
      <div>
        <h2>拼豆图导出</h2>
        <p>使用当前像素结果生成带色号、边缘编号和分页信息的拼豆图。</p>
      </div>
      <span v-if="store.result" class="dimension-badge">{{ store.result.width }} × {{ store.result.height }}</span>
    </div>
    <div v-if="!store.result" class="empty-state">请先在“像素化与编辑”工作区生成结果。</div>
    <div v-else class="bead-content">
      <section class="bead-card">
        <h3>分页与编号</h3>
        <div class="two-column">
          <label class="field">每页列数<input v-model.number="store.bead.pageColumns" class="input" type="number" min="5" max="80" /></label>
          <label class="field">每页行数<input v-model.number="store.bead.pageRows" class="input" type="number" min="5" max="80" /></label>
        </div>
        <label class="checkbox-row"><span>行列编号从 1 开始</span><input v-model="store.bead.indexFromOne" type="checkbox" /></label>
        <label class="field">拼豆最大颜色数<input v-model.number="store.bead.maxColors" class="input" type="number" min="2" max="256" /></label>
        <p v-if="store.palette.length > store.bead.maxColors" class="warning">当前 {{ store.palette.length }} 色，超过拼豆上限 {{ store.bead.maxColors }}。</p>
      </section>
      <section class="bead-card bead-summary">
        <h3>材料统计</h3>
        <strong>{{ store.beadCount }} 个有色格</strong>
        <span>{{ store.palette.length }} 种颜色 · {{ Math.ceil(store.result.width / store.bead.pageColumns) * Math.ceil(store.result.height / store.bead.pageRows) }} 页</span>
        <p>颜色明细和合并操作位于右侧“颜色与用量”面板。</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.bead-workspace { min-height: 560px; background: #fff; }
.bead-header { min-height: 80px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; border-bottom: 1px solid var(--border); }
.bead-content { display: grid; grid-template-columns: minmax(260px, 420px) minmax(220px, 1fr); gap: 12px; padding: 16px; }
.bead-card { display: grid; gap: 14px; align-content: start; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-muted); }
.bead-summary strong { font-size: 28px; color: var(--accent); }
.bead-summary span { color: var(--muted); font-size: 12px; }
.field { display: grid; gap: 6px; color: #3f454c; font-size: 12px; font-weight: 600; }
.two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.input { width: 100%; height: 33px; padding: 5px 8px; border: 1px solid var(--border-strong); border-radius: 7px; background: #fff; }
.checkbox-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
.warning { padding: 8px; border: 1px solid #e3c7c7; background: #fff8f8; border-radius: 7px; color: #8d3737; }
.empty-state { min-height: 420px; display: grid; place-items: center; color: var(--muted); }
@media (max-width: 700px) { .bead-content { grid-template-columns: 1fr; } }
</style>
