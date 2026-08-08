import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { createDesktopDropAuthorization } from '@/domain/file-input/desktop-drop-authorization'
import { useIncomingFileRouter } from '@/domain/file-input/incoming-file-router'
import type { IncomingFileNotice } from '@/domain/file-input/incoming-file'
import { isDesktopPlatform } from '@/platform/platform-detection'

interface FileDropImportState {
  dropActive: Ref<boolean>
  dropWaiting: Ref<boolean>
  notice: Ref<IncomingFileNotice | null>
  dismissNotice: () => void
}

interface FileSystemEntryLike {
  isDirectory: boolean
  name: string
}

interface DesktopDroppedEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface DesktopDroppedPayload {
  files: DesktopDroppedEntry[]
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null
}

function containsFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes('Files'))
}

export function useFileDropImport(): FileDropImportState {
  const dropActive = ref(false)
  const dropWaiting = ref(false)
  const router = useIncomingFileRouter()
  const desktopPlatform = isDesktopPlatform()
  let dragDepth = 0
  let disposed = false
  let authorizationClaimInFlight = false
  let authorizationFailureDetail: string | undefined
  let authorizationClaimTimer: ReturnType<typeof setTimeout> | undefined
  const desktopUnlisteners: Array<() => void> = []

  function clearAuthorizationClaimTimer(): void {
    if (authorizationClaimTimer) clearTimeout(authorizationClaimTimer)
    authorizationClaimTimer = undefined
  }

  const desktopDrop = createDesktopDropAuthorization<DesktopDroppedEntry>({
    setOverlay(active, waiting) {
      dropActive.value = active
      dropWaiting.value = waiting
      if (!active) dragDepth = 0
    },
    handleAuthorized(files) {
      clearAuthorizationClaimTimer()
      authorizationFailureDetail = undefined
      void router.handleIncomingFiles(files.map((file) => ({
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
      })), 'desktop-drop')
    },
    handleTimeout() {
      clearAuthorizationClaimTimer()
      const detail = authorizationFailureDetail
        ? `无法取得桌面文件授权：${authorizationFailureDetail}。请重试或使用“导入图片”或“打开项目”按钮。`
        : '请重试或使用“导入图片”或“打开项目”按钮。'
      authorizationFailureDetail = undefined
      router.reportError('桌面文件拖放处理失败', detail)
    },
  })

  async function claimAuthorizedDrop(): Promise<void> {
    if (disposed || authorizationClaimInFlight) return
    authorizationClaimInFlight = true
    try {
      const payload = await invoke<DesktopDroppedPayload | null>('claim_authorized_drop')
      if (payload) desktopDrop.handleAuthorized(payload.files)
    } catch (error) {
      authorizationFailureDetail = error instanceof Error && error.message
        ? error.message
        : String(error || '授权领取失败')
    } finally {
      authorizationClaimInFlight = false
    }
  }

  function resetDesktopDrop(): void {
    clearAuthorizationClaimTimer()
    authorizationFailureDetail = undefined
    desktopDrop.reset()
  }

  function resetDragState(): void {
    dragDepth = 0
    dropActive.value = false
    dropWaiting.value = false
  }

  function handleWindowBlur(): void {
    if (desktopPlatform) {
      resetDesktopDrop()
      return
    }
    resetDragState()
  }

  function handleDragEnter(event: DragEvent): void {
    if (!containsFiles(event.dataTransfer)) return
    event.preventDefault()
    dragDepth += 1
    dropActive.value = true
  }

  function handleDragOver(event: DragEvent): void {
    if (!containsFiles(event.dataTransfer)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    dropActive.value = true
  }

  function handleDragLeave(event: DragEvent): void {
    if (!dropActive.value) return
    event.preventDefault()
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) dropActive.value = false
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    if (!containsFiles(event.dataTransfer)) return
    event.preventDefault()
    const transfer = event.dataTransfer
    resetDragState()
    if (!transfer) return
    const entries = Array.from(transfer.items).map((item) => (item as DataTransferItemWithEntry).webkitGetAsEntry?.())
    const files = Array.from(transfer.files).map((file) => ({ file, name: file.name }))
    const directories = entries.flatMap((entry) => entry?.isDirectory
      ? [{ name: entry.name || '未命名文件夹', isDirectory: true }]
      : [])
    await router.handleIncomingFiles([...files, ...directories], 'web-drop')
  }

  async function registerDesktopDrop(): Promise<void> {
    try {
      const [{ listen }, { getCurrentWebview }] = await Promise.all([
        import('@tauri-apps/api/event'),
        import('@tauri-apps/api/webview'),
      ])
      const unlistenAuthorized = await listen('pas://files-dropped', () => {
        void claimAuthorizedDrop()
      })
      if (disposed) {
        unlistenAuthorized()
        return
      }
      desktopUnlisteners.push(unlistenAuthorized)

      const unlistenNative = await getCurrentWebview().onDragDropEvent((event) => {
        const type = event.payload.type
        desktopDrop.handleNativeDrag(type)
        if (type === 'drop') {
          authorizationFailureDetail = undefined
          clearAuthorizationClaimTimer()
          authorizationClaimTimer = setTimeout(() => {
            authorizationClaimTimer = undefined
            void claimAuthorizedDrop()
          }, 120)
        } else if (type === 'leave') {
          clearAuthorizationClaimTimer()
        }
      })
      if (disposed) {
        unlistenNative()
        return
      }
      desktopUnlisteners.push(unlistenNative)
    } catch (error) {
      resetDesktopDrop()
      desktopUnlisteners.splice(0).forEach((unlisten) => unlisten())
      const detail = error instanceof Error && error.message ? error.message : '无法注册桌面拖放监听。'
      router.reportError('桌面文件拖放初始化失败', detail)
    }
  }

  onMounted(() => {
    if (desktopPlatform) {
      void registerDesktopDrop()
    } else {
      window.addEventListener('dragenter', handleDragEnter)
      window.addEventListener('dragover', handleDragOver)
      window.addEventListener('dragleave', handleDragLeave)
      window.addEventListener('drop', handleDrop)
      window.addEventListener('dragend', resetDragState)
    }
    window.addEventListener('blur', handleWindowBlur)
  })

  onBeforeUnmount(() => {
    disposed = true
    window.removeEventListener('dragenter', handleDragEnter)
    window.removeEventListener('dragover', handleDragOver)
    window.removeEventListener('dragleave', handleDragLeave)
    window.removeEventListener('drop', handleDrop)
    window.removeEventListener('dragend', resetDragState)
    window.removeEventListener('blur', handleWindowBlur)
    resetDesktopDrop()
    desktopUnlisteners.splice(0).forEach((unlisten) => unlisten())
    router.dismissNotice()
  })

  return { dropActive, dropWaiting, notice: router.notice, dismissNotice: router.dismissNotice }
}
