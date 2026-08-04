import { colorDistanceSquared } from '@/core/color'
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

function getKey(data: Uint8ClampedArray, index: number): number {
  const offset = dataOffset(index)
  return (((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0)
}

function inspectNeighbor(
  output: Uint8ClampedArray,
  targetKey: number,
  neighbor: number,
  visited: Uint8Array,
  queue: Int32Array,
  queueEnd: number,
  boundary: Map<number, { count: number; rgba: [number, number, number, number] }>,
): number {
  const neighborKey = getKey(output, neighbor)
  if (neighborKey === targetKey) {
    if (!visited[neighbor]) {
      visited[neighbor] = 1
      queue[queueEnd] = neighbor
      return queueEnd + 1
    }
    return queueEnd
  }
  const offset = dataOffset(neighbor)
  const entry = boundary.get(neighborKey) ?? {
    count: 0,
    rgba: [output[offset], output[offset + 1], output[offset + 2], output[offset + 3]],
  }
  entry.count += 1
  boundary.set(neighborKey, entry)
  return queueEnd
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
  const component = new Int32Array(width * height)
  const queue = new Int32Array(width * height)

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start]) continue
    visited[start] = 1
    const targetKey = getKey(output, start)
    let componentLength = 0
    let queueStart = 0
    let queueEnd = 0
    queue[queueEnd++] = start
    const boundary = new Map<number, { count: number; rgba: [number, number, number, number] }>()

    while (queueStart < queueEnd) {
      const current = queue[queueStart++]
      component[componentLength++] = current
      const x = current % width
      const y = Math.floor(current / width)
      if (x > 0) queueEnd = inspectNeighbor(output, targetKey, current - 1, visited, queue, queueEnd, boundary)
      if (x + 1 < width) queueEnd = inspectNeighbor(output, targetKey, current + 1, visited, queue, queueEnd, boundary)
      if (y > 0) queueEnd = inspectNeighbor(output, targetKey, current - width, visited, queue, queueEnd, boundary)
      if (y + 1 < height) queueEnd = inspectNeighbor(output, targetKey, current + width, visited, queue, queueEnd, boundary)
    }

    if (componentLength > threshold || boundary.size === 0) continue
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

    for (let componentIndex = 0; componentIndex < componentLength; componentIndex += 1) {
      const index = component[componentIndex]
      const offset = dataOffset(index)
      output[offset] = replacement[0]
      output[offset + 1] = replacement[1]
      output[offset + 2] = replacement[2]
      output[offset + 3] = replacement[3]
    }
  }

  return output
}
