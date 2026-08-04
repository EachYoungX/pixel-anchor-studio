import { describe, expect, it } from 'vitest'
import { createBeadDocumentLayout } from '@/core/bead/document-layout'
import { renderBeadSvgMarkup } from '@/core/export/svg'
import type { BeadSettings, PaletteEntry, PixelResult } from '@/types/project'

describe('bead SVG preview layout', () => {
  it('uses the same viewBox ratio as the SVG document layout', () => {
    const result: PixelResult = { width: 4, height: 3, data: new Uint8ClampedArray(4 * 3 * 4) }
    const palette: PaletteEntry[] = [{ code: 'C1', hex: '#202124', rgba: [32, 33, 36, 255], count: 12 }]
    const settings: BeadSettings = { maxColors: 64, cellSize: 24, pageColumns: 32, pageRows: 32, indexFromOne: true }
    const layout = createBeadDocumentLayout(result, palette, settings)
    const markup = renderBeadSvgMarkup(layout.svgOverview, palette)

    expect(markup).toContain(`viewBox="0 0 ${layout.svgOverview.width} ${layout.svgOverview.height}"`)
    expect(layout.svgOverview.gridX).toBe(36)
    expect(layout.svgOverview.gridY).toBe(36)
  })
})
