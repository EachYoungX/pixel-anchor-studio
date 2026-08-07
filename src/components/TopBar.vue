<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useProjectStore } from '@/stores/project'
import BrandLogo from '@/components/BrandLogo.vue'
import AboutDialog from '@/components/AboutDialog.vue'
import { markQuickStartSeen, shouldShowQuickStart } from '@/core/onboarding'
import { useProjectFileActions } from '@/composables/useProjectFileActions'

const store = useProjectStore()
const fileActions = useProjectFileActions()
const brandButton = ref<HTMLButtonElement | null>(null)
const projectMenu = ref<HTMLElement | null>(null)
const projectMenuButton = ref<HTMLButtonElement | null>(null)
const firstProjectMenuItem = ref<HTMLButtonElement | null>(null)
const projectMenuOpen = ref(false)
const aboutOpen = ref(false)
let returnAboutFocusToBrand = false

function closeProjectMenu(): void {
  projectMenuOpen.value = false
}

function toggleProjectMenu(): void {
  if (projectMenuOpen.value) {
    closeProjectMenu()
    return
  }
  projectMenuOpen.value = true
  nextTick(() => firstProjectMenuItem.value?.focus())
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!projectMenuOpen.value) return
  const target = event.target
  if (target instanceof Node && !projectMenu.value?.contains(target)) closeProjectMenu()
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (!projectMenuOpen.value || event.key !== 'Escape') return
  closeProjectMenu()
  projectMenuButton.value?.focus()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  if (shouldShowQuickStart(window.localStorage)) aboutOpen.value = true
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})

function closeAbout(): void {
  aboutOpen.value = false
  markQuickStartSeen(window.localStorage)
  const shouldReturnFocus = returnAboutFocusToBrand
  returnAboutFocusToBrand = false
  if (shouldReturnFocus) nextTick(() => brandButton.value?.focus())
}

function openAbout(): void {
  returnAboutFocusToBrand = true
  aboutOpen.value = true
}

async function saveProject(): Promise<void> {
  projectMenuOpen.value = false
  await fileActions.saveProject()
}

function openProjectPicker(): void {
  projectMenuOpen.value = false
  void fileActions.openProject()
}

function clearCurrent(): void {
  projectMenuOpen.value = false
  void fileActions.clearCurrent()
}

</script>

<template>
  <header class="top-bar">
    <div class="brand">
      <BrandLogo />
      <button ref="brandButton" class="brand-button" type="button" title="打开快速开始与关于工具" @click="openAbout">
        <strong>锚点像素工作台</strong>
        <span>图片像素化与拼豆图工具</span>
      </button>
    </div>
    <nav class="top-actions" aria-label="文件和历史操作">
      <button class="button" type="button" @click="fileActions.importImage">导入图片</button>
      <div ref="projectMenu" class="project-menu">
        <button ref="projectMenuButton" class="button" type="button" aria-haspopup="menu" :aria-expanded="projectMenuOpen" @click="toggleProjectMenu">项目</button>
        <div v-if="projectMenuOpen" class="project-menu__panel" role="menu">
          <button ref="firstProjectMenuItem" class="project-menu__item" role="menuitem" type="button" @click="openProjectPicker">打开项目</button>
          <button class="project-menu__item" role="menuitem" type="button" :disabled="!store.source" @click="saveProject">保存项目</button>
          <button class="project-menu__item" role="menuitem" type="button" :disabled="!store.source" @click="projectMenuOpen = false; fileActions.saveProjectAs()">项目另存为</button>
          <div class="project-menu__separator" role="separator" />
          <button class="project-menu__item project-menu__item--danger" role="menuitem" type="button" :disabled="!store.source" @click="clearCurrent">清空当前</button>
        </div>
      </div>
      <button class="button" type="button" :disabled="!store.canUndo" :title="`撤销：${store.undoLabel}`" @click="store.undo">撤销</button>
      <button class="button" type="button" :disabled="!store.canRedo" :title="`重做：${store.redoLabel}`" @click="store.redo">重做</button>
    </nav>
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
.project-menu__separator { height: 1px; margin: 5px 4px; background: var(--border); }
.project-menu__item--danger { color: var(--danger); }
</style>
