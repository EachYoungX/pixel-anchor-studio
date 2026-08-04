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
})
