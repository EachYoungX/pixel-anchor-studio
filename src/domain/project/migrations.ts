import { defaultBead, defaultProcessing, defaultScale } from '@/domain/project/defaults'
import type { BeadSettings, ProcessingSettings, ScaleSettings, SerializedProject, SerializedSourceV4 } from '@/types/project'

interface LegacyScaleSettings extends Partial<ScaleSettings> {
  directValue?: number
  directAxis?: string
  snapToGrid?: boolean
}

function dataUrlParts(value: string): { mime: string; dataBase64: string } {
  const match = /^data:([^;,]+)?(?:;[^,]*)?,(.*)$/s.exec(value)
  if (!match) return { mime: 'image/png', dataBase64: '' }
  return { mime: match[1] || 'image/png', dataBase64: match[2] || '' }
}

function migrateSource(raw: unknown): SerializedSourceV4 | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const legacyDataUrl = typeof source.dataUrl === 'string' ? source.dataUrl : ''
  const parts = dataUrlParts(legacyDataUrl)
  return {
    name: typeof source.name === 'string' ? source.name : 'source-image',
    mime: typeof source.mime === 'string' ? source.mime : parts.mime,
    width: Number(source.width) || 0,
    height: Number(source.height) || 0,
    dataBase64: typeof source.dataBase64 === 'string' ? source.dataBase64 : parts.dataBase64,
  }
}

export function migrateProject(value: unknown): SerializedProject {
  if (!value || typeof value !== 'object') throw new Error('项目文件内容无效')
  const raw = value as Record<string, unknown>
  if (raw.format !== 'pixel-anchor-project' || ![1, 2, 3, 4].includes(raw.version as number)) throw new Error('不支持的项目文件格式')

  const defaults = defaultScale()
  const legacyScale = (raw.scale ?? {}) as LegacyScaleSettings
  const mode = legacyScale.mode ?? defaults.mode
  const currentSnap = legacyScale.snapMode ?? (mode === 'pseudo' ? 'target-cell' : 'source-pixel')
  const scale: ScaleSettings = {
    ...defaults,
    ...legacyScale,
    mode,
    directLongSide: legacyScale.directLongSide ?? legacyScale.directValue ?? defaults.directLongSide,
    snapMode: currentSnap,
    snapSettings: legacyScale.snapSettings ?? { direct: currentSnap, anchor: currentSnap, pseudo: currentSnap },
  }
  delete (scale as Partial<ScaleSettings> & { directValue?: number }).directValue
  delete (scale as Partial<ScaleSettings> & { directAxis?: string }).directAxis
  delete (scale as Partial<ScaleSettings> & { snapToGrid?: boolean }).snapToGrid

  const rawProcessing = (raw.processing ?? {}) as Partial<ProcessingSettings>
  const processing: ProcessingSettings = { ...defaultProcessing(), ...rawProcessing }
  const rawBead = (raw.bead ?? {}) as Partial<BeadSettings>
  const bead: BeadSettings = { ...defaultBead(), ...rawBead }
  const crop = (raw.crop ?? { x: 0, y: 0, width: 1, height: 1 }) as SerializedProject['crop']
  const rawCropSettings = raw.cropSettings as Partial<SerializedProject['cropSettings']> | undefined

  return {
    format: 'pixel-anchor-project',
    version: 4,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
    source: migrateSource(raw.source),
    crop,
    cropSettings: {
      mode: rawCropSettings?.mode ?? 'custom',
      customRect: rawCropSettings?.customRect ?? crop,
    },
    anchor: (raw.anchor ?? { x: 0, y: 0, width: 4, height: 4 }) as SerializedProject['anchor'],
    scale,
    processing,
    bead,
    result: (raw.result ?? null) as SerializedProject['result'],
    colorCodes: (raw.colorCodes ?? {}) as Record<string, string>,
  }
}
