import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
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
  const desktopUnlisteners: Array<() => void> = []

  const desktopDrop = createDesktopDropAuthorization<DesktopDroppedEntry>({
    setOverlay(active, waiting) {
      dropActive.value = active
      dropWaiting.value = waiting
      if (!active) dragDepth = 0
    },
    handleAuthorized(files) {
      void router.handleIncomingFiles(files.map((file) => ({
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
      })), 'desktop-drop')
    },
    handleTimeout() {
      router.reportError('桌面文件拖放处理失败', '请重试或使用“导入图片”或“打开项目”按钮。')
    },
  })

  function resetDragState(): void {
    dragDepth = 0
    dropActive.value = false
    dropWaiting.value = false
  }

  function handleWindowBlur(): void {
    if (desktopPlatform) {
      desktopDrop.reset()
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
      const unlistenAuthorized = await listen<{ files: DesktopDroppedEntry[] }>('pas://files-dropped', (event) => {
        desktopDrop.handleAuthorized(event.payload.files)
      })
      if (disposed) {
        unlistenAuthorized()
        return
      }
      desktopUnlisteners.push(unlistenAuthorized)

      const unlistenNative = await getCurrentWebview().onDragDropEvent((event) => {
        desktopDrop.handleNativeDrag(event.payload.type)
      })
      if (disposed) {
        unlistenNative()
        return
      }
      desktopUnlisteners.push(unlistenNative)
    } catch (error) {
      desktopDrop.reset()
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
    desktopDrop.reset()
    desktopUnlisteners.splice(0).forEach((unlisten) => unlisten())
    router.dismissNotice()
  })

  return { dropActive, dropWaiting, notice: router.notice, dismissNotice: router.dismissNotice }
}
