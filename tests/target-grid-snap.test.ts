import { describe, expect, it } from 'vitest'
import { calculateOutputDimensions } from '@/core/dimensions'
import { defaultScale } from '@/domain/project/defaults'
import { snapSourceRectToGrid } from '@/domain/source/crop-service'

describe('target grid snapping', () => {
  it('uses the same square geometry for anchor sizes from 1 × 1 through 5 × 5', () => {
    const crop = { x: 17, y: 29, width: 4000, height: 5133 }
    const anchor = { x: 300, y: 400, width: 240, height: 240 }

    for (const anchorCells of [1, 2, 3, 4, 5]) {
      const output = calculateOutputDimensions(crop, anchor, {
        ...defaultScale(),
        mode: 'anchor',
        anchorCells,
      })
      const geometry = output.geometry
      const snapped = snapSourceRectToGrid(
        { x: 412.4, y: 683.8, width: 377.1, height: 377.1 },
        geometry.cellSize,
        geometry.originX,
        geometry.originY,
      )

      expect((snapped.x - geometry.originX) / geometry.cellSize).toBeCloseTo(Math.round((snapped.x - geometry.originX) / geometry.cellSize))
      expect((snapped.y - geometry.originY) / geometry.cellSize).toBeCloseTo(Math.round((snapped.y - geometry.originY) / geometry.cellSize))
      expect(snapped.width / geometry.cellSize).toBeCloseTo(Math.round(snapped.width / geometry.cellSize))
      expect(snapped.height).toBeCloseTo(snapped.width)
    }
  })

  it('uses one step for a tall crop whose dimensions do not divide evenly', () => {
    const crop = { x: 0, y: 0, width: 4000, height: 7000 }
    const output = calculateOutputDimensions(crop, { x: 0, y: 0, width: 180, height: 180 }, {
      ...defaultScale(),
      mode: 'anchor',
      anchorCells: 3,
    })
    const snapped = snapSourceRectToGrid({ x: 91, y: 121, width: 181, height: 239 }, output.geometry.cellSize, output.geometry.originX, output.geometry.originY)

    expect(snapped.width / output.geometry.cellSize).toBeCloseTo(Math.round(snapped.width / output.geometry.cellSize))
    expect(snapped.height / output.geometry.cellSize).toBeCloseTo(Math.round(snapped.height / output.geometry.cellSize))
  })
})
