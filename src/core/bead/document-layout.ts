import { readableTextColor, rgbaToHex } from '@/core/color'
import type { BeadSettings, PaletteEntry, PixelResult } from '@/types/project'

export interface AxisLabel { value: number; x: number; y: number; anchor: 'start' | 'middle' | 'end' }

export interface BeadCellLayout {
  x: number
  y: number
  width: number
  height: number
  fill: string
  text: string
  textColor: string
}

export interface BeadPdfPageLayout {
  pageWidth: number
  pageHeight: number
  sliceX: number
  sliceY: number
  sliceWidth: number
  sliceHeight: number
  cellSize: number
  gridX: number
  gridY: number
  gridWidth: number
  gridHeight: number
  rowLabels: AxisLabel[]
  columnLabels: AxisLabel[]
  cells: BeadCellLayout[]
  pageNumber: number
  totalPages: number
}

export interface BeadLegendPageLayout {
  pageWidth: number
  pageHeight: number
  entries: PaletteEntry[]
}

export interface BeadSvgLayout {
  width: number
  height: number
  gridX: number
  gridY: number
  gridWidth: number
  gridHeight: number
  cellSize: number
  cells: BeadCellLayout[]
  rowLabels: AxisLabel[]
  columnLabels: AxisLabel[]
  legendTop: number
  legendColumns: number
}

export interface BeadDocumentLayout {
  pdfPages: BeadPdfPageLayout[]
  pdfLegendPages: BeadLegendPageLayout[]
  svgOverview: BeadSvgLayout
}

function cellLayouts(result: PixelResult, palette: PaletteEntry[], sliceX: number, sliceY: number, width: number, height: number, cellSize: number, gridX: number, gridY: number): BeadCellLayout[] {
  const codeByHex = new Map(palette.map((entry) => [entry.hex, entry.code]))
  const cells: BeadCellLayout[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = sliceX + x
      const sourceY = sliceY + y
      const offset = (sourceY * result.width + sourceX) * 4
      const r = result.data[offset]
      const g = result.data[offset + 1]
      const b = result.data[offset + 2]
      const a = result.data[offset + 3]
      const hex = rgbaToHex(r, g, b, a)
      cells.push({
        x: gridX + x * cellSize,
        y: gridY + y * cellSize,
        width: cellSize,
        height: cellSize,
        fill: a === 0 ? '#FFFFFF' : hex,
        text: a === 0 ? '' : codeByHex.get(hex) ?? '',
        textColor: readableTextColor(r, g, b),
      })
    }
  }
  return cells
}

function labels(sliceX: number, sliceY: number, width: number, height: number, cellSize: number, gridX: number, gridY: number, indexFromOne: boolean): { rowLabels: AxisLabel[]; columnLabels: AxisLabel[] } {
  const offset = indexFromOne ? 1 : 0
  return {
    columnLabels: Array.from({ length: width }, (_, index) => ({ value: sliceX + index + offset, x: gridX + index * cellSize + cellSize / 2, y: gridY - 2, anchor: 'middle' as const })),
    rowLabels: Array.from({ length: height }, (_, index) => ({ value: sliceY + index + offset, x: gridX - 2, y: gridY + index * cellSize + cellSize * 0.62, anchor: 'end' as const })),
  }
}

export function createBeadDocumentLayout(result: PixelResult, palette: PaletteEntry[], settings: BeadSettings): BeadDocumentLayout {
  const pageWidth = 297
  const pageHeight = 210
  const margin = 12
  const labelSpace = 8
  const pdfPages: BeadPdfPageLayout[] = []
  const slices = []
  for (let y = 0; y < result.height; y += settings.pageRows) {
    for (let x = 0; x < result.width; x += settings.pageColumns) slices.push({ x, y, width: Math.min(settings.pageColumns, result.width - x), height: Math.min(settings.pageRows, result.height - y) })
  }
  slices.forEach((slice, index) => {
    const cellSize = Math.min((pageWidth - margin * 2 - labelSpace * 2) / slice.width, (pageHeight - margin * 2 - labelSpace * 2 - 10) / slice.height)
    const gridWidth = slice.width * cellSize
    const gridHeight = slice.height * cellSize
    const gridX = (pageWidth - gridWidth) / 2
    const gridY = (pageHeight - gridHeight) / 2
    const axis = labels(slice.x, slice.y, slice.width, slice.height, cellSize, gridX, gridY, settings.indexFromOne)
    pdfPages.push({ pageWidth, pageHeight, sliceX: slice.x, sliceY: slice.y, sliceWidth: slice.width, sliceHeight: slice.height, cellSize, gridX, gridY, gridWidth, gridHeight, ...axis, cells: cellLayouts(result, palette, slice.x, slice.y, slice.width, slice.height, cellSize, gridX, gridY), pageNumber: index + 1, totalPages: slices.length })
  })

  const cells = cellLayouts(result, palette, 0, 0, result.width, result.height, Math.max(12, settings.cellSize), 36, 36)
  const svgCellSize = Math.max(12, settings.cellSize)
  const svgGridWidth = result.width * svgCellSize
  const svgGridHeight = result.height * svgCellSize
  const svgMargin = 36
  const legendColumns = Math.max(1, Math.floor(svgGridWidth / 260))
  const legendRows = Math.ceil(palette.length / legendColumns)
  const svgOverview: BeadSvgLayout = {
    width: svgGridWidth + svgMargin * 2,
    height: svgGridHeight + svgMargin * 2 + legendRows * 28 + 36,
    gridX: svgMargin,
    gridY: svgMargin,
    gridWidth: svgGridWidth,
    gridHeight: svgGridHeight,
    cellSize: svgCellSize,
    cells,
    ...labels(0, 0, result.width, result.height, svgCellSize, svgMargin, svgMargin, settings.indexFromOne),
    legendTop: svgMargin + svgGridHeight + 42,
    legendColumns,
  }

  return {
    pdfPages,
    pdfLegendPages: palette.length > 0 ? [{ pageWidth, pageHeight, entries: palette.slice(0, 64) }] : [],
    svgOverview,
  }
}
