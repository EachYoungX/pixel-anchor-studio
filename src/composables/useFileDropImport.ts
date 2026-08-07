import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { useIncomingFileRouter } from '@/domain/file-input/incoming-file-router'
import type { IncomingFileNotice } from '@/domain/file-input/incoming-file'
import { isDesktopPlatform } from '@/platform/platform-detection'

interface FileDropImportState {
  dropActive: Ref<boolean>
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
  const router = useIncomingFileRouter()
  let dragDepth = 0
  const desktopUnlisteners: Array<() => void> = []

  function resetDragState(): void {
    dragDepth = 0
    dropActive.value = false
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
    const { listen } = await import('@tauri-apps/api/event')
    desktopUnlisteners.push(await listen<{ active: boolean }>('pas://drag-state', (event) => {
      dropActive.value = event.payload.active
      if (!event.payload.active) dragDepth = 0
    }))
    desktopUnlisteners.push(await listen<{ files: DesktopDroppedEntry[] }>('pas://files-dropped', (event) => {
      resetDragState()
      void router.handleIncomingFiles(event.payload.files.map((file) => ({
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
      })), 'desktop-drop')
    }))
  }

  onMounted(() => {
    if (isDesktopPlatform()) {
      void registerDesktopDrop()
    } else {
      window.addEventListener('dragenter', handleDragEnter)
      window.addEventListener('dragover', handleDragOver)
      window.addEventListener('dragleave', handleDragLeave)
      window.addEventListener('drop', handleDrop)
      window.addEventListener('dragend', resetDragState)
    }
    window.addEventListener('blur', resetDragState)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('dragenter', handleDragEnter)
    window.removeEventListener('dragover', handleDragOver)
    window.removeEventListener('dragleave', handleDragLeave)
    window.removeEventListener('drop', handleDrop)
    window.removeEventListener('dragend', resetDragState)
    window.removeEventListener('blur', resetDragState)
    desktopUnlisteners.splice(0).forEach((unlisten) => unlisten())
    router.dismissNotice()
  })

  return { dropActive, notice: router.notice, dismissNotice: router.dismissNotice }
}
