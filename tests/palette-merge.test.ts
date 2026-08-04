import { describe, expect, it } from 'vitest'
import { mergeSimilarColors } from '@/core/processing/palette-merge'
import type { PixelResult } from '@/types/project'

function result(values: number[]): PixelResult {
  return { width: values.length / 4, height: 1, data: new Uint8ClampedArray(values) }
}

describe('palette merge', () => {
  it('merges a small adjacent color into a larger nearby color', () => {
    const merged = mergeSimilarColors(result([100, 100, 100, 255, 105, 105, 105, 255, 100, 100, 100, 255]), 'conservative')
    expect(merged.before).toBe(2)
    expect(merged.after).toBe(1)
    expect([...merged.result.data]).toEqual([100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255])
  })
})
