import { bench, describe } from 'vitest'
import { processImage } from '@/core/processing/process'
import type { ProcessRequest } from '@/types/project'

function createRequest(): ProcessRequest {
  const width = 256
  const height = 256
  const data = new Uint8ClampedArray(width * height * 4)
  for (let offset = 0; offset < data.length; offset += 4) {
    const pixel = offset / 4
    data[offset] = pixel % 256
    data[offset + 1] = (pixel * 3) % 256
    data[offset + 2] = (pixel * 7) % 256
    data[offset + 3] = 255
  }
  return {
    source: { width, height, data },
    crop: { x: 0, y: 0, width, height },
    output: { width: 64, height: 64 },
    grid: { cellSize: 4, originX: 0, originY: 0 },
    scaleOffset: { x: 0, y: 0 },
    processing: { sampling: 'median', quantize: true, maxColors: 64, cleanup: 'off', preserveAlpha: true, transparentThreshold: 24 },
  }
}

describe('processing', () => {
  bench('256 × 256 source to 64 × 64 median result', () => {
    processImage(createRequest())
  })
})
