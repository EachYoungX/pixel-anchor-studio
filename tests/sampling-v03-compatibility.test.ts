import { describe, expect, it } from 'vitest'
import { sampleImage } from '@/core/processing/sampling'
import type { ProcessRequest, SamplingMode } from '@/types/project'

type Rgba = [number, number, number, number]
type Bounds = { x0: number; y0: number; x1: number; y1: number }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function legacyBounds(request: ProcessRequest, x: number, y: number): Bounds {
  const cellSize = request.grid?.cellSize ?? Math.max(request.crop.width / request.output.width, request.crop.height / request.output.height)
  const originX = request.grid?.originX ?? request.crop.x + request.scaleOffset.x * cellSize
  const originY = request.grid?.originY ?? request.crop.y + request.scaleOffset.y * cellSize
  return {
    x0: clamp(originX + x * cellSize, request.crop.x, Math.min(request.source.width, request.crop.x + request.crop.width)),
    y0: clamp(originY + y * cellSize, request.crop.y, Math.min(request.source.height, request.crop.y + request.crop.height)),
    x1: clamp(originX + (x + 1) * cellSize, request.crop.x, Math.min(request.source.width, request.crop.x + request.crop.width)),
    y1: clamp(originY + (y + 1) * cellSize, request.crop.y, Math.min(request.source.height, request.crop.y + request.crop.height)),
  }
}

function legacyPixels(request: ProcessRequest, bounds: Bounds): Rgba[] {
  const x0 = clamp(Math.floor(bounds.x0), 0, request.source.width - 1)
  const y0 = clamp(Math.floor(bounds.y0), 0, request.source.height - 1)
  const x1 = clamp(Math.max(x0 + 1, Math.ceil(bounds.x1)), 1, request.source.width)
  const y1 = clamp(Math.max(y0 + 1, Math.ceil(bounds.y1)), 1, request.source.height)
  const pixels: Rgba[] = []
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * request.source.width + x) * 4
      pixels.push([
        request.source.data[offset], request.source.data[offset + 1],
        request.source.data[offset + 2], request.source.data[offset + 3],
      ])
    }
  }
  return pixels
}

function legacySample(request: ProcessRequest, bounds: Bounds, mode: SamplingMode): Rgba {
  if (mode === 'nearest') {
    const x = clamp(Math.floor((bounds.x0 + bounds.x1) / 2), 0, request.source.width - 1)
    const y = clamp(Math.floor((bounds.y0 + bounds.y1) / 2), 0, request.source.height - 1)
    const offset = (y * request.source.width + x) * 4
    return [request.source.data[offset], request.source.data[offset + 1], request.source.data[offset + 2], request.source.data[offset + 3]]
  }
  const pixels = legacyPixels(request, bounds)
  if (mode === 'average') {
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
    return [Math.round(sums[0] / alphaWeight), Math.round(sums[1] / alphaWeight), Math.round(sums[2] / alphaWeight), Math.round(sums[3] / pixels.length)]
  }
  if (mode === 'median') {
    const histograms = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
    for (const pixel of pixels) for (let channel = 0; channel < 4; channel += 1) histograms[channel][pixel[channel]] += 1
    const middle = Math.floor(pixels.length / 2)
    const median = histograms.map((histogram) => {
      let count = 0
      for (let value = 0; value < 256; value += 1) {
        count += histogram[value]
        if (count > middle) return value
      }
      return 255
    })
    return pixels.reduce((best, pixel) => {
      const distance = pixel.reduce((sum, value, channel) => sum + (value - median[channel]) ** 2, 0)
      return distance < best.distance ? { pixel, distance } : best
    }, { pixel: pixels[0], distance: Infinity }).pixel
  }
  const buckets = new Map<string, { count: number; sums: number[] }>()
  for (const pixel of pixels) {
    const key = `${pixel[0] >> 4},${pixel[1] >> 4},${pixel[2] >> 4},${pixel[3] >> 5}`
    const bucket = buckets.get(key) ?? { count: 0, sums: [0, 0, 0, 0] }
    bucket.count += 1
    for (let channel = 0; channel < 4; channel += 1) bucket.sums[channel] += pixel[channel]
    buckets.set(key, bucket)
  }
  let dominantKey = ''
  let dominant = { count: -1, sums: [0, 0, 0, 0] }
  for (const [key, bucket] of buckets) if (bucket.count > dominant.count) { dominantKey = key; dominant = bucket }
  const target = dominant.sums.map((sum) => sum / dominant.count)
  let best = pixels[0]
  let bestDistance = Infinity
  for (const pixel of pixels) {
    const key = `${pixel[0] >> 4},${pixel[1] >> 4},${pixel[2] >> 4},${pixel[3] >> 5}`
    if (key !== dominantKey) continue
    const distance = pixel.reduce((sum, value, channel) => sum + (value - target[channel]) ** 2, 0)
    if (distance < bestDistance) { best = pixel; bestDistance = distance }
  }
  return best
}

