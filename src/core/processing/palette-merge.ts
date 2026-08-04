import { colorDistanceSquared, colorKey } from '@/core/color'
import type { MergeStrength, PixelResult } from '@/types/project'

const limits: Record<Exclude<MergeStrength, 'off'>, { ratio: number; absolute: number; distance: number; adjacentOnly: boolean }> = {
  conservative: { ratio: 0.001, absolute: 4, distance: 900, adjacentOnly: true },
  balanced: { ratio: 0.005, absolute: 16, distance: 1800, adjacentOnly: false },
  strong: { ratio: 0.015, absolute: 64, distance: 3600, adjacentOnly: false },
}

interface ColorInfo { rgba: [number, number, number, number]; count: number; neighbors: Set<string> }

export function mergeSimilarColors(result: PixelResult, strength: MergeStrength): { result: PixelResult; before: number; after: number } {
  if (strength === 'off') return { result, before: 0, after: 0 }
  const config = limits[strength]
  const colors = new Map<string, ColorInfo>()
  const index = (x: number, y: number) => (y * result.width + x) * 4
  for (let y = 0; y < result.height; y += 1) for (let x = 0; x < result.width; x += 1) {
    const offset = index(x, y)
    if (result.data[offset + 3] === 0) continue
    const rgba: [number, number, number, number] = [result.data[offset], result.data[offset + 1], result.data[offset + 2], result.data[offset + 3]]
    const key = colorKey(...rgba)
    const info = colors.get(key) ?? { rgba, count: 0, neighbors: new Set<string>() }
    info.count += 1
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= result.width || ny >= result.height) continue
      const neighborOffset = index(nx, ny)
      if (result.data[neighborOffset + 3] === 0) continue
      info.neighbors.add(colorKey(result.data[neighborOffset], result.data[neighborOffset + 1], result.data[neighborOffset + 2], result.data[neighborOffset + 3]))
    }
    colors.set(key, info)
  }
  const before = colors.size
  const replacements = new Map<string, string>()
  for (const [sourceKey, source] of [...colors.entries()].sort((a, b) => a[1].count - b[1].count)) {
    if (source.count > Math.max(config.absolute, Math.floor(result.width * result.height * config.ratio))) continue
    let best: ColorInfo | null = null
    let bestDistance = Infinity
    for (const [targetKey, target] of colors) {
      if (targetKey === sourceKey || target.count < source.count) continue
      if (config.adjacentOnly && !source.neighbors.has(targetKey)) continue
      const distance = colorDistanceSquared(...source.rgba.slice(0, 3) as [number, number, number], ...target.rgba.slice(0, 3) as [number, number, number])
      if (distance <= config.distance && distance < bestDistance) { best = target; bestDistance = distance }
    }
    if (best) replacements.set(sourceKey, colorKey(...best.rgba))
  }
  if (replacements.size === 0) return { result, before, after: before }
  function resolveReplacement(key: string): string {
    const visited = new Set<string>()
    let current = key
    while (replacements.has(current) && !visited.has(current)) {
      visited.add(current)
      current = replacements.get(current)!
    }
    return current
  }
  const next = new Uint8ClampedArray(result.data)
  const actualColors = new Set<string>()
  for (let offset = 0; offset < next.length; offset += 4) {
    const key = colorKey(next[offset], next[offset + 1], next[offset + 2], next[offset + 3])
    const replacement = resolveReplacement(key)
    if (replacement === key) {
      if (next[offset + 3] !== 0) actualColors.add(key)
      continue
    }
    const rgba = replacement.split(',').map(Number)
    next.set(rgba, offset)
    actualColors.add(replacement)
  }
  return { result: { ...result, data: next }, before, after: actualColors.size }
}
