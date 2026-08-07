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
import { useFileDropImport } from '@/composables/useFileDropImport'
import DropImportOverlay from '@/components/DropImportOverlay.vue'
import UnsavedChangesDialog from '@/components/UnsavedChangesDialog.vue'
import { useDesktopWindowLifecycle } from '@/composables/useDesktopWindowLifecycle'
import { useProjectFileActions } from '@/composables/useProjectFileActions'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'

const store = useProjectStore()
const workspaceMode = ref<WorkspaceMode>('pixel')
const fileActions = useProjectFileActions()
const unsavedGuard = useUnsavedChangesGuard(fileActions.saveProject)
useGlobalShortcuts()
const { dropActive, notice: importNotice, dismissNotice } = useFileDropImport()
useDesktopWindowLifecycle()
</script>

<template>
  <div class="app-shell">
    <TopBar />
    <nav class="workspace-tabs" aria-label="工作区">
      <button class="workspace-tab" :class="{ active: workspaceMode === 'pixel' }" type="button" @click="workspaceMode = 'pixel'">像素化与编辑</button>
      <button class="workspace-tab" :class="{ active: workspaceMode === 'bead' }" type="button" :disabled="!store.result" @click="workspaceMode = 'bead'">拼豆图导出</button>
    </nav>
    <div class="workspace" :class="{ 'workspace--bead': workspaceMode === 'bead' }">
      <template v-if="workspaceMode === 'pixel'">
        <SettingsPanel class="panel panel-left" />
        <main class="main-stage">
        <section class="stage-page stage-page--source">
          <div class="stage-heading">
            <div>
              <h2>原图与网格</h2>
              <p>{{ store.sourceLabel }}</p>
            </div>
          </div>
          <div class="stage-page-body"><SourceCanvas /></div>
        </section>
        <section class="stage-page stage-page--result">
          <div class="stage-heading">
            <div>
              <h2>像素结果</h2>
              <p>点击像素进行基础修正，处理结果始终保留为逻辑像素矩阵。</p>
            </div>
            <span class="dimension-badge">
              输出 {{ store.outputDimensions.width }} × {{ store.outputDimensions.height }}
            </span>
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
    <DropImportOverlay :active="dropActive" />
    <UnsavedChangesDialog
      :open="unsavedGuard.open.value"
      :saving="unsavedGuard.saving.value"
      :reason="unsavedGuard.reason.value"
      @save="unsavedGuard.saveAndContinue"
      @discard="unsavedGuard.discardAndContinue"
      @cancel="unsavedGuard.cancel"
    />
    <Transition name="import-notice">
      <aside
        v-if="importNotice"
        :key="importNotice.id"
        class="import-notice"
        :class="`import-notice--${importNotice.tone}`"
        :role="importNotice.tone === 'error' ? 'alert' : 'status'"
        aria-live="polite"
      >
        <div>
          <strong>{{ importNotice.title }}</strong>
          <p>{{ importNotice.detail }}</p>
        </div>
        <button type="button" aria-label="关闭导入提示" @click="dismissNotice">×</button>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.workspace-tabs { min-height: 48px; display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: #f5f6f7; }
.workspace-tab { min-height: 38px; padding: 7px 16px; border: 1px solid var(--border-strong); border-radius: 8px; background: #fff; color: #30363c; font-size: 14px; font-weight: 600; }
.workspace-tab.active { background: var(--accent-soft); border-color: #8e9ba7; color: var(--accent); }
.import-notice {
  position: fixed;
  z-index: 1001;
  right: 18px;
  bottom: 48px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  width: min(440px, calc(100vw - 36px));
  padding: 14px 14px 14px 16px;
  border: 1px solid #b7c5d1;
  border-left: 4px solid var(--accent);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(20, 24, 28, 0.18);
}
.import-notice--error { border-color: #dfb7b7; border-left-color: var(--danger); background: #fffafa; }
.import-notice > div { min-width: 0; display: grid; gap: 4px; }
.import-notice strong { overflow-wrap: anywhere; font-size: 14px; }
.import-notice p { overflow-wrap: anywhere; font-size: 12px; }
.import-notice button { flex: none; width: 28px; height: 28px; padding: 0; border: 0; background: transparent; color: var(--muted); font-size: 21px; line-height: 1; }
.import-notice-enter-active, .import-notice-leave-active { transition: opacity 140ms ease, transform 140ms ease; }
.import-notice-enter-from, .import-notice-leave-to { opacity: 0; transform: translateY(8px); }

@media (prefers-reduced-motion: reduce) {
  .import-notice-enter-active, .import-notice-leave-active { transition: none; }
}
</style>
