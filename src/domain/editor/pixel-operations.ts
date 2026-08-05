import type { PixelResult } from '@/types/project'
import { rgbaToHex } from '@/core/color'

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

export function pixelMatchesRgba(result: PixelResult, x: number, y: number, rgba: readonly [number, number, number, number]): boolean {
  if (x < 0 || y < 0 || x >= result.width || y >= result.height) return false
  const offset = (y * result.width + x) * 4
  return rgba.every((value, index) => value === result.data[offset + index])
}

export function setPixelRgba(result: PixelResult, x: number, y: number, rgba: readonly [number, number, number, number]): boolean {
  if (x < 0 || y < 0 || x >= result.width || y >= result.height || pixelMatchesRgba(result, x, y, rgba)) return false
  const offset = (y * result.width + x) * 4
  result.data.set(rgba, offset)
  return true
}

export function readPixelHex(result: PixelResult, x: number, y: number): string | null {
  if (x < 0 || y < 0 || x >= result.width || y >= result.height) return null
  const offset = (y * result.width + x) * 4
  return rgbaToHex(result.data[offset], result.data[offset + 1], result.data[offset + 2], result.data[offset + 3])
}

export function floodFillRgba(result: PixelResult, x: number, y: number, replacement: readonly [number, number, number, number]): boolean {
  if (x < 0 || y < 0 || x >= result.width || y >= result.height) return false
  const start = y * result.width + x
  const startOffset = start * 4
  const target = [
    result.data[startOffset],
    result.data[startOffset + 1],
    result.data[startOffset + 2],
    result.data[startOffset + 3],
  ] as const
  if (target.every((value, index) => value === replacement[index])) return false

  const visited = new Uint8Array(result.width * result.height)
  const queue = new Int32Array(result.width * result.height)
  let head = 0
  let tail = 0
  queue[tail++] = start
  visited[start] = 1
  while (head < tail) {
    const current = queue[head++]
    const offset = current * 4
    if (!target.every((value, index) => result.data[offset + index] === value)) continue
    result.data.set(replacement, offset)
    const cx = current % result.width
    const cy = Math.floor(current / result.width)
    if (cx > 0 && !visited[current - 1]) {
      visited[current - 1] = 1
      queue[tail++] = current - 1
    }
    if (cx + 1 < result.width && !visited[current + 1]) {
      visited[current + 1] = 1
      queue[tail++] = current + 1
    }
    if (cy > 0 && !visited[current - result.width]) {
      visited[current - result.width] = 1
      queue[tail++] = current - result.width
    }
    if (cy + 1 < result.height && !visited[current + result.width]) {
      visited[current + result.width] = 1
      queue[tail++] = current + result.width
    }
  }
  return true
}
