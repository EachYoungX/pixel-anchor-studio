import type { ProcessRequest, SamplingMode } from '@/types/project'

interface SampleBounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function pixelOffset(width: number, x: number, y: number): number {
  return (y * width + x) * 4
}

function boundsForCell(request: ProcessRequest, targetX: number, targetY: number): SampleBounds {
  const { crop, output, scaleOffset, source } = request
  const cellSize = request.grid?.cellSize ?? Math.max(crop.width / output.width, crop.height / output.height)
  const originX = request.grid?.originX ?? crop.x + scaleOffset.x * cellSize
  const originY = request.grid?.originY ?? crop.y + scaleOffset.y * cellSize
  const shiftedX = originX + targetX * cellSize
  const shiftedY = originY + targetY * cellSize
  const cropRight = Math.min(source.width, crop.x + crop.width)
  const cropBottom = Math.min(source.height, crop.y + crop.height)

  return {
    x0: clamp(shiftedX, crop.x, cropRight),
    y0: clamp(shiftedY, crop.y, cropBottom),
    x1: clamp(shiftedX + cellSize, crop.x, cropRight),
    y1: clamp(shiftedY + cellSize, crop.y, cropBottom),
  }
}

function nearestSample(request: ProcessRequest, bounds: SampleBounds): [number, number, number, number] {
  const x = clamp(Math.floor((bounds.x0 + bounds.x1) / 2), 0, request.source.width - 1)
  const y = clamp(Math.floor((bounds.y0 + bounds.y1) / 2), 0, request.source.height - 1)
  const offset = pixelOffset(request.source.width, x, y)
  const data = request.source.data
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
}

interface SamplePixels {
  data: Uint8Array
  count: number
}

function collectPixels(request: ProcessRequest, bounds: SampleBounds): SamplePixels {
  const x0 = clamp(Math.floor(bounds.x0), 0, request.source.width - 1)
  const y0 = clamp(Math.floor(bounds.y0), 0, request.source.height - 1)
  const x1 = clamp(Math.max(x0 + 1, Math.ceil(bounds.x1)), 1, request.source.width)
  const y1 = clamp(Math.max(y0 + 1, Math.ceil(bounds.y1)), 1, request.source.height)
  const count = (x1 - x0) * (y1 - y0)
  const pixels = new Uint8Array(count * 4)
  const data = request.source.data
  let targetOffset = 0

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = pixelOffset(request.source.width, x, y)
      pixels[targetOffset] = data[offset]
      pixels[targetOffset + 1] = data[offset + 1]
      pixels[targetOffset + 2] = data[offset + 2]
      pixels[targetOffset + 3] = data[offset + 3]
      targetOffset += 4
    }
  }
  return { data: pixels, count }
}

function averageSample(pixels: SamplePixels): [number, number, number, number] {
  if (pixels.count === 0) return [0, 0, 0, 0]
  const sums = [0, 0, 0, 0]
  let alphaWeight = 0
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const alpha = pixels.data[offset + 3] / 255
    sums[0] += pixels.data[offset] * alpha
    sums[1] += pixels.data[offset + 1] * alpha
    sums[2] += pixels.data[offset + 2] * alpha
    sums[3] += pixels.data[offset + 3]
    alphaWeight += alpha
  }
  if (alphaWeight <= 0) return [0, 0, 0, 0]
  return [
    Math.round(sums[0] / alphaWeight),
    Math.round(sums[1] / alphaWeight),
    Math.round(sums[2] / alphaWeight),
    Math.round(sums[3] / pixels.count),
  ]
}

function medianSample(pixels: SamplePixels): [number, number, number, number] {
  if (pixels.count === 0) return [0, 0, 0, 0]
  const histograms = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    for (let channel = 0; channel < 4; channel += 1) histograms[channel][pixels.data[offset + channel]] += 1
  }
  const middle = Math.floor(pixels.count / 2)
  const median = histograms.map((histogram) => {
    let accumulated = 0
    for (let value = 0; value < 256; value += 1) {
      accumulated += histogram[value]
      if (accumulated > middle) return value
    }
    return 255
  })
  let bestOffset = 0
  let bestDistance = Infinity
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const distance = (pixels.data[offset] - median[0]) ** 2 + (pixels.data[offset + 1] - median[1]) ** 2 + (pixels.data[offset + 2] - median[2]) ** 2 + (pixels.data[offset + 3] - median[3]) ** 2
    if (distance < bestDistance) {
      bestOffset = offset
      bestDistance = distance
    }
  }
  return [pixels.data[bestOffset], pixels.data[bestOffset + 1], pixels.data[bestOffset + 2], pixels.data[bestOffset + 3]]
}

function dominantSample(pixels: SamplePixels): [number, number, number, number] {
  if (pixels.count === 0) return [0, 0, 0, 0]
  const buckets = new Map<string, { count: number; r: number; g: number; b: number; a: number }>()
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const key = `${pixels.data[offset] >> 4},${pixels.data[offset + 1] >> 4},${pixels.data[offset + 2] >> 4},${pixels.data[offset + 3] >> 5}`
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, a: 0 }
    bucket.count += 1
    bucket.r += pixels.data[offset]
    bucket.g += pixels.data[offset + 1]
    bucket.b += pixels.data[offset + 2]
    bucket.a += pixels.data[offset + 3]
    buckets.set(key, bucket)
  }
  const dominantEntry = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count)[0]
  const dominantKey = dominantEntry[0]
  const dominant = dominantEntry[1]
  const target = [dominant.r / dominant.count, dominant.g / dominant.count, dominant.b / dominant.count, dominant.a / dominant.count]
  let bestOffset = 0
  let bestDistance = Infinity
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const key = `${pixels.data[offset] >> 4},${pixels.data[offset + 1] >> 4},${pixels.data[offset + 2] >> 4},${pixels.data[offset + 3] >> 5}`
    if (key !== dominantKey) continue
    const distance = (pixels.data[offset] - target[0]) ** 2 + (pixels.data[offset + 1] - target[1]) ** 2 + (pixels.data[offset + 2] - target[2]) ** 2 + (pixels.data[offset + 3] - target[3]) ** 2
    if (distance < bestDistance) { bestOffset = offset; bestDistance = distance }
  }
  return [pixels.data[bestOffset], pixels.data[bestOffset + 1], pixels.data[bestOffset + 2], pixels.data[bestOffset + 3]]
}

function sampleByMode(
  request: ProcessRequest,
  bounds: SampleBounds,
  mode: SamplingMode,
): [number, number, number, number] {
  if (mode === 'nearest') return nearestSample(request, bounds)
  const pixels = collectPixels(request, bounds)
  if (mode === 'median') return medianSample(pixels)
  if (mode === 'dominant') return dominantSample(pixels)
  return averageSample(pixels)
}

export function sampleImage(request: ProcessRequest): Uint8ClampedArray {
  const { width, height } = request.output
  const output = new Uint8ClampedArray(width * height * 4)
  const threshold = request.processing.transparentThreshold

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const bounds = boundsForCell(request, x, y)
      const pixel = sampleByMode(request, bounds, request.processing.sampling)
      const offset = (y * width + x) * 4
      const alpha = request.processing.preserveAlpha && pixel[3] < threshold ? 0 : 255
      output[offset] = alpha === 0 ? 0 : pixel[0]
      output[offset + 1] = alpha === 0 ? 0 : pixel[1]
      output[offset + 2] = alpha === 0 ? 0 : pixel[2]
      output[offset + 3] = alpha
    }
  }
  return output
}
