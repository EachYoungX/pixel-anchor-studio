import type { PixelResult } from '@/types/project'

export interface DirtyBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function createDirtyBounds(x: number, y: number): DirtyBounds {
  return { minX: x, minY: y, maxX: x, maxY: y }
}

export function expandDirtyBounds(bounds: DirtyBounds, x: number, y: number): DirtyBounds {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.maxY = Math.max(bounds.maxY, y)
  return bounds
}

export function setPixelRgba(result: PixelResult, x: number, y: number, rgba: readonly [number, number, number, number]): boolean {
  if (x < 0 || y < 0 || x >= result.width || y >= result.height) return false
  const offset = (y * result.width + x) * 4
  if (rgba.every((value, index) => value === result.data[offset + index])) return false
  result.data.set(rgba, offset)
  return true
}
