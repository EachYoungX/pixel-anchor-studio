<script setup lang="ts">
import TopBar from '@/components/TopBar.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import SourceCanvas from '@/components/SourceCanvas.vue'
import PixelPreview from '@/components/PixelPreview.vue'
import PalettePanel from '@/components/PalettePanel.vue'
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
</script>

<template>
  <div class="app-shell">
    <TopBar />
    <div class="workspace">
      <SettingsPanel class="panel panel-left" />
      <main class="main-stage">
        <section class="stage-card">
          <div class="stage-heading">
            <div>
              <h2>原图与网格</h2>
              <p>{{ store.sourceLabel }}</p>
            </div>
            <span class="dimension-badge">
              输出 {{ store.outputDimensions.width }} × {{ store.outputDimensions.height }}
            </span>
          </div>
          <SourceCanvas />
        </section>
        <section class="stage-card">
          <div class="stage-heading">
            <div>
              <h2>像素结果</h2>
              <p>点击像素进行基础修正，处理结果始终保留为逻辑像素矩阵。</p>
            </div>
          </div>
          <PixelPreview />
        </section>
      </main>
      <PalettePanel class="panel panel-right" />
    </div>
    <footer class="status-bar">
      <span>{{ store.status }}</span>
      <span v-if="store.lastDurationMs > 0">处理耗时 {{ store.lastDurationMs.toFixed(0) }} ms</span>
    </footer>
  </div>
</template>
