import type { Rect } from '@/types/project'

export interface GridGeometry {
  outputWidth: number
  outputHeight: number
  cellSize: number
  originX: number
  originY: number
  coverageWidth: number
  coverageHeight: number
  remainderX: number
  remainderY: number
  adjustedByLimit: boolean
}

export function createGridGeometry(
  crop: Rect,
  requestedCellSize: number,
  offsetX = 0,
  offsetY = 0,
): GridGeometry {
  const cropWidth = Math.max(1, crop.width)
  const cropHeight = Math.max(1, crop.height)
  const limitCellSize = Math.max(cropWidth / 256, cropHeight / 256)
  const safeRequestedCellSize = Math.max(0.25, requestedCellSize)
  const cellSize = Math.max(safeRequestedCellSize, limitCellSize)
  const outputWidth = Math.max(1, Math.floor(cropWidth / cellSize))
  const outputHeight = Math.max(1, Math.floor(cropHeight / cellSize))
  const coverageWidth = outputWidth * cellSize
  const coverageHeight = outputHeight * cellSize
  const remainderX = cropWidth - coverageWidth
  const remainderY = cropHeight - coverageHeight

  return {
    outputWidth,
    outputHeight,
    cellSize,
    originX: crop.x + remainderX / 2 + offsetX * cellSize,
    originY: crop.y + remainderY / 2 + offsetY * cellSize,
    coverageWidth,
    coverageHeight,
    remainderX,
    remainderY,
    adjustedByLimit: cellSize > safeRequestedCellSize,
  }
}
