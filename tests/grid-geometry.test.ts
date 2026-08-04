import { describe, expect, it } from 'vitest'
import { createGridGeometry } from '@/core/grid-geometry'

describe('createGridGeometry', () => {
  it('uses square cells and centers remainder inside the crop', () => {
    const geometry = createGridGeometry({ x: 10, y: 20, width: 4000, height: 7000 }, 7000 / 64)

    expect(geometry.cellSize).toBe(7000 / 64)
    expect(geometry.outputWidth).toBe(36)
    expect(geometry.outputHeight).toBe(64)
    expect(geometry.coverageWidth).toBe(geometry.outputWidth * geometry.cellSize)
    expect(geometry.coverageHeight).toBe(geometry.outputHeight * geometry.cellSize)
    expect(geometry.originX).toBeCloseTo(10 + geometry.remainderX / 2)
    expect(geometry.originY).toBeCloseTo(20 + geometry.remainderY / 2)
  })

  it('increases the cell size when the output would exceed 256', () => {
    const geometry = createGridGeometry({ x: 0, y: 0, width: 4000, height: 7000 }, 1)

    expect(geometry.adjustedByLimit).toBe(true)
    expect(Math.max(geometry.outputWidth, geometry.outputHeight)).toBeLessThanOrEqual(256)
    expect(geometry.cellSize).toBe(7000 / 256)
  })
})
