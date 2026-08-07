import { describe, expect, it } from 'vitest'
import { isPngExportSizeAllowed, normalizePngScale, pngExportDimensions } from '@/core/export/png-scale'

describe('PNG export scale limits', () => {
  it('accepts custom scales through 32', () => {
    expect(normalizePngScale(32)).toBe(32)
    expect(pngExportDimensions(32, 21, 32)).toEqual({ width: 1024, height: 672 })
  })

  it('caps the scale input and rejects output edges above 2048', () => {
    expect(normalizePngScale(99)).toBe(32)
    expect(isPngExportSizeAllowed(256, 200, 8)).toBe(true)
    expect(isPngExportSizeAllowed(256, 200, 9)).toBe(false)
  })
})
