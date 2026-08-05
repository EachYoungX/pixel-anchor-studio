import { bench, describe } from 'vitest'
import { processImage } from '@/core/processing/process'
import { sampleImage } from '@/core/processing/sampling'
import { cleanupSmallRegions } from '@/core/processing/cleanup'
import { mergeSimilarColors } from '@/core/processing/palette-merge'
import { EditorSession } from '@/domain/editor/editor-session'
import { setPixelRgba } from '@/domain/editor/pixel-operations'
import type { ProcessRequest, PixelResult, SamplingMode } from '@/types/project'

const BENCH_OPTIONS = { time: 200 }

function createSource(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let offset = 0; offset < data.length; offset += 4) {
    const pixel = offset / 4
    data[offset] = pixel % 256
    data[offset + 1] = (pixel * 3) % 256
    data[offset + 2] = (pixel * 7) % 256
    data[offset + 3] = 255
  }
  return data
}

function request(
  source: { width: number; height: number; data: Uint8ClampedArray },
  output: { width: number; height: number },
  sampling: SamplingMode,
): ProcessRequest {
  return {
    source,
    crop: { x: 0, y: 0, width: source.width, height: source.height },
    output,
    grid: { cellSize: Math.max(source.width / output.width, source.height / output.height), originX: 0, originY: 0 },
    scaleOffset: { x: 0, y: 0 },
    processing: { sampling, quantize: false, maxColors: 64, cleanup: 'off', preserveAlpha: true, transparentThreshold: 24 },
  }
}

const mediumSource = { width: 256, height: 256, data: createSource(256, 256) }
const largeSource = { width: 4000, height: 5000, data: createSource(4000, 5000) }
const cleanupInput = createSource(256, 256)
const mergeInput: PixelResult = { width: 256, height: 256, data: createSource(256, 256) }

describe('processing pipeline', () => {
  bench('256 × 256 source to 64 × 64 complete processing', () => {
    processImage({ ...request(mediumSource, { width: 64, height: 64 }, 'median'), processing: { ...request(mediumSource, { width: 64, height: 64 }, 'median').processing, quantize: true } })
  }, BENCH_OPTIONS)

  bench('4000 × 5000 source to 32 × 40 median sampling', () => {
    sampleImage(request(largeSource, { width: 32, height: 40 }, 'median'))
  }, BENCH_OPTIONS)

  bench('4000 × 5000 source to 144 × 180 median sampling', () => {
    sampleImage(request(largeSource, { width: 144, height: 180 }, 'median'))
  }, BENCH_OPTIONS)

  bench('4000 × 5000 source to 205 × 256 dominant sampling', () => {
    sampleImage(request(largeSource, { width: 205, height: 256 }, 'dominant'))
  }, BENCH_OPTIONS)
})

describe('editor and color processing', () => {
  bench('256 × 256 result with a 100-event brush stroke', () => {
    const result: PixelResult = { width: 256, height: 256, data: new Uint8ClampedArray(mergeInput.data) }
    const session = new EditorSession()
    session.begin(result, '画笔')
    for (let index = 0; index < 100; index += 1) {
      const x = index % result.width
      const y = Math.floor(index / result.width)
      if (setPixelRgba(result, x, y, [255, 0, 255, 255])) session.recordChange(x, y)
    }
    session.end()
  }, BENCH_OPTIONS)

  bench('256 × 256 strong small-region cleanup', () => {
    cleanupSmallRegions(cleanupInput, 256, 256, 'strong')
  }, BENCH_OPTIONS)

  bench('256 × 256 64-color automatic merge', () => {
    mergeSimilarColors(mergeInput, 'balanced')
  }, BENCH_OPTIONS)
})
