import { colorDistanceSquared } from '@/core/color'
import type { MergeStrength, PixelResult } from '@/types/project'

const limits: Record<Exclude<MergeStrength, 'off'>, { ratio: number; absolute: number; distance: number; adjacentOnly: boolean }> = {
  conservative: { ratio: 0.001, absolute: 4, distance: 900, adjacentOnly: true },
  balanced: { ratio: 0.005, absolute: 16, distance: 1800, adjacentOnly: false },
  strong: { ratio: 0.015, absolute: 64, distance: 3600, adjacentOnly: false },
}

interface ColorInfo {
  rgba: [number, number, number, number]
  count: number
  neighbors: Set<number>
}

function packRgba(r: number, g: number, b: number, a: number): number {
  return (((r << 24) | (g << 16) | (b << 8) | a) >>> 0)
}

function unpackRgba(value: number): [number, number, number, number] {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]
}

function pixelOffset(width: number, x: number, y: number): number {
  return (y * width + x) * 4
}

function addNeighbor(result: PixelResult, info: ColorInfo, offset: number): void {
  if (result.data[offset + 3] === 0) return
  info.neighbors.add(packRgba(result.data[offset], result.data[offset + 1], result.data[offset + 2], result.data[offset + 3]))
}

export function mergeSimilarColors(result: PixelResult, strength: MergeStrength): { result: PixelResult; before: number; after: number } {
  if (strength === 'off') return { result, before: 0, after: 0 }
  const config = limits[strength]
  const colors = new Map<number, ColorInfo>()
  for (let y = 0; y < result.height; y += 1) {
    for (let x = 0; x < result.width; x += 1) {
      const offset = pixelOffset(result.width, x, y)
      if (result.data[offset + 3] === 0) continue
      const rgba: [number, number, number, number] = [result.data[offset], result.data[offset + 1], result.data[offset + 2], result.data[offset + 3]]
      const key = packRgba(...rgba)
      const info = colors.get(key) ?? { rgba, count: 0, neighbors: new Set<number>() }
      info.count += 1
      if (x > 0) addNeighbor(result, info, offset - 4)
      if (x + 1 < result.width) addNeighbor(result, info, offset + 4)
      if (y > 0) addNeighbor(result, info, offset - result.width * 4)
      if (y + 1 < result.height) addNeighbor(result, info, offset + result.width * 4)
      colors.set(key, info)
    }
  }

  const before = colors.size
  const replacements = new Map<number, number>()
  const orderedColors = [...colors.entries()].sort((a, b) => a[1].count - b[1].count)
  for (const [sourceKey, source] of orderedColors) {
    if (source.count > Math.max(config.absolute, Math.floor(result.width * result.height * config.ratio))) continue
    let bestKey: number | null = null
    let best: ColorInfo | null = null
    let bestDistance = Infinity
    for (const [targetKey, target] of colors) {
      if (targetKey === sourceKey || target.count < source.count) continue
      if (config.adjacentOnly && !source.neighbors.has(targetKey)) continue
      const distance = colorDistanceSquared(source.rgba[0], source.rgba[1], source.rgba[2], target.rgba[0], target.rgba[1], target.rgba[2])
      if (distance <= config.distance && distance < bestDistance) {
        bestKey = targetKey
        best = target
        bestDistance = distance
      }
    }
    if (best && bestKey !== null) replacements.set(sourceKey, bestKey)
  }
  if (replacements.size === 0) return { result, before, after: before }

  const resolved = new Map<number, number>()
  for (const sourceKey of replacements.keys()) {
    const visited = new Set<number>()
    let current = sourceKey
    while (replacements.has(current) && !visited.has(current)) {
      visited.add(current)
      current = replacements.get(current)!
    }
    resolved.set(sourceKey, current)
  }

  const next = new Uint8ClampedArray(result.data)
  const actualColors = new Set<number>()
  for (let offset = 0; offset < next.length; offset += 4) {
    const key = packRgba(next[offset], next[offset + 1], next[offset + 2], next[offset + 3])
    const replacementKey = resolved.get(key)
    if (replacementKey !== undefined && replacementKey !== key) next.set(unpackRgba(replacementKey), offset)
    if (next[offset + 3] !== 0) actualColors.add(packRgba(next[offset], next[offset + 1], next[offset + 2], next[offset + 3]))
  }
  return { result: { ...result, data: next }, before, after: actualColors.size }
}
