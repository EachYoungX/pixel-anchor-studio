import { describe, expect, it } from 'vitest'
import { centerSquareRect, clampSourceRect, fullSourceRect, snapSourceRect } from '@/domain/source/crop-service'

describe('source crop service', () => {
  it('provides normalized crop presets and bounds', () => {
    expect(fullSourceRect(12, 8)).toEqual({ x: 0, y: 0, width: 12, height: 8 })
    expect(centerSquareRect(12, 8)).toEqual({ x: 2, y: 0, width: 8, height: 8 })
    expect(snapSourceRect({ x: 1.4, y: 2.6, width: 3.2, height: 4.8 })).toEqual({ x: 1, y: 3, width: 3, height: 5 })
    expect(clampSourceRect({ x: -4, y: 9, width: 20, height: 2 }, 12, 8, 4)).toEqual({ x: 0, y: 4, width: 12, height: 4 })
  })
})
