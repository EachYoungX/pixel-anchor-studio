import { describe, expect, it } from 'vitest'
import fixture from './fixtures/sampling-golden.json'
import { sampleImage } from '@/core/processing/sampling'
import type { ProcessRequest, SamplingMode } from '@/types/project'

describe('sampling golden fixture', () => {
  for (const mode of ['average', 'median', 'dominant', 'nearest'] as SamplingMode[]) {
    it(`keeps the v0.4 output for ${mode}`, () => {
      const request: ProcessRequest = {
        source: { width: fixture.source.width, height: fixture.source.height, data: new Uint8ClampedArray(fixture.source.data) },
        crop: fixture.crop,
        output: fixture.output,
        grid: fixture.grid,
        scaleOffset: { x: 0, y: 0 },
        processing: { sampling: mode, quantize: false, maxColors: 64, cleanup: 'off', preserveAlpha: true, transparentThreshold: 24 },
      }
      expect([...sampleImage(request)]).toEqual(fixture.expected[mode])
    })
  }
})
