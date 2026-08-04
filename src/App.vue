<script setup lang="ts">
import TopBar from '@/components/TopBar.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import SourceCanvas from '@/components/SourceCanvas.vue'
import PixelPreview from '@/components/PixelPreview.vue'
import PalettePanel from '@/components/PalettePanel.vue'
import { ref } from 'vue'
import { useProjectStore } from '@/stores/project'
import BeadWorkspace from '@/components/bead/BeadWorkspace.vue'
import BeadSettingsPanel from '@/components/bead/BeadSettingsPanel.vue'
import type { WorkspaceMode } from '@/types/project'
import { useGlobalShortcuts } from '@/composables/useGlobalShortcuts'

const store = useProjectStore()
const workspaceMode = ref<WorkspaceMode>('pixel')
useGlobalShortcuts()
</script>

<template>
  <div class="app-shell">
    <TopBar />
    <nav class="workspace-tabs" aria-label="工作区">
      <button class="button button-small" :class="{ 'button-active': workspaceMode === 'pixel' }" type="button" @click="workspaceMode = 'pixel'">像素化与编辑</button>
      <button class="button button-small" :class="{ 'button-active': workspaceMode === 'bead' }" type="button" :disabled="!store.result" @click="workspaceMode = 'bead'">拼豆图导出</button>
    </nav>
    <div class="workspace" :class="{ 'workspace--bead': workspaceMode === 'bead' }">
      <template v-if="workspaceMode === 'pixel'">
        <SettingsPanel class="panel panel-left" />
        <main class="main-stage">
        <section class="stage-page">
          <div class="stage-heading">
            <div>
              <h2>原图与网格</h2>
              <p>{{ store.sourceLabel }}</p>
            </div>
            <span class="dimension-badge">
              输出 {{ store.outputDimensions.width }} × {{ store.outputDimensions.height }}
            </span>
          </div>
          <div class="stage-page-body"><SourceCanvas /></div>
        </section>
        <section class="stage-page">
          <div class="stage-heading">
            <div>
              <h2>像素结果</h2>
              <p>点击像素进行基础修正，处理结果始终保留为逻辑像素矩阵。</p>
            </div>
          </div>
          <div class="stage-page-body"><PixelPreview /></div>
        </section>
        </main>
        <PalettePanel class="panel panel-right" mode="edit" />
      </template>
      <template v-else>
        <BeadSettingsPanel class="panel panel-left" />
        <BeadWorkspace class="main-stage" />
        <PalettePanel class="panel panel-right" mode="bead" />
      </template>
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
