import type { BeadSettings, ProcessingSettings, ScaleSettings, SnapSettings } from '@/types/project'

export function defaultSnapSettings(): SnapSettings {
  return { direct: 'source-pixel', anchor: 'source-pixel', pseudo: 'target-cell' }
}

export function defaultScale(): ScaleSettings {
  return {
    mode: 'direct',
    directLongSide: 32,
    anchorCells: 3,
    pseudoCellSize: 8,
    offsetX: 0,
    offsetY: 0,
    snapMode: 'source-pixel',
    snapSettings: defaultSnapSettings(),
  }
}

export function defaultProcessing(): ProcessingSettings {
  return {
    sampling: 'median',
    quantize: true,
    maxColors: 64,
    cleanup: 'off',
    preserveAlpha: true,
    transparentThreshold: 24,
  }
}

export function defaultBead(): BeadSettings {
  return { maxColors: 64, cellSize: 24, pageColumns: 32, pageRows: 32, indexFromOne: true }
}
