import { describe, expect, it } from 'vitest'
import { cleanupSmallRegions } from '@/core/processing/cleanup'

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, rgba: number[]): void {
  data.set(rgba, (y * width + x) * 4)
}

describe('small region cleanup', () => {
  it('replaces a single isolated pixel', () => {
    const width = 3
    const height = 3
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) setPixel(data, width, x, y, [20, 20, 20, 255])
    }
    setPixel(data, width, 1, 1, [240, 240, 240, 255])
    const output = cleanupSmallRegions(data, width, height, 'light')
    expect([...output.slice(16, 20)]).toEqual([20, 20, 20, 255])
  })
})
