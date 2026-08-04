export type ScaleMode = 'direct' | 'anchor' | 'pseudo'
export type CropMode = 'custom' | 'full' | 'center-square'
export type DirectAxis = 'width' | 'height' | 'longSide'
export type SamplingMode = 'average' | 'median' | 'dominant' | 'nearest'
export type CleanupStrength = 'off' | 'light' | 'medium' | 'strong'
export type MergeStrength = 'off' | 'conservative' | 'balanced' | 'strong'
export type PaletteSortMode = 'count-desc' | 'hue' | 'lightness' | 'code'
export type WorkspaceMode = 'pixel' | 'bead'
export type SnapMode = 'source-pixel' | 'target-cell' | 'off'
export type EditTarget = 'crop' | 'anchor'
export type PixelTool = 'brush' | 'eyedropper' | 'fill' | 'eraser'

export interface SnapSettings {
  direct: SnapMode
  anchor: SnapMode
  pseudo: SnapMode
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface CropSettings {
  mode: CropMode
  customRect: Rect
}

export interface SourceState {
  name: string
  dataUrl: string
  width: number
  height: number
}

export interface ScaleSettings {
  mode: ScaleMode
  directAxis: DirectAxis
  directValue: number
  anchorCells: number
  pseudoCellSize: number
  offsetX: number
  offsetY: number
  snapToGrid?: boolean
  snapMode?: SnapMode
  snapSettings?: SnapSettings
}

export interface ProcessingSettings {
  sampling: SamplingMode
  quantize: boolean
  maxColors: number
  cleanup: CleanupStrength
  preserveAlpha: boolean
  transparentThreshold: number
}

export interface BeadSettings {
  maxColors: number
  cellSize: number
  pageColumns: number
  pageRows: number
  indexFromOne: boolean
}

export interface PixelResult {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface HistoryEntry {
  label: string
  result: PixelResult
}

export interface PaletteEntry {
  code: string
  hex: string
  rgba: [number, number, number, number]
  count: number
}

export interface SerializedPixelResult {
  width: number
  height: number
  dataBase64: string
}

export interface SerializedProject {
  format: 'pixel-anchor-project'
  version: 1 | 2
  savedAt: string
  source: SourceState | null
  crop: Rect
  cropSettings?: CropSettings
  anchor: Rect
  scale: ScaleSettings
  processing: ProcessingSettings
  bead: BeadSettings
  result: SerializedPixelResult | null
  colorCodes: Record<string, string>
}

export interface ProcessRequest {
  sourceId?: string
  source: {
    width: number
    height: number
    data: Uint8ClampedArray
  }
  crop: Rect
  output: {
    width: number
    height: number
  }
  grid?: {
    cellSize: number
    originX: number
    originY: number
  }
  scaleOffset: {
    x: number
    y: number
  }
  processing: ProcessingSettings
}

export interface ProcessResponse {
  result: PixelResult
  durationMs: number
}
