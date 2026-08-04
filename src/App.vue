<script setup lang="ts">
import TopBar from '@/components/TopBar.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import SourceCanvas from '@/components/SourceCanvas.vue'
import PixelPreview from '@/components/PixelPreview.vue'
import PalettePanel from '@/components/PalettePanel.vue'
import { ref } from 'vue'
import { useProjectStore } from '@/stores/project'
import BeadWorkspace from '@/components/bead/BeadWorkspace.vue'
import type { WorkspaceMode } from '@/types/project'

const store = useProjectStore()
const workspaceMode = ref<WorkspaceMode>('pixel')
</script>

<template>
  <div class="app-shell">
    <TopBar />
    <nav class="workspace-tabs" aria-label="工作区">
      <button class="button button-small" :class="{ 'button-active': workspaceMode === 'pixel' }" type="button" @click="workspaceMode = 'pixel'">像素化与编辑</button>
      <button class="button button-small" :class="{ 'button-active': workspaceMode === 'bead' }" type="button" :disabled="!store.result" @click="workspaceMode = 'bead'">拼豆图导出</button>
    </nav>
    <div class="workspace" :class="{ 'workspace--bead': workspaceMode === 'bead' }">
      <SettingsPanel v-if="workspaceMode === 'pixel'" class="panel panel-left" />
      <main class="main-stage">
        <BeadWorkspace v-if="workspaceMode === 'bead'" class="stage-card" />
        <template v-else>
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
        </template>
      </main>
      <PalettePanel class="panel panel-right" />
    </div>
    <footer class="status-bar">
      <span>{{ store.status }}</span>
      <span v-if="store.lastDurationMs > 0">处理耗时 {{ store.lastDurationMs.toFixed(0) }} ms</span>
    </footer>
  </div>
</template>

<style scoped>
.workspace-tabs { display: flex; gap: 6px; padding: 8px 14px 0; background: #f5f6f7; }
</style>
