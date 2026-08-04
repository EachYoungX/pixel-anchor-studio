import type { ProcessRequest, SamplingMode } from '@/types/project'

interface CellBounds {
  xStarts: Int32Array
  xEnds: Int32Array
  yStarts: Int32Array
  yEnds: Int32Array
  rawXStarts: Float64Array
  rawXEnds: Float64Array
  rawYStarts: Float64Array
  rawYEnds: Float64Array
}

interface MedianWorkspace {
  r: Uint32Array
  g: Uint32Array
  b: Uint32Array
  a: Uint32Array
}

interface SampleContext {
  request: ProcessRequest
  bounds: CellBounds
  workspace: MedianWorkspace
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function pixelOffset(width: number, x: number, y: number): number {
  return (y * width + x) * 4
}

function createMedianWorkspace(): MedianWorkspace {
  return {
    r: new Uint32Array(256),
    g: new Uint32Array(256),
    b: new Uint32Array(256),
    a: new Uint32Array(256),
  }
}

export function buildCellBounds(request: ProcessRequest): CellBounds {
  const { crop, output, scaleOffset, source } = request
  const cellSize = request.grid?.cellSize ?? Math.max(crop.width / output.width, crop.height / output.height)
  const originX = request.grid?.originX ?? crop.x + scaleOffset.x * cellSize
  const originY = request.grid?.originY ?? crop.y + scaleOffset.y * cellSize
  const cropRight = Math.min(source.width, crop.x + crop.width)
  const cropBottom = Math.min(source.height, crop.y + crop.height)
  const rawXStarts = new Float64Array(output.width)
  const rawXEnds = new Float64Array(output.width)
  const rawYStarts = new Float64Array(output.height)
  const rawYEnds = new Float64Array(output.height)
  const xStarts = new Int32Array(output.width)
  const xEnds = new Int32Array(output.width)
  const yStarts = new Int32Array(output.height)
  const yEnds = new Int32Array(output.height)

  for (let x = 0; x < output.width; x += 1) {
    const start = clamp(originX + x * cellSize, crop.x, cropRight)
    const end = clamp(originX + (x + 1) * cellSize, crop.x, cropRight)
    rawXStarts[x] = start
    rawXEnds[x] = end
    const startInt = clamp(Math.floor(start), 0, source.width - 1)
    const endInt = clamp(Math.max(startInt + 1, Math.ceil(end)), 1, source.width)
    xStarts[x] = startInt
    xEnds[x] = endInt
  }
  for (let y = 0; y < output.height; y += 1) {
    const start = clamp(originY + y * cellSize, crop.y, cropBottom)
    const end = clamp(originY + (y + 1) * cellSize, crop.y, cropBottom)
    rawYStarts[y] = start
    rawYEnds[y] = end
    const startInt = clamp(Math.floor(start), 0, source.height - 1)
    const endInt = clamp(Math.max(startInt + 1, Math.ceil(end)), 1, source.height)
    yStarts[y] = startInt
    yEnds[y] = endInt
  }

  return { xStarts, xEnds, yStarts, yEnds, rawXStarts, rawXEnds, rawYStarts, rawYEnds }
}

function nearestSample(context: SampleContext, x: number, y: number): [number, number, number, number] {
  const { request, bounds } = context
  const sourceX = clamp(Math.floor((bounds.rawXStarts[x] + bounds.rawXEnds[x]) / 2), 0, request.source.width - 1)
  const sourceY = clamp(Math.floor((bounds.rawYStarts[y] + bounds.rawYEnds[y]) / 2), 0, request.source.height - 1)
  const offset = pixelOffset(request.source.width, sourceX, sourceY)
  const data = request.source.data
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
}

function medianValue(histogram: Uint32Array, middle: number): number {
  let accumulated = 0
  for (let value = 0; value < 256; value += 1) {
    accumulated += histogram[value]
    if (accumulated > middle) return value
  }
  return 255
}

function medianSample(context: SampleContext, x: number, y: number): [number, number, number, number] {
  const { request, bounds, workspace } = context
  const x0 = bounds.xStarts[x]
  const x1 = bounds.xEnds[x]
  const y0 = bounds.yStarts[y]
  const y1 = bounds.yEnds[y]
  workspace.r.fill(0)
  workspace.g.fill(0)
  workspace.b.fill(0)
  workspace.a.fill(0)
  let count = 0
  for (let sourceY = y0; sourceY < y1; sourceY += 1) {
    let offset = pixelOffset(request.source.width, x0, sourceY)
    for (let sourceX = x0; sourceX < x1; sourceX += 1) {
      workspace.r[request.source.data[offset]] += 1
      workspace.g[request.source.data[offset + 1]] += 1
      workspace.b[request.source.data[offset + 2]] += 1
      workspace.a[request.source.data[offset + 3]] += 1
      count += 1
      offset += 4
    }
  }
  if (count === 0) return [0, 0, 0, 0]
  const middle = Math.floor(count / 2)
  const median: [number, number, number, number] = [
    medianValue(workspace.r, middle),
    medianValue(workspace.g, middle),
    medianValue(workspace.b, middle),
    medianValue(workspace.a, middle),
  ]
  let best: [number, number, number, number] = [0, 0, 0, 0]
  let bestDistance = Infinity
  for (let sourceY = y0; sourceY < y1; sourceY += 1) {
    let offset = pixelOffset(request.source.width, x0, sourceY)
    for (let sourceX = x0; sourceX < x1; sourceX += 1) {
      const data = request.source.data
      const distance = (data[offset] - median[0]) ** 2 + (data[offset + 1] - median[1]) ** 2 + (data[offset + 2] - median[2]) ** 2 + (data[offset + 3] - median[3]) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        best = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
      }
      offset += 4
    }
  }
  return best
}

