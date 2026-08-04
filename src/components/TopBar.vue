<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { sanitizeFilename } from '@/core/export/download'
import { exportPng } from '@/core/export/png'
import { exportProjectFile, parseProjectFile } from '@/core/export/project'
import { useProjectStore } from '@/stores/project'
import BrandLogo from '@/components/BrandLogo.vue'
import AboutDialog from '@/components/AboutDialog.vue'

const store = useProjectStore()
const imageInput = ref<HTMLInputElement | null>(null)
const projectInput = ref<HTMLInputElement | null>(null)
const brandButton = ref<HTMLButtonElement | null>(null)
const aboutOpen = ref(false)

function closeAbout(): void {
  aboutOpen.value = false
  nextTick(() => brandButton.value?.focus())
}

function baseName(): string {
  return sanitizeFilename(store.source?.name ?? 'pixel-art')
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

function saveProject(): void {
  exportProjectFile(store.serialize(), `${baseName()}.pixel-anchor.json`)
}

async function savePng(scale: number): Promise<void> {
  if (!store.result) return
  await exportPng(store.result, `${baseName()}-${store.result.width}x${store.result.height}-${scale}x.png`, scale)
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
    <nav class="top-actions" aria-label="文件和导出操作">
      <button class="button" type="button" @click="imageInput?.click()">导入图片</button>
      <button class="button" type="button" @click="projectInput?.click()">打开项目</button>
      <button class="button" type="button" :disabled="!store.source" @click="saveProject">保存项目</button>
      <button class="button" type="button" :disabled="!store.canUndo" :title="`撤销：${store.undoLabel}`" @click="store.undo">撤销</button>
      <button class="button" type="button" :disabled="!store.canRedo" :title="`重做：${store.redoLabel}`" @click="store.redo">重做</button>
      <span class="separator" aria-hidden="true" />
      <button class="button" type="button" :disabled="!store.result" @click="savePng(1)">PNG原尺寸</button>
      <button class="button" type="button" :disabled="!store.result" @click="savePng(8)">PNG八倍</button>
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
.separator { width: 1px; margin: 4px 3px; background: var(--border); }
.hidden-input { display: none; }
@media (max-width: 960px) {
  .top-bar { align-items: flex-start; flex-direction: column; }
  .top-actions { justify-content: flex-start; }
}
</style>
