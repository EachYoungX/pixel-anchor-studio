import { describe, expect, it } from 'vitest'
import { createPaletteSnapshot, replacePaletteColor } from '@/domain/palette/palette-service'
import type { PixelResult } from '@/types/project'

function result(): PixelResult {
  return {
    width: 3,
    height: 1,
    data: new Uint8ClampedArray([
      255, 0, 0, 255,
      255, 0, 0, 255,
      0, 0, 255, 255,
    ]),
  }
}

describe('palette service', () => {
  it('builds, sorts, and stabilizes the selected color independently of the store', () => {
    const snapshot = createPaletteSnapshot(result(), {}, 'count-desc', '#00FF00')
    expect(snapshot.entries.map((entry) => entry.hex)).toEqual(['#FF0000', '#0000FF'])
    expect(snapshot.selectedColor).toBe('#FF0000')
  })

  it('replaces a palette color in the logical result', () => {
    const value = result()
    expect(replacePaletteColor(value, '#FF0000', '#00FF00')).toBe(true)
    expect([...value.data.slice(0, 8)]).toEqual([0, 255, 0, 255, 0, 255, 0, 255])
  })
})