function legacySampleImage(request: ProcessRequest): Uint8ClampedArray {
  const output = new Uint8ClampedArray(request.output.width * request.output.height * 4)
  for (let y = 0; y < request.output.height; y += 1) {
    for (let x = 0; x < request.output.width; x += 1) {
      const pixel = legacySample(request, legacyBounds(request, x, y), request.processing.sampling)
      const offset = (y * request.output.width + x) * 4
      const alpha = request.processing.preserveAlpha && pixel[3] < request.processing.transparentThreshold ? 0 : 255
      output.set(alpha === 0 ? [0, 0, 0, 0] : [pixel[0], pixel[1], pixel[2], 255], offset)
    }
  }
  return output
}

function makeRequest(
  width: number,
  height: number,
  pixel: (x: number, y: number) => Rgba,
  geometry: Pick<ProcessRequest, 'crop' | 'output' | 'grid'>,
): ProcessRequest {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set(pixel(x, y), (y * width + x) * 4)
  return {
    source: { width, height, data }, ...geometry, scaleOffset: { x: 0, y: 0 },
    processing: { sampling: 'median', quantize: false, maxColors: 64, cleanup: 'off', preserveAlpha: true, transparentThreshold: 24 },
  }
}

const scenarios = [
  ['photo', makeRequest(12, 8, (x, y) => [x * 17, y * 27, (x * 11 + y * 19) % 256, 255], { crop: { x: 0, y: 0, width: 12, height: 8 }, output: { width: 3, height: 2 }, grid: { cellSize: 4, originX: 0, originY: 0 } })],
  ['anime', makeRequest(8, 8, (x, y) => x < 4 ? (y < 4 ? [245, 205, 190, 255] : [35, 45, 80, 255]) : (y < 4 ? [220, 80, 100, 255] : [250, 245, 220, 255]), { crop: { x: 0, y: 0, width: 8, height: 8 }, output: { width: 4, height: 4 }, grid: { cellSize: 2, originX: 0, originY: 0 } })],
  ['building', makeRequest(9, 9, (x, y) => [(x % 3) * 80, (y % 3) * 70, (x + y) % 2 ? 210 : 40, 255], { crop: { x: 0, y: 0, width: 9, height: 9 }, output: { width: 3, height: 3 }, grid: { cellSize: 3, originX: 0, originY: 0 } })],
  ['transparent', makeRequest(6, 6, (x, y) => [x * 35, y * 35, 150, (x + y) % 3 === 0 ? 0 : 255], { crop: { x: 0, y: 0, width: 6, height: 6 }, output: { width: 3, height: 3 }, grid: { cellSize: 2, originX: 0, originY: 0 } })],
  ['pseudo-pixel', makeRequest(8, 8, (x, y) => [Math.floor(x / 2) * 60, Math.floor(y / 2) * 60, 180, 255], { crop: { x: 0, y: 0, width: 8, height: 8 }, output: { width: 4, height: 4 }, grid: { cellSize: 2, originX: 0, originY: 0 } })],
  ['narrow-crop', makeRequest(10, 8, (x, y) => [x * 20, y * 25, 90, 255], { crop: { x: 4.2, y: 0.3, width: 1.3, height: 7.2 }, output: { width: 1, height: 4 }, grid: { cellSize: 1.8, originX: 4.2, originY: 0.3 } })],
  ['phase-offset', makeRequest(10, 10, (x, y) => [x * 20, y * 20, (x * y * 7) % 256, 255], { crop: { x: 1, y: 1, width: 8, height: 8 }, output: { width: 3, height: 3 }, grid: { cellSize: 2.5, originX: 1.4, originY: 1.7 } })],
] as const

describe('v0.3 sampling compatibility matrix', () => {
  for (const [name, baseRequest] of scenarios) {
    it(`${name} remains byte-identical in all four sampling modes`, () => {
      for (const mode of ['average', 'median', 'dominant', 'nearest'] as SamplingMode[]) {
        const request = { ...baseRequest, processing: { ...baseRequest.processing, sampling: mode } }
        expect(sampleImage(request)).toEqual(legacySampleImage(request))
      }
    })
  }
})
