import { describe, expect, it } from 'vitest'
import { sampleImage } from '@/core/processing/sampling'
import type { ProcessRequest } from '@/types/project'

function request(data: number[]): ProcessRequest {
  return {
    source: { width: 2, height: 1, data: new Uint8ClampedArray(data) },
    crop: { x: 0, y: 0, width: 2, height: 1 },
    output: { width: 1, height: 1 },
    scaleOffset: { x: 0, y: 0 },
    processing: { sampling: 'median', quantize: false, maxColors: 64, cleanup: 'off', preserveAlpha: true, transparentThreshold: 24 },
  }
}

describe('sampling', () => {
  it('returns a real pixel close to the channel median', () => {
    const output = sampleImage(request([10, 20, 30, 255, 200, 210, 220, 255]))
    expect([...output]).toEqual([200, 210, 220, 255])
  })

  it('keeps shifted cells inside the crop boundary', () => {
    const output = sampleImage({
      source: {
        width: 4,
        height: 1,
        data: new Uint8ClampedArray([
          10, 0, 0, 255,
          20, 0, 0, 255,
          30, 0, 0, 255,
          40, 0, 0, 255,
        ]),
      },
      crop: { x: 1, y: 0, width: 2, height: 1 },
      output: { width: 2, height: 1 },
      grid: { cellSize: 1, originX: 1, originY: 0 },
      scaleOffset: { x: 0, y: 0 },
      processing: { sampling: 'nearest', quantize: false, maxColors: 64, cleanup: 'off', preserveAlpha: true, transparentThreshold: 24 },
    })

    expect([...output]).toEqual([20, 0, 0, 255, 30, 0, 0, 255])
  })
})
