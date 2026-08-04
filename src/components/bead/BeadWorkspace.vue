<script setup lang="ts">
import BeadPreview from '@/components/bead/BeadPreview.vue'
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
</script>

<template>
  <section class="bead-workspace">
    <div v-if="!store.result" class="empty-state">请先在“像素化与编辑”工作区生成结果。</div>
    <section v-else class="bead-document-page">
      <div class="stage-heading">
        <div>
          <h2>拼豆文档预览</h2>
          <p>预览当前结果的 PDF 分页或 SVG 总览，右侧颜色与用量可直接核对。</p>
        </div>
        <span class="dimension-badge">{{ store.result.width }} × {{ store.result.height }}</span>
      </div>
      <div class="bead-document-body"><BeadPreview /></div>
    </section>
  </section>
</template>

<style scoped>
.bead-workspace { height: 100%; min-height: 0; }
.bead-document-page { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.bead-document-body { min-height: 0; overflow: hidden; }
.empty-state { height: 100%; min-height: 420px; display: grid; place-items: center; color: var(--muted); }
</style>
