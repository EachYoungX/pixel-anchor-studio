import { ref } from 'vue'
import { parseProjectFile } from '@/core/export/project'
import { SUPPORTED_DROP_TYPES_TEXT, isProjectFile, isSupportedImageFile } from '@/core/import/drop-files'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import { getPlatformService, type PlatformFile } from '@/platform'
import { useProjectStore } from '@/stores/project'
import type { IncomingFile, IncomingFileNotice, IncomingSource } from '@/domain/file-input/incoming-file'

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg'])
const notice = ref<IncomingFileNotice | null>(null)
let noticeId = 0
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function extension(name: string): string {
  return name.split('.').at(-1)?.toLowerCase() ?? ''
}

function isProject(incoming: IncomingFile): boolean {
  return incoming.file ? isProjectFile(incoming.file) : extension(incoming.name) === 'json'
}

function isImage(incoming: IncomingFile): boolean {
  return incoming.file ? isSupportedImageFile(incoming.file) : imageExtensions.has(extension(incoming.name))
}

export type IncomingFileDecision =
  | { kind: 'image'; file: IncomingFile; ignoredCount: number }
  | { kind: 'project'; file: IncomingFile }
  | { kind: 'reject'; fileName: string; reason: string }
  | { kind: 'empty' }

export function decideIncomingFiles(files: IncomingFile[], source: IncomingSource): IncomingFileDecision {
  const directories = files.filter((file) => file.isDirectory)
  if (directories.length > 0) {
    return { kind: 'reject', fileName: directories[0]?.name || '文件夹', reason: '暂不支持直接导入文件夹，请拖入单张图片或单个项目文件' }
  }
  const first = files[0]
  if (!first) return { kind: 'empty' }
  if (source === 'image-picker') return { kind: 'image', file: first, ignoredCount: 0 }
  if (source === 'project-picker') return { kind: 'project', file: first }

  const projects = files.filter(isProject)
  if (projects.length > 1) return { kind: 'reject', fileName: projects[0].name, reason: '一次只能打开一个项目文件' }
  if (projects.length === 1 && files.length > 1) return { kind: 'reject', fileName: projects[0].name, reason: '项目文件需要单独拖入' }
  if (projects.length === 1) return { kind: 'project', file: projects[0] }

  const images = files.filter(isImage)
  if (images.length > 0) return { kind: 'image', file: images[0], ignoredCount: Math.max(0, files.length - 1) }
  return { kind: 'reject', fileName: first.name, reason: '文件类型不受支持' }
}

function toBrowserFile(file: PlatformFile): File {
  return new File([new Uint8Array(file.data)], file.name, { type: file.mime })
}

async function materialize(incoming: IncomingFile): Promise<File> {
  if (incoming.file) return incoming.file
  if (!incoming.path) throw new Error('文件路径不可用')
  const payload = (await (await getPlatformService()).readDroppedFiles([incoming.path]))[0]
  if (!payload) throw new Error('桌面文件读取失败')
  return toBrowserFile(payload)
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function dismissNotice(): void {
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = undefined
  notice.value = null
}

function showNotice(tone: IncomingFileNotice['tone'], title: string, detail: string): void {
  dismissNotice()
  notice.value = { id: ++noticeId, tone, title, detail }
  noticeTimer = setTimeout(dismissNotice, tone === 'error' ? 9000 : 6500)
}

function reject(fileName: string, reason: string): false {
  showNotice('error', `无法导入“${fileName}”`, `${reason}。支持类型：${SUPPORTED_DROP_TYPES_TEXT}。当前项目未受影响。`)
  return false
}

export function useIncomingFileRouter() {
  const store = useProjectStore()
  const guard = useUnsavedChangesGuard()

  async function replaceWithImage(incoming: IncomingFile, ignoredCount: number): Promise<boolean> {
    return guard.request('import-image', async () => {
      try {
        const file = await materialize(incoming)
        await store.importImage(file)
        await (await getPlatformService()).adoptProjectPath()
        if (ignoredCount > 0) {
          showNotice('success', `已导入“${file.name}”`, `另外 ${ignoredCount} 个文件未处理。当前版本一次只处理一张图片。`)
        }
        return true
      } catch (error) {
        showNotice('error', `无法导入“${incoming.name}”`, `${errorText(error, '图片导入失败')}。当前项目未受影响。`)
        return false
      }
    })
  }

  async function replaceWithProject(incoming: IncomingFile): Promise<boolean> {
    return guard.request('open-project', async () => {
      try {
        const file = await materialize(incoming)
        await store.loadSerialized(await parseProjectFile(file), incoming.path)
        await (await getPlatformService()).adoptProjectPath(incoming.path)
        showNotice('success', `已打开“${file.name}”`, '项目文件已在本地读取。')
        return true
      } catch (error) {
        showNotice('error', `无法导入“${incoming.name}”`, `${errorText(error, '项目文件打开失败')}。当前项目未受影响。`)
        return false
      }
    })
  }

  async function handleIncomingFiles(files: IncomingFile[], source: IncomingSource): Promise<boolean> {
    const decision = decideIncomingFiles(files, source)
    if (decision.kind === 'empty') return reject('拖入内容', '未检测到可导入文件')
    if (decision.kind === 'reject') return reject(decision.fileName, decision.reason)
    if (decision.kind === 'project') return replaceWithProject(decision.file)
    return replaceWithImage(decision.file, decision.ignoredCount)
  }

  async function clearCurrent(): Promise<boolean> {
    return guard.request('clear', async () => {
      store.clearCurrent()
      await (await getPlatformService()).adoptProjectPath()
      return true
    })
  }

  return { notice, dismissNotice, handleIncomingFiles, clearCurrent }
}
