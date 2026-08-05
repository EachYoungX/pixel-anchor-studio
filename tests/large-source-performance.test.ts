import { describe, expect, it } from 'vitest'
import { createGridGeometry } from '@/core/grid-geometry'
import { sampleImage } from '@/core/processing/sampling'

describe('large source sampling', () => {
  it('samples a 4000 × 7000 source with the shared grid geometry', { timeout: 30_000 }, () => {
    const sourceWidth = 4000
    const sourceHeight = 7000
    const geometry = createGridGeometry({ x: 0, y: 0, width: sourceWidth, height: sourceHeight }, sourceHeight / 64)
    const result = sampleImage({
      source: { width: sourceWidth, height: sourceHeight, data: new Uint8ClampedArray(sourceWidth * sourceHeight * 4) },
      crop: { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
      output: { width: geometry.outputWidth, height: geometry.outputHeight },
      grid: { cellSize: geometry.cellSize, originX: geometry.originX, originY: geometry.originY },
      processing: { sampling: 'average', quantize: false, maxColors: 64, cleanup: 'off', preserveAlpha: true, transparentThreshold: 24 },
    })

    expect(result.length).toBe(geometry.outputWidth * geometry.outputHeight * 4)
  })
})
