import { sanitizeFilename } from '@/core/export/download'
import { encodeProjectFile } from '@/core/export/project'
import { useIncomingFileRouter } from '@/domain/file-input/incoming-file-router'
import { getPlatformService } from '@/platform'
import { useProjectStore } from '@/stores/project'

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useProjectFileActions() {
  const store = useProjectStore()
  const incoming = useIncomingFileRouter()

  async function importImage(): Promise<boolean> {
    try {
      const file = await (await getPlatformService()).importImage()
      if (!file) return false
      return incoming.handleIncomingFiles([{
        name: file.name,
        path: file.path,
        file: new File([new Uint8Array(file.data)], file.name, { type: file.mime }),
      }], 'image-picker')
    } catch (error) {
      store.status = `图片导入失败：${errorText(error, '无法读取图片')}`
      return false
    }
  }

  async function openProject(): Promise<boolean> {
    try {
      const file = await (await getPlatformService()).openProject()
      if (!file) return false
      return incoming.handleIncomingFiles([{
        name: file.name,
        path: file.path,
        file: new File([new Uint8Array(file.data)], file.name, { type: file.mime }),
      }], 'project-picker')
    } catch (error) {
      store.status = `项目文件打开失败：${errorText(error, '无法读取项目')}`
      return false
    }
  }

  async function saveProject(forceDialog = false): Promise<boolean> {
    if (!store.source) return false
    try {
      const filename = `${sanitizeFilename(store.source.name)}.pixel-anchor.json`
      const result = await (await getPlatformService()).saveProject(encodeProjectFile(await store.serialize()), filename, {
        currentPath: store.currentProjectPath,
        forceDialog,
      })
      if (result.status === 'cancelled') {
        store.status = '已取消保存项目'
        return false
      }
      store.markSaved(result.path)
      store.status = result.path ? `项目已保存：${result.path}` : '项目已保存'
      return true
    } catch (error) {
      store.status = `项目保存失败：${errorText(error, '无法写入项目文件')}`
      return false
    }
  }

  return {
    importImage,
    openProject,
    saveProject: () => saveProject(false),
    saveProjectAs: () => saveProject(true),
    clearCurrent: incoming.clearCurrent,
  }
}
