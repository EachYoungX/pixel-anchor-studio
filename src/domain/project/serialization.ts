import { bytesToBase64 } from '@/core/export/project'
import type { SourceRuntime } from '@/domain/source/source-types'
import type { BeadSettings, CropSettings, PixelResult, ProcessingSettings, Rect, ScaleSettings, SerializedProject } from '@/types/project'
import { migrateProject } from '@/domain/project/migrations'

export function parseSerializedProject(value: unknown): SerializedProject {
  return migrateProject(value)
}

export interface ProjectSerializationInput {
  source: SourceRuntime | null
  crop: Rect
  cropSettings: CropSettings
  anchor: Rect
  scale: ScaleSettings
  processing: ProcessingSettings
  bead: BeadSettings
  result: PixelResult | null
  colorCodes: Record<string, string>
}

export async function serializeProject(input: ProjectSerializationInput): Promise<SerializedProject> {
  const sourceDataBase64 = input.source
    ? bytesToBase64(new Uint8ClampedArray(await input.source.file.arrayBuffer()))
    : ''
  return {
    format: 'pixel-anchor-project',
    version: 4,
    savedAt: new Date().toISOString(),
    source: input.source ? {
      name: input.source.name,
      mime: input.source.mime || input.source.file.type || 'image/png',
      width: input.source.width,
      height: input.source.height,
      dataBase64: sourceDataBase64,
    } : null,
    crop: { ...input.crop },
    cropSettings: { mode: input.cropSettings.mode, customRect: { ...input.cropSettings.customRect } },
    anchor: { ...input.anchor },
    scale: { ...input.scale, snapSettings: { ...input.scale.snapSettings } },
    processing: { ...input.processing },
    bead: { ...input.bead },
    result: input.result ? {
      width: input.result.width,
      height: input.result.height,
      dataBase64: bytesToBase64(input.result.data),
    } : null,
    colorCodes: { ...input.colorCodes },
  }
}
