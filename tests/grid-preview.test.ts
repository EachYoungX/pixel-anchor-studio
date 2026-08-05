import { describe, expect, it } from 'vitest'
import { calculateGridPreviewBounds, calculateGridPreviewStride, gridPreviewIndices } from '@/core/grid-preview'

describe('grid preview geometry', () => {
  it('uses one stride on both axes and always includes the final boundary', () => {
    const stride = calculateGridPreviewStride(51, 65, 8)
    const horizontalIndices = gridPreviewIndices(51, stride)
    const verticalIndices = gridPreviewIndices(65, stride)
    expect(stride).toBe(2)
    expect(horizontalIndices[1] - horizontalIndices[0]).toBe(verticalIndices[1] - verticalIndices[0])
    expect(horizontalIndices.at(-1)).toBe(51)
    expect(verticalIndices.at(-1)).toBe(65)
  })

  it('maps only the actual grid coverage into screen coordinates', () => {
    const bounds = calculateGridPreviewBounds({
      outputWidth: 3,
      outputHeight: 2,
      cellSize: 10,
      originX: 5,
      originY: 7,
      coverageWidth: 30,
      coverageHeight: 20,
      remainderX: 2,
      remainderY: 4,
      adjustedByLimit: false,
    }, 2, 100, 50)
    expect(bounds).toEqual({ left: 110, top: 64, right: 170, bottom: 104 })
  })
})
