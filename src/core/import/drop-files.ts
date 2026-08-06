export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
] as const

export const SUPPORTED_IMAGE_TYPES_TEXT = 'PNG、JPEG、WebP、GIF、AVIF、BMP、SVG'
export const SUPPORTED_DROP_TYPES_TEXT = `${SUPPORTED_IMAGE_TYPES_TEXT} 图片，或 Pixel Anchor JSON 项目文件`

const supportedImageMimeTypes = new Set<string>(SUPPORTED_IMAGE_MIME_TYPES)

export interface DroppedDirectory {
  name: string
}

export type DropImportDecision =
  | { kind: 'image'; file: File; ignoredCount: number }
  | { kind: 'project'; file: File }
  | { kind: 'reject'; fileName: string; reason: string }

export function isSupportedImageFile(file: File): boolean {
  return supportedImageMimeTypes.has(file.type.toLowerCase())
}

export function isProjectFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.json') || file.type.toLowerCase() === 'application/json'
}

export function decideDropImport(files: readonly File[], directories: readonly DroppedDirectory[] = []): DropImportDecision {
  if (directories.length > 0) {
    const extraCount = directories.length - 1
    return {
      kind: 'reject',
      fileName: extraCount > 0 ? `${directories[0].name} 等 ${directories.length} 个文件夹` : directories[0].name,
      reason: '暂不支持拖入文件夹，请改为选择其中的图片文件',
    }
  }

  const projectFiles = files.filter(isProjectFile)
  if (projectFiles.length > 1) {
    return {
      kind: 'reject',
      fileName: `${projectFiles[0].name} 等 ${projectFiles.length} 个项目文件`,
      reason: '一次只能打开一个项目文件，请分别拖入',
    }
  }
  if (projectFiles.length === 1 && files.length > 1) {
    return {
      kind: 'reject',
      fileName: projectFiles[0].name,
      reason: '项目文件不能与图片或其他文件混合拖入，请单独拖入项目文件',
    }
  }
  if (projectFiles.length === 1) return { kind: 'project', file: projectFiles[0] }

  const firstImage = files.find(isSupportedImageFile)
  if (firstImage) return { kind: 'image', file: firstImage, ignoredCount: Math.max(0, files.length - 1) }

  const firstFile = files[0]
  return {
    kind: 'reject',
    fileName: firstFile?.name || '拖入内容',
    reason: firstFile ? '文件类型不受支持' : '未检测到可导入文件',
  }
}
