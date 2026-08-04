import { colorDistanceSquared, colorKey } from '@/core/color'
import type { CleanupStrength } from '@/types/project'

function thresholdForStrength(strength: CleanupStrength): number {
  if (strength === 'light') return 1
  if (strength === 'medium') return 2
  if (strength === 'strong') return 4
  return 0
}

function pixelIndex(width: number, x: number, y: number): number {
  return y * width + x
}

function dataOffset(index: number): number {
  return index * 4
}

function getKey(data: Uint8ClampedArray, index: number): string {
  const offset = dataOffset(index)
  return colorKey(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])
}

function neighbors(width: number, height: number, index: number): number[] {
  const x = index % width
  const y = Math.floor(index / width)
  const result: number[] = []
  if (x > 0) result.push(pixelIndex(width, x - 1, y))
  if (x + 1 < width) result.push(pixelIndex(width, x + 1, y))
  if (y > 0) result.push(pixelIndex(width, x, y - 1))
  if (y + 1 < height) result.push(pixelIndex(width, x, y + 1))
  return result
}

export function cleanupSmallRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: CleanupStrength,
): Uint8ClampedArray {
  const threshold = thresholdForStrength(strength)
  if (threshold <= 0) return new Uint8ClampedArray(data)

  const output = new Uint8ClampedArray(data)
  const visited = new Uint8Array(width * height)

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start]) continue
    visited[start] = 1
    const targetKey = getKey(output, start)
    const component: number[] = []
    const queue = [start]
    const boundary = new Map<string, { count: number; rgba: [number, number, number, number] }>()

    while (queue.length > 0) {
      const current = queue.pop()!
      component.push(current)
      for (const neighbor of neighbors(width, height, current)) {
        const neighborKey = getKey(output, neighbor)
        if (neighborKey === targetKey) {
          if (!visited[neighbor]) {
            visited[neighbor] = 1
            queue.push(neighbor)
          }
        } else {
          const offset = dataOffset(neighbor)
          const entry = boundary.get(neighborKey) ?? {
            count: 0,
            rgba: [output[offset], output[offset + 1], output[offset + 2], output[offset + 3]],
          }
          entry.count += 1
          boundary.set(neighborKey, entry)
        }
      }
    }

    if (component.length > threshold || boundary.size === 0) continue
    const sourceOffset = dataOffset(component[0])
    const source = [
      output[sourceOffset],
      output[sourceOffset + 1],
      output[sourceOffset + 2],
      output[sourceOffset + 3],
    ] as const

    const replacement = [...boundary.values()].sort((a, b) => {
      const contactDifference = b.count - a.count
      if (contactDifference !== 0) return contactDifference
      return (
        colorDistanceSquared(source[0], source[1], source[2], a.rgba[0], a.rgba[1], a.rgba[2]) -
        colorDistanceSquared(source[0], source[1], source[2], b.rgba[0], b.rgba[1], b.rgba[2])
      )
    })[0].rgba

    for (const index of component) {
      const offset = dataOffset(index)
      output[offset] = replacement[0]
      output[offset + 1] = replacement[1]
      output[offset + 2] = replacement[2]
      output[offset + 3] = replacement[3]
    }
  }

  return output
}
