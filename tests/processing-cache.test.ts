import { describe, expect, it } from 'vitest'
import { createProcessingCaches, processImage } from '@/core/processing/process'
import type { ProcessRequest } from '@/types/project'

function request(overrides: Partial<ProcessRequest['processing']> = {}, grid = { cellSize: 2, originX: 0, originY: 0 }): ProcessRequest {
  return {
    sourceId: 'source-cache',
    source: {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        10, 20, 30, 255,
        40, 50, 60, 255,
        70, 80, 90, 255,
        100, 110, 120, 255,
      ]),
    },
    crop: { x: 0, y: 0, width: 2, height: 2 },
    output: { width: 1, height: 1 },
    grid,
    processing: {
      sampling: 'median',
      quantize: true,
      maxColors: 4,
      cleanup: 'off',
      preserveAlpha: true,
      transparentThreshold: 24,
      ...overrides,
    },
  }
}

describe('processing cache invalidation', () => {
  it('reuses only the layers unaffected by each setting change', () => {
    const caches = createProcessingCaches()
    processImage(request(), caches)
    expect(caches.sampling.size).toBe(1)
    expect(caches.quantized.size).toBe(1)
    expect(caches.final.size).toBe(1)

    processImage(request({ maxColors: 2 }), caches)
    expect(caches.sampling.size).toBe(1)
    expect(caches.quantized.size).toBe(2)
    expect(caches.final.size).toBe(2)

    processImage(request({ maxColors: 2, cleanup: 'light' }), caches)
    expect(caches.sampling.size).toBe(1)
    expect(caches.quantized.size).toBe(2)
    expect(caches.final.size).toBe(3)

    processImage(request({ maxColors: 2, cleanup: 'light' }, { cellSize: 2, originX: 1, originY: 0 }), caches)
    expect(caches.sampling.size).toBe(2)
    expect(caches.quantized.size).toBe(3)
    expect(caches.final.size).toBe(4)
  })
})
