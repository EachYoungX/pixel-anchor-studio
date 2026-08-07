import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import { getPlatformService } from '@/platform'
import { isDesktopPlatform } from '@/platform/platform-detection'
import { useProjectStore } from '@/stores/project'

export function useDesktopWindowLifecycle() {
  const store = useProjectStore()
  const guard = useUnsavedChangesGuard()
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

  async function destroyWindow(): Promise<boolean> {
    if (!isDesktopPlatform()) return false
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().destroy()
    return true
  }

  onMounted(async () => {
    if (!isDesktopPlatform()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    unlistenClose = await getCurrentWindow().onCloseRequested((event) => {
      if (!store.dirty) return
      event.preventDefault()
      void guard.request('close', destroyWindow)
    })
  })

  onBeforeUnmount(() => unlistenClose?.())
  watch([() => store.dirty, () => store.currentProjectPath, () => store.source?.name], () => void updateTitle(), { immediate: true })

  return { destroyWindow }
}
