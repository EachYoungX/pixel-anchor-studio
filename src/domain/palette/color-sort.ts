import { rgbToHsl } from '@/core/color'
import type { PaletteEntry, PaletteSortMode } from '@/types/project'

export function sortPaletteEntries(entries: readonly PaletteEntry[], mode: PaletteSortMode): PaletteEntry[] {
  return [...entries].sort((a, b) => {
    if (mode === 'code') return a.code.localeCompare(b.code)
    if (mode === 'lightness') return (a.rgba[0] + a.rgba[1] + a.rgba[2]) - (b.rgba[0] + b.rgba[1] + b.rgba[2])
    if (mode === 'hue') {
      const colorA = rgbToHsl(a.rgba[0], a.rgba[1], a.rgba[2])
      const colorB = rgbToHsl(b.rgba[0], b.rgba[1], b.rgba[2])
      const grayA = colorA.saturation < 0.08
      const grayB = colorB.saturation < 0.08
      if (grayA !== grayB) return grayA ? 1 : -1
      if (!grayA && colorA.hue !== colorB.hue) return colorA.hue - colorB.hue
      if (colorA.saturation !== colorB.saturation) return colorB.saturation - colorA.saturation
      return colorA.lightness - colorB.lightness
    }
    return b.count - a.count
  })
}
