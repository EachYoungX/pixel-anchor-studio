import { downloadBlob } from '@/core/export/download'
import type { BeadSettings, ScaleSettings, SerializedProject } from '@/types/project'

export function bytesToBase64(bytes: Uint8ClampedArray): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8ClampedArray {
  const binary = atob(value)
  const bytes = new Uint8ClampedArray(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function exportProjectFile(project: SerializedProject, filename: string): void {
  const content = JSON.stringify(project)
  downloadBlob(new Blob([content], { type: 'application/json;charset=utf-8' }), filename)
}

interface LegacyScaleSettings extends Partial<ScaleSettings> {
  directValue?: number
  directAxis?: string
  snapToGrid?: boolean
}

export function migrateProject(value: unknown): SerializedProject {
  if (!value || typeof value !== 'object') throw new Error('项目文件内容无效')
  const raw = value as Record<string, unknown>
  if (raw.format !== 'pixel-anchor-project' || ![1, 2, 3].includes(raw.version as number)) {
    throw new Error('不支持的项目文件格式')
  }

  const legacyScale = (raw.scale ?? {}) as LegacyScaleSettings
  const mode = legacyScale.mode ?? 'direct'
  const currentSnap = legacyScale.snapMode ?? (mode === 'pseudo' ? 'target-cell' : 'source-pixel')
  const currentScale: ScaleSettings = {
    mode,
    directLongSide: legacyScale.directLongSide ?? legacyScale.directValue ?? 32,
    anchorCells: legacyScale.anchorCells ?? 3,
    pseudoCellSize: legacyScale.pseudoCellSize ?? 8,
    offsetX: legacyScale.offsetX ?? 0,
    offsetY: legacyScale.offsetY ?? 0,
    snapMode: currentSnap,
    snapSettings: legacyScale.snapSettings ?? {
      direct: currentSnap,
      anchor: currentSnap,
      pseudo: currentSnap,
    },
  }
  const legacyBead = (raw.bead ?? {}) as Partial<BeadSettings>
  const bead: BeadSettings = {
    maxColors: legacyBead.maxColors ?? 64,
    cellSize: legacyBead.cellSize ?? 24,
    pageColumns: legacyBead.pageColumns ?? 32,
    pageRows: legacyBead.pageRows ?? 32,
    indexFromOne: legacyBead.indexFromOne ?? true,
  }

  return {
    ...(raw as Omit<SerializedProject, 'version' | 'scale' | 'bead'>),
    version: 3,
    scale: currentScale,
    bead,
  }
}

export async function parseProjectFile(file: File): Promise<SerializedProject> {
  return migrateProject(JSON.parse(await file.text()))
}
