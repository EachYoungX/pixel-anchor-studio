<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { sanitizeFilename } from '@/core/export/download'
import { exportProjectFile, parseProjectFile } from '@/core/export/project'
import { useProjectStore } from '@/stores/project'
import BrandLogo from '@/components/BrandLogo.vue'
import AboutDialog from '@/components/AboutDialog.vue'

const store = useProjectStore()
const imageInput = ref<HTMLInputElement | null>(null)
const projectInput = ref<HTMLInputElement | null>(null)
const brandButton = ref<HTMLButtonElement | null>(null)
const projectMenuOpen = ref(false)
const aboutOpen = ref(false)

function closeAbout(): void {
  aboutOpen.value = false
  nextTick(() => brandButton.value?.focus())
}

async function handleImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    await store.importImage(file)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '图片导入失败')
  }
}

async function handleProject(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    await store.loadSerialized(await parseProjectFile(file))
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '项目文件打开失败')
  }
}

async function saveProject(): Promise<void> {
  projectMenuOpen.value = false
  try {
    exportProjectFile(await store.serialize(), `${sanitizeFilename(store.source?.name ?? 'pixel-art')}.pixel-anchor.json`)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '项目保存失败')
  }
}

function openProjectPicker(): void {
  projectMenuOpen.value = false
  projectInput.value?.click()
}

</script>

<template>
  <header class="top-bar">
    <div class="brand">
      <BrandLogo />
      <button ref="brandButton" class="brand-button" type="button" title="关于工具" @click="aboutOpen = true">
        <strong>锚点像素工作台</strong>
        <span>图片像素化与拼豆图工具</span>
      </button>
    </div>
    <nav class="top-actions" aria-label="文件和历史操作">
      <button class="button" type="button" @click="imageInput?.click()">导入图片</button>
      <div class="project-menu">
        <button class="button" type="button" aria-haspopup="menu" :aria-expanded="projectMenuOpen" @click="projectMenuOpen = !projectMenuOpen">项目</button>
        <div v-if="projectMenuOpen" class="project-menu__panel" role="menu">
          <button class="project-menu__item" role="menuitem" type="button" @click="openProjectPicker">打开项目</button>
          <button class="project-menu__item" role="menuitem" type="button" :disabled="!store.source" @click="saveProject">保存项目</button>
        </div>
      </div>
      <button class="button" type="button" :disabled="!store.canUndo" :title="`撤销：${store.undoLabel}`" @click="store.undo">撤销</button>
      <button class="button" type="button" :disabled="!store.canRedo" :title="`重做：${store.redoLabel}`" @click="store.redo">重做</button>
    </nav>
    <input ref="imageInput" class="hidden-input" type="file" accept="image/*" @change="handleImage" />
    <input ref="projectInput" class="hidden-input" type="file" accept=".json,application/json" @change="handleProject" />
    <AboutDialog :open="aboutOpen" @close="closeAbout" />
  </header>
</template>

<style scoped>
.top-bar {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: #ffffff;
}
.brand { display: flex; align-items: center; gap: 10px; white-space: nowrap; }
.brand-button { display: grid; gap: 2px; padding: 0; border: 0; background: transparent; text-align: left; }
.brand-button strong { color: var(--text); font-size: 21px; font-weight: 680; }
.brand-button span { color: var(--muted); font-size: 12px; }
.top-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.project-menu { position: relative; }
.project-menu > .button[aria-expanded="true"] { border-color: #8e9ba7; background: var(--accent-soft); color: var(--accent); }
.project-menu__panel { position: absolute; z-index: 12; top: calc(100% + 6px); right: 0; min-width: 132px; padding: 5px; border: 1px solid var(--border); border-radius: 8px; background: #fff; box-shadow: 0 10px 28px rgba(20, 24, 28, 0.14); }
.project-menu__item { width: 100%; padding: 8px 10px; border: 0; border-radius: 5px; background: transparent; color: var(--text); text-align: left; }
.project-menu__item:hover:not(:disabled), .project-menu__item:focus-visible { background: var(--surface-muted); }
.hidden-input { display: none; }
</style>
