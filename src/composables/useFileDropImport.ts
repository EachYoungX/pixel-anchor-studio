import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { decideDropImport, SUPPORTED_DROP_TYPES_TEXT, type DroppedDirectory } from '@/core/import/drop-files'

interface FileDropImportOptions {
  importImage: (file: File) => Promise<void>
  importProject: (file: File) => Promise<void>
}

export interface ImportNotice {
  id: number
  tone: 'success' | 'error'
  title: string
  detail: string
}

interface FileDropImportState {
  dropActive: Ref<boolean>
  notice: Ref<ImportNotice | null>
  dismissNotice: () => void
}

interface FileSystemEntryLike {
  isDirectory: boolean
  name: string
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null
}

function containsFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes('Files'))
}

function getDirectories(dataTransfer: DataTransfer): DroppedDirectory[] {
  return Array.from(dataTransfer.items).flatMap((item) => {
    const entry = (item as DataTransferItemWithEntry).webkitGetAsEntry?.()
    return entry?.isDirectory ? [{ name: entry.name || '未命名文件夹' }] : []
  })
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useFileDropImport(options: FileDropImportOptions): FileDropImportState {
  const dropActive = ref(false)
  const notice = ref<ImportNotice | null>(null)
  let dragDepth = 0
  let noticeId = 0
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  function dismissNotice(): void {
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = undefined
    notice.value = null
  }

  function showNotice(tone: ImportNotice['tone'], title: string, detail: string): void {
    dismissNotice()
    notice.value = { id: ++noticeId, tone, title, detail }
    noticeTimer = setTimeout(dismissNotice, tone === 'error' ? 9000 : 6500)
  }

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
    const dataTransfer = event.dataTransfer
    resetDragState()
    if (!dataTransfer) return

    const decision = decideDropImport(Array.from(dataTransfer.files), getDirectories(dataTransfer))
    if (decision.kind === 'reject') {
      showNotice('error', `无法导入“${decision.fileName}”`, `${decision.reason}。支持类型：${SUPPORTED_DROP_TYPES_TEXT}。当前项目未受影响。`)
      return
    }

    try {
      if (decision.kind === 'project') {
        await options.importProject(decision.file)
        showNotice('success', `已打开“${decision.file.name}”`, '项目文件已在本地读取。')
        return
      }

      await options.importImage(decision.file)
      if (decision.ignoredCount > 0) {
        showNotice('success', `已导入“${decision.file.name}”`, `已忽略另外 ${decision.ignoredCount} 个文件；多张图片只导入第一张受支持图片。`)
      }
    } catch (error) {
      const fallback = decision.kind === 'project' ? '项目文件打开失败' : '图片导入失败'
      showNotice('error', `无法导入“${decision.file.name}”`, `${errorMessage(error, fallback)}。支持类型：${SUPPORTED_DROP_TYPES_TEXT}。当前项目未受影响。`)
    }
  }

  onMounted(() => {
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('blur', resetDragState)
    window.addEventListener('dragend', resetDragState)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('dragenter', handleDragEnter)
    window.removeEventListener('dragover', handleDragOver)
    window.removeEventListener('dragleave', handleDragLeave)
    window.removeEventListener('drop', handleDrop)
    window.removeEventListener('blur', resetDragState)
    window.removeEventListener('dragend', resetDragState)
    dismissNotice()
  })

  return { dropActive, notice, dismissNotice }
}