function averageSample(context: SampleContext, x: number, y: number): [number, number, number, number] {
  const { request, bounds } = context
  const x0 = bounds.xStarts[x]
  const x1 = bounds.xEnds[x]
  const y0 = bounds.yStarts[y]
  const y1 = bounds.yEnds[y]
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  let alphaWeight = 0
  let count = 0
  for (let sourceY = y0; sourceY < y1; sourceY += 1) {
    let offset = pixelOffset(request.source.width, x0, sourceY)
    for (let sourceX = x0; sourceX < x1; sourceX += 1) {
      const data = request.source.data
      const alpha = data[offset + 3] / 255
      r += data[offset] * alpha
      g += data[offset + 1] * alpha
      b += data[offset + 2] * alpha
      a += data[offset + 3]
      alphaWeight += alpha
      count += 1
      offset += 4
    }
  }
  if (count === 0 || alphaWeight <= 0) return [0, 0, 0, 0]
  return [Math.round(r / alphaWeight), Math.round(g / alphaWeight), Math.round(b / alphaWeight), Math.round(a / count)]
}

function packSampleBucket(r: number, g: number, b: number, a: number): number {
  return ((r >> 4) << 11) | ((g >> 4) << 7) | ((b >> 4) << 3) | (a >> 5)
}

function dominantSample(context: SampleContext, x: number, y: number): [number, number, number, number] {
  const { request, bounds } = context
  const x0 = bounds.xStarts[x]
  const x1 = bounds.xEnds[x]
  const y0 = bounds.yStarts[y]
  const y1 = bounds.yEnds[y]
  const buckets = new Map<number, { count: number; r: number; g: number; b: number; a: number }>()
  let dominantKey = 0
  let dominant: { count: number; r: number; g: number; b: number; a: number } | undefined
  for (let sourceY = y0; sourceY < y1; sourceY += 1) {
    let offset = pixelOffset(request.source.width, x0, sourceY)
    for (let sourceX = x0; sourceX < x1; sourceX += 1) {
      const data = request.source.data
      const key = packSampleBucket(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, a: 0 }
      bucket.count += 1
      bucket.r += data[offset]
      bucket.g += data[offset + 1]
      bucket.b += data[offset + 2]
      bucket.a += data[offset + 3]
      buckets.set(key, bucket)
      if (!dominant || bucket.count > dominant.count) {
        dominantKey = key
        dominant = bucket
      }
      offset += 4
    }
  }
  if (!dominant) return [0, 0, 0, 0]
  const target = [dominant.r / dominant.count, dominant.g / dominant.count, dominant.b / dominant.count, dominant.a / dominant.count]
  let best: [number, number, number, number] = [0, 0, 0, 0]
  let bestDistance = Infinity
  for (let sourceY = y0; sourceY < y1; sourceY += 1) {
    let offset = pixelOffset(request.source.width, x0, sourceY)
    for (let sourceX = x0; sourceX < x1; sourceX += 1) {
      const data = request.source.data
      if (packSampleBucket(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]) === dominantKey) {
        const distance = (data[offset] - target[0]) ** 2 + (data[offset + 1] - target[1]) ** 2 + (data[offset + 2] - target[2]) ** 2 + (data[offset + 3] - target[3]) ** 2
        if (distance < bestDistance) {
          bestDistance = distance
          best = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
        }
      }
      offset += 4
    }
  }
  return best
}

function sampleByMode(context: SampleContext, x: number, y: number, mode: SamplingMode): [number, number, number, number] {
  if (mode === 'nearest') return nearestSample(context, x, y)
  if (mode === 'median') return medianSample(context, x, y)
  if (mode === 'dominant') return dominantSample(context, x, y)
  return averageSample(context, x, y)
}

export function sampleImage(request: ProcessRequest): Uint8ClampedArray {
  const { width, height } = request.output
  const output = new Uint8ClampedArray(width * height * 4)
  const threshold = request.processing.transparentThreshold
  const context: SampleContext = { request, bounds: buildCellBounds(request), workspace: createMedianWorkspace() }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = sampleByMode(context, x, y, request.processing.sampling)
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
