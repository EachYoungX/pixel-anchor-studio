import { describe, expect, it } from 'vitest'
import { floodFillRgba, readPixelHex } from '@/domain/editor/pixel-operations'
import type { PixelResult } from '@/types/project'

describe('pixel operations', () => {
  it('fills one connected region with a fixed-size queue', () => {
    const result: PixelResult = {
      width: 3,
      height: 2,
      data: new Uint8ClampedArray([
        1, 2, 3, 255, 1, 2, 3, 255, 9, 9, 9, 255,
        1, 2, 3, 255, 9, 9, 9, 255, 9, 9, 9, 255,
      ]),
    }
    expect(floodFillRgba(result, 0, 0, [7, 8, 9, 255])).toBe(true)
    expect(readPixelHex(result, 0, 1)).toBe('#070809')
    expect(readPixelHex(result, 2, 0)).toBe('#090909')
  })
})
