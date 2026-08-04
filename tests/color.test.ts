import { describe, expect, it } from 'vitest'
import { rgbToHsl } from '@/core/color'

describe('color conversion', () => {
  it('converts primary colors to standard HSL hue angles', () => {
    expect(rgbToHsl(255, 0, 0).hue).toBe(0)
    expect(rgbToHsl(0, 255, 0).hue).toBe(120)
    expect(rgbToHsl(0, 0, 255).hue).toBe(240)
  })

  it('treats gray colors as achromatic', () => {
    const gray = rgbToHsl(128, 128, 128)
    expect(gray.saturation).toBe(0)
    expect(gray.lightness).toBeCloseTo(128 / 255)
  })
})
