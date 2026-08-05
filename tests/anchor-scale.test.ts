import { describe, expect, it } from 'vitest'
import { calculateOutputDimensions } from '@/core/dimensions'
import { defaultScale } from '@/domain/project/defaults'

describe('feature anchor scale', () => {
  it('uses one square cell model for anchor sizes from 1 × 1 through 5 × 5', () => {
    const crop = { x: 0, y: 0, width: 4000, height: 5133 }
    const anchor = { x: 100, y: 100, width: 240, height: 240 }
    for (const anchorCells of [1, 2, 3, 4, 5]) {
      const settings = { ...defaultScale(), mode: 'anchor' as const, anchorCells }
      const output = calculateOutputDimensions(crop, anchor, settings)
      expect(output.geometry.cellSize).toBeCloseTo(240 / anchorCells)
      expect(output.geometry.coverageWidth).toBeCloseTo(output.width * output.geometry.cellSize)
      expect(output.geometry.coverageHeight).toBeCloseTo(output.height * output.geometry.cellSize)
    }
  })
})
