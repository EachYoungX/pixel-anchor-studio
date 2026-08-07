import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useProjectFileActions } from '@/composables/useProjectFileActions'
import { getPlatformService } from '@/platform'
import { isDesktopPlatform } from '@/platform/platform-detection'
import { useProjectStore } from '@/stores/project'

export function useDesktopWindowLifecycle() {
  const store = useProjectStore()
  const fileActions = useProjectFileActions()
  const closePromptOpen = ref(false)
  const savingBeforeClose = ref(false)
  let unlistenClose: (() => void) | undefined

  const documentName = computed(() => {
    const path = store.currentProjectPath
    if (path) return path.split(/[\\/]/).at(-1)?.replace(/\.pixel-anchor\.json$/i, '') || '未命名项目'
    return store.source?.name.replace(/\.[^.]+$/, '') || '未命名项目'
  })

  async function updateTitle(): Promise<void> {
    const marker = store.dirty ? ' *' : ''
    const title = store.source ? `${documentName.value}${marker} — 锚点像素工作台` : '锚点像素工作台'
    await (await getPlatformService()).setWindowTitle(title)
  }

  async function destroyWindow(): Promise<void> {
    if (!isDesktopPlatform()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().destroy()
  }

  async function saveAndExit(): Promise<void> {
    savingBeforeClose.value = true
    try {
      if (await fileActions.saveProject()) await destroyWindow()
    } finally {
      savingBeforeClose.value = false
    }
  }

  async function discardAndExit(): Promise<void> {
    store.abandonChanges()
    closePromptOpen.value = false
    await destroyWindow()
  }

  onMounted(async () => {
    if (!isDesktopPlatform()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    unlistenClose = await getCurrentWindow().onCloseRequested((event) => {
      if (!store.dirty) return
      event.preventDefault()
      closePromptOpen.value = true
    })
  })

  onBeforeUnmount(() => unlistenClose?.())
  watch([() => store.dirty, () => store.currentProjectPath, () => store.source?.name], () => void updateTitle(), { immediate: true })

  return {
    closePromptOpen,
    savingBeforeClose,
    saveAndExit,
    discardAndExit,
    cancelClose: () => { closePromptOpen.value = false },
  }
}
