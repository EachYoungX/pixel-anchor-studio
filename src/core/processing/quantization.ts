import { colorDistanceSquared } from '@/core/color'

interface ColorPoint {
  r: number
  g: number
  b: number
  count: number
}

interface ColorBox {
  colors: ColorPoint[]
  count: number
  rMin: number
  rMax: number
  gMin: number
  gMax: number
  bMin: number
  bMax: number
}

function createBox(colors: ColorPoint[]): ColorBox {
  let count = 0
  let rMin = 255
  let rMax = 0
  let gMin = 255
  let gMax = 0
  let bMin = 255
  let bMax = 0

  for (const color of colors) {
    count += color.count
    rMin = Math.min(rMin, color.r)
    rMax = Math.max(rMax, color.r)
    gMin = Math.min(gMin, color.g)
    gMax = Math.max(gMax, color.g)
    bMin = Math.min(bMin, color.b)
    bMax = Math.max(bMax, color.b)
  }

  return { colors, count, rMin, rMax, gMin, gMax, bMin, bMax }
}

function boxScore(box: ColorBox): number {
  const range = Math.max(box.rMax - box.rMin, box.gMax - box.gMin, box.bMax - box.bMin)
  return range * Math.log2(box.count + 1)
}

function splitBox(box: ColorBox): [ColorBox, ColorBox] | null {
  if (box.colors.length <= 1) return null
  const ranges = [
    { channel: 'r' as const, range: box.rMax - box.rMin },
    { channel: 'g' as const, range: box.gMax - box.gMin },
    { channel: 'b' as const, range: box.bMax - box.bMin },
  ].sort((a, b) => b.range - a.range)

  const channel = ranges[0].channel
  const sorted = [...box.colors].sort((a, b) => a[channel] - b[channel])
  const half = box.count / 2
  let cumulative = 0
  let splitIndex = 1

  for (let index = 0; index < sorted.length; index += 1) {
    cumulative += sorted[index].count
    if (cumulative >= half) {
      splitIndex = Math.max(1, Math.min(sorted.length - 1, index + 1))
      break
    }
  }

  return [createBox(sorted.slice(0, splitIndex)), createBox(sorted.slice(splitIndex))]
}

function averageColor(box: ColorBox): [number, number, number] {
  let r = 0
  let g = 0
  let b = 0
  for (const color of box.colors) {
    r += color.r * color.count
    g += color.g * color.count
    b += color.b * color.count
  }
  return [Math.round(r / box.count), Math.round(g / box.count), Math.round(b / box.count)]
}

function buildHistogram(data: Uint8ClampedArray): ColorPoint[] {
  const histogram = new Map<number, number>()
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue
    // Five bits per channel keeps median-cut memory bounded while preserving structure.
    const r = data[offset] >> 3
    const g = data[offset + 1] >> 3
    const b = data[offset + 2] >> 3
    const key = (r << 10) | (g << 5) | b
    histogram.set(key, (histogram.get(key) ?? 0) + 1)
  }

  return [...histogram.entries()].map(([key, count]) => ({
    r: ((key >> 10) & 31) * 8 + 4,
    g: ((key >> 5) & 31) * 8 + 4,
    b: (key & 31) * 8 + 4,
    count,
  }))
}

export function medianCutPalette(data: Uint8ClampedArray, maxColors: number): Array<[number, number, number]> {
  const colors = buildHistogram(data)
  if (colors.length === 0) return []
  if (colors.length <= maxColors) return colors.map((color) => [color.r, color.g, color.b])

  const boxes: ColorBox[] = [createBox(colors)]
  while (boxes.length < maxColors) {
    boxes.sort((a, b) => boxScore(b) - boxScore(a))
    const current = boxes.shift()
    if (!current) break
    const split = splitBox(current)
    if (!split) {
      boxes.unshift(current)
      break
    }
    boxes.push(...split)
  }

  return boxes.map(averageColor)
}

export function mapToPalette(
  data: Uint8ClampedArray,
  palette: Array<[number, number, number]>,
): Uint8ClampedArray {
  if (palette.length === 0) return new Uint8ClampedArray(data)
  const output = new Uint8ClampedArray(data.length)
  const cache = new Map<number, [number, number, number]>()

  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3]
    if (alpha === 0) {
      output[offset + 3] = 0
      continue
    }

    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const cacheKey = (r << 16) | (g << 8) | b
    let nearest = cache.get(cacheKey)

    if (!nearest) {
      let bestDistance = Number.POSITIVE_INFINITY
      nearest = palette[0]
      for (const candidate of palette) {
        const distance = colorDistanceSquared(r, g, b, candidate[0], candidate[1], candidate[2])
        if (distance < bestDistance) {
          bestDistance = distance
          nearest = candidate
        }
      }
      cache.set(cacheKey, nearest)
    }

    output[offset] = nearest[0]
    output[offset + 1] = nearest[1]
    output[offset + 2] = nearest[2]
    output[offset + 3] = alpha
  }
  return output
}

export function quantizeImage(data: Uint8ClampedArray, maxColors: number): Uint8ClampedArray {
  const palette = medianCutPalette(data, Math.max(2, maxColors))
  return mapToPalette(data, palette)
}
