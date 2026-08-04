import { codeFromIndex, colorKey, rgbaToHex } from '@/core/color'
import type { PaletteEntry, PixelResult } from '@/types/project'

export function buildPalette(
  result: PixelResult | null,
  codeMap: Record<string, string>,
): { entries: PaletteEntry[]; codeMap: Record<string, string> } {
  if (!result) return { entries: [], codeMap }
  const counts = new Map<string, { rgba: [number, number, number, number]; count: number }>()
  for (let offset = 0; offset < result.data.length; offset += 4) {
    const rgba: [number, number, number, number] = [
      result.data[offset],
      result.data[offset + 1],
      result.data[offset + 2],
      result.data[offset + 3],
    ]
    if (rgba[3] === 0) continue
    const key = colorKey(...rgba)
    const entry = counts.get(key) ?? { rgba, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }

  const nextMap = { ...codeMap }
  let nextIndex = Object.keys(nextMap).length
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count)
  for (const entry of sorted) {
    const hex = rgbaToHex(...entry.rgba)
    if (!nextMap[hex]) {
      nextMap[hex] = codeFromIndex(nextIndex)
      nextIndex += 1
    }
  }

  const entries = sorted.map((entry) => {
    const hex = rgbaToHex(...entry.rgba)
    return {
      code: nextMap[hex],
      hex,
      rgba: entry.rgba,
      count: entry.count,
    }
  })

  return { entries, codeMap: nextMap }
}
