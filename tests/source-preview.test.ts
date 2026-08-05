import { describe, expect, it } from 'vitest'
import { calculatePreviewSize } from '@/runtime/source-preview'

describe('source preview sizing', () => {
  it('keeps small sources and bounds large sources without changing aspect ratio', () => {
    expect(calculatePreviewSize(1200, 800)).toEqual({ width: 1200, height: 800 })
    expect(calculatePreviewSize(4000, 5000)).toEqual({ width: 1638, height: 2048 })
    expect(calculatePreviewSize(5000, 4000, 3072)).toEqual({ width: 3072, height: 2458 })
  })
})
