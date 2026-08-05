import { describe, expect, it } from 'vitest'
import { buildLegendPageCommands } from '@/core/bead/document-commands'
import { createBeadDocumentLayout } from '@/core/bead/document-layout'
import type { BeadSettings, PaletteEntry, PixelResult } from '@/types/project'

const result: PixelResult = { width: 65, height: 33, data: new Uint8ClampedArray(65 * 33 * 4) }
const palette: PaletteEntry[] = Array.from({ length: 64 }, (_, index) => ({ code: `C${index + 1}`, hex: '#202124', rgba: [32, 33, 36, 255], count: index + 1 }))
const settings: BeadSettings = { maxColors: 64, cellSize: 12, pageColumns: 32, pageRows: 32, indexFromOne: true }

describe('createBeadDocumentLayout', () => {
  it('splits PDF pages with the same slices used by the preview', () => {
    const layout = createBeadDocumentLayout(result, palette, settings)

    expect(layout.pdfPages).toHaveLength(6)
    expect(layout.pdfPages[0]).toMatchObject({ sliceX: 0, sliceY: 0, sliceWidth: 32, sliceHeight: 32, pageWidth: 297, pageHeight: 210 })
    expect(layout.pdfPages.at(-1)).toMatchObject({ sliceX: 64, sliceY: 32, sliceWidth: 1, sliceHeight: 1 })
    expect(layout.pdfLegendPages).toHaveLength(1)
    expect(layout.pdfLegendPages[0].entries).toHaveLength(64)
  })

  it('keeps every page grid within its landscape page', () => {
    const layout = createBeadDocumentLayout(result, palette, settings)

    for (const page of layout.pdfPages) {
      expect(page.gridX).toBeGreaterThanOrEqual(0)
      expect(page.gridY).toBeGreaterThanOrEqual(0)
      expect(page.gridX + page.gridWidth).toBeLessThanOrEqual(page.pageWidth)
      expect(page.gridY + page.gridHeight).toBeLessThanOrEqual(page.pageHeight)
    }
  })

  it('creates additional legend pages instead of dropping colors', () => {
    const moreColors = [...palette, ...Array.from({ length: 6 }, (_, index) => ({ code: `C${index + 65}`, hex: '#8b4a43', rgba: [139, 74, 67, 255] as [number, number, number, number], count: index + 1 }))]
    const layout = createBeadDocumentLayout(result, moreColors, settings)

    expect(layout.pdfLegendPages).toHaveLength(2)
    expect(layout.pdfLegendPages[0].entries).toHaveLength(64)
    expect(layout.pdfLegendPages[1].entries).toHaveLength(6)
  })

  it('keeps legend columns separated from the previous quantity field', () => {
    const layout = createBeadDocumentLayout(result, palette, settings)
    const commands = buildLegendPageCommands(layout.pdfLegendPages[0])
    const swatches = commands.filter((command) => command.type === 'rect')
    const quantities = commands.filter((command) => command.type === 'text' && command.text.startsWith('×'))

    expect(swatches[16].x - swatches[0].x).toBe(72)
    expect(quantities[0].x).toBe(72)
    expect(swatches[16].x - quantities[0].x).toBe(14)
  })

  it('accepts centralized document text without changing layout commands', () => {
    const layout = createBeadDocumentLayout(result, palette, settings)
    const commands = buildLegendPageCommands(layout.pdfLegendPages[0], {
      pattern: 'Pattern',
      colorsAndUsage: 'Colors',
      columns: 'Columns',
      rows: 'Rows',
    })
    expect(commands[0]).toMatchObject({ type: 'text', text: expect.stringContaining('Colors') })
  })
})
