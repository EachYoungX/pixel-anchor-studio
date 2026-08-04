import { describe, expect, it } from 'vitest'
import { medianCutPalette, quantizeImage } from '@/core/processing/quantization'

function uniqueColors(data: Uint8ClampedArray): number {
  const colors = new Set<string>()
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue
    colors.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`)
  }
  return colors.size
}

describe('median cut quantization', () => {
  it('does not exceed the requested palette size', () => {
    const data = new Uint8ClampedArray(32 * 4)
    for (let index = 0; index < 32; index += 1) {
      const offset = index * 4
      data[offset] = index * 7
      data[offset + 1] = 255 - index * 5
      data[offset + 2] = index * 3
      data[offset + 3] = 255
    }
    expect(medianCutPalette(data, 8).length).toBeLessThanOrEqual(8)
    expect(uniqueColors(quantizeImage(data, 8))).toBeLessThanOrEqual(8)
  })

  it('keeps transparent pixels transparent', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0])
    const output = quantizeImage(data, 2)
    expect(output[7]).toBe(0)
  })
})
