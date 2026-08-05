import { hexToRgba } from '@/core/color'
import { buildPalette } from '@/core/palette'
import { sortPaletteEntries } from '@/domain/palette/color-sort'
import type { PaletteEntry, PaletteSortMode, PixelResult } from '@/types/project'

export interface PaletteSnapshot {
  entries: PaletteEntry[]
  codeMap: Record<string, string>
  selectedColor: string
}

export function createPaletteSnapshot(
  result: PixelResult | null,
  codeMap: Record<string, string>,
  sortMode: PaletteSortMode,
  selectedColor: string,
): PaletteSnapshot {
  const built = buildPalette(result, codeMap)
  const entries = sortPaletteEntries(built.entries, sortMode)
  const nextSelected = entries.some((entry) => entry.hex === selectedColor)
    ? selectedColor
    : entries.find((entry) => entry.rgba[3] > 0)?.hex ?? '#202124'
  return { entries, codeMap: built.codeMap, selectedColor: nextSelected }
}

export function replacePaletteColor(result: PixelResult, fromHex: string, toHex: string): boolean {
  if (fromHex === toHex) return false
  const from = hexToRgba(fromHex)
  const to = hexToRgba(toHex)
  let changed = false
  for (let offset = 0; offset < result.data.length; offset += 4) {
    if (
      result.data[offset] === from[0] &&
      result.data[offset + 1] === from[1] &&
      result.data[offset + 2] === from[2] &&
      result.data[offset + 3] === from[3]
    ) {
      result.data.set(to, offset)
      changed = true
    }
  }
  return changed
}
