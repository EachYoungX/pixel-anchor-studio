import type { GridGeometry } from '@/core/grid-geometry'

export interface GridPreviewBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export function calculateGridPreviewStride(outputWidth: number, outputHeight: number, screenCellSize: number): number {
  const lineLimitStride = Math.ceil(Math.max(outputWidth, outputHeight) / 64)
  const minimumVisibleStride = Math.ceil(3 / Math.max(screenCellSize, 0.001))
  return Math.max(1, lineLimitStride, minimumVisibleStride)
}

export function gridPreviewIndices(count: number, stride: number): number[] {
  if (count <= 0) return [0]
  const safeStride = Math.max(1, Math.floor(stride))
  const indices = [0]
  for (let value = safeStride; value < count; value += safeStride) indices.push(value)
  indices.push(count)
  return indices
}

export function calculateGridPreviewBounds(geometry: GridGeometry, scale: number, offsetX: number, offsetY: number): GridPreviewBounds {
  const left = offsetX + geometry.originX * scale
  const top = offsetY + geometry.originY * scale
  return {
    left,
    top,
    right: left + geometry.coverageWidth * scale,
    bottom: top + geometry.coverageHeight * scale,
  }
}
