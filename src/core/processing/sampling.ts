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
  const cellWidth = crop.width / output.width
  const cellHeight = crop.height / output.height
  const shiftedX = crop.x + (targetX + scaleOffset.x) * cellWidth
  const shiftedY = crop.y + (targetY + scaleOffset.y) * cellHeight

  return {
    x0: clamp(shiftedX, 0, source.width - 1),
    y0: clamp(shiftedY, 0, source.height - 1),
    x1: clamp(shiftedX + cellWidth, 0, source.width),
    y1: clamp(shiftedY + cellHeight, 0, source.height),
  }
}

function nearestSample(request: ProcessRequest, bounds: SampleBounds): [number, number, number, number] {
  const x = clamp(Math.floor((bounds.x0 + bounds.x1) / 2), 0, request.source.width - 1)
  const y = clamp(Math.floor((bounds.y0 + bounds.y1) / 2), 0, request.source.height - 1)
  const offset = pixelOffset(request.source.width, x, y)
  const data = request.source.data
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
}

function collectPixels(request: ProcessRequest, bounds: SampleBounds): number[][] {
  const x0 = clamp(Math.floor(bounds.x0), 0, request.source.width - 1)
  const y0 = clamp(Math.floor(bounds.y0), 0, request.source.height - 1)
  const x1 = clamp(Math.max(x0 + 1, Math.ceil(bounds.x1)), 1, request.source.width)
  const y1 = clamp(Math.max(y0 + 1, Math.ceil(bounds.y1)), 1, request.source.height)
  const pixels: number[][] = []
  const data = request.source.data

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = pixelOffset(request.source.width, x, y)
      pixels.push([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
    }
  }
  return pixels
}

function averageSample(pixels: number[][]): [number, number, number, number] {
  if (pixels.length === 0) return [0, 0, 0, 0]
  const sums = [0, 0, 0, 0]
  let alphaWeight = 0
  for (const pixel of pixels) {
    const alpha = pixel[3] / 255
    sums[0] += pixel[0] * alpha
    sums[1] += pixel[1] * alpha
    sums[2] += pixel[2] * alpha
    sums[3] += pixel[3]
    alphaWeight += alpha
  }
  if (alphaWeight <= 0) return [0, 0, 0, 0]
  return [
    Math.round(sums[0] / alphaWeight),
    Math.round(sums[1] / alphaWeight),
    Math.round(sums[2] / alphaWeight),
    Math.round(sums[3] / pixels.length),
  ]
}

function medianSample(pixels: number[][]): [number, number, number, number] {
  if (pixels.length === 0) return [0, 0, 0, 0]
  const histograms = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  for (const pixel of pixels) {
    for (let channel = 0; channel < 4; channel += 1) histograms[channel][pixel[channel]] += 1
  }
  const middle = Math.floor(pixels.length / 2)
  const median = histograms.map((histogram) => {
    let accumulated = 0
    for (let value = 0; value < 256; value += 1) {
      accumulated += histogram[value]
      if (accumulated > middle) return value
    }
    return 255
  })
  let best = pixels[0]
  let bestDistance = Infinity
  for (const pixel of pixels) {
    const distance = (pixel[0] - median[0]) ** 2 + (pixel[1] - median[1]) ** 2 + (pixel[2] - median[2]) ** 2 + (pixel[3] - median[3]) ** 2
    if (distance < bestDistance) {
      best = pixel
      bestDistance = distance
    }
  }
  return best as [number, number, number, number]
}

function dominantSample(pixels: number[][]): [number, number, number, number] {
  if (pixels.length === 0) return [0, 0, 0, 0]
  const buckets = new Map<string, { count: number; sum: number[] }>()
  for (const pixel of pixels) {
    const key = `${pixel[0] >> 4},${pixel[1] >> 4},${pixel[2] >> 4},${pixel[3] >> 5}`
    const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0, 0] }
    bucket.count += 1
    for (let channel = 0; channel < 4; channel += 1) bucket.sum[channel] += pixel[channel]
    buckets.set(key, bucket)
  }
  const dominantEntry = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count)[0]
  const dominantKey = dominantEntry[0]
  const dominant = dominantEntry[1]
  const target = dominant.sum.map((value) => value / dominant.count)
  let best = pixels[0]
  let bestDistance = Infinity
  for (const pixel of pixels) {
    const key = `${pixel[0] >> 4},${pixel[1] >> 4},${pixel[2] >> 4},${pixel[3] >> 5}`
    if (key !== dominantKey) continue
    const distance = (pixel[0] - target[0]) ** 2 + (pixel[1] - target[1]) ** 2 + (pixel[2] - target[2]) ** 2 + (pixel[3] - target[3]) ** 2
    if (distance < bestDistance) { best = pixel; bestDistance = distance }
  }
  return best as [number, number, number, number]
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
