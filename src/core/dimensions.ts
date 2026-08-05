import type { Rect, ScaleSettings } from '@/types/project'
import { createGridGeometry, type GridGeometry } from '@/core/grid-geometry'

export const MAX_OUTPUT_SIZE = 256

export interface OutputDimensions {
  width: number
  height: number
  adjusted: boolean
  sourceCellSize: number
  geometry: GridGeometry
}

function clampDimension(value: number): number {
  return Math.max(1, Math.min(MAX_OUTPUT_SIZE, Math.round(value)))
}

export function calculateOutputDimensions(
  crop: Rect,
  anchor: Rect,
  settings: ScaleSettings,
): OutputDimensions {
  const cropWidth = Math.max(1, crop.width)
  const cropHeight = Math.max(1, crop.height)
  if (settings.mode === 'direct') {
    const requested = clampDimension(settings.directLongSide)
    const requestedCellSize = Math.max(0.25, Math.max(cropWidth, cropHeight) / requested)
    const geometry = createGridGeometry(crop, requestedCellSize, settings.offsetX, settings.offsetY)
    return {
      width: geometry.outputWidth,
      height: geometry.outputHeight,
      adjusted: geometry.adjustedByLimit,
      sourceCellSize: geometry.cellSize,
      geometry,
    }
  }

  if (settings.mode === 'anchor') {
    const anchorSide = Math.max(1, anchor.width)
    const sourceCellSize = anchorSide / Math.max(1, settings.anchorCells)
    const geometry = createGridGeometry(crop, sourceCellSize, settings.offsetX, settings.offsetY)
    return {
      width: geometry.outputWidth,
      height: geometry.outputHeight,
      adjusted: geometry.adjustedByLimit,
      sourceCellSize: geometry.cellSize,
      geometry,
    }
  }

  const sourceCellSize = Math.max(0.25, settings.pseudoCellSize)
  const geometry = createGridGeometry(crop, sourceCellSize, settings.offsetX, settings.offsetY)
  return {
    width: geometry.outputWidth,
    height: geometry.outputHeight,
    adjusted: geometry.adjustedByLimit,
    sourceCellSize: geometry.cellSize,
    geometry,
  }
}
