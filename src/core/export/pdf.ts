import { jsPDF } from 'jspdf'
import { readableTextColor, rgbaToHex } from '@/core/color'
import { downloadBlob } from '@/core/export/download'
import type { BeadSettings, PaletteEntry, PixelResult } from '@/types/project'

interface PageSlice {
  x: number
  y: number
  width: number
  height: number
}

function splitPages(result: PixelResult, settings: BeadSettings): PageSlice[] {
  const slices: PageSlice[] = []
  for (let y = 0; y < result.height; y += settings.pageRows) {
    for (let x = 0; x < result.width; x += settings.pageColumns) {
      slices.push({
        x,
        y,
        width: Math.min(settings.pageColumns, result.width - x),
        height: Math.min(settings.pageRows, result.height - y),
      })
    }
  }
  return slices
}

export function exportBeadPdf(
  result: PixelResult,
  palette: PaletteEntry[],
  settings: BeadSettings,
  filename: string,
): void {
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = document.internal.pageSize.getWidth()
  const pageHeight = document.internal.pageSize.getHeight()
  const margin = 12
  const labelSpace = 8
  const codeByHex = new Map(palette.map((entry) => [entry.hex, entry.code]))
  const slices = splitPages(result, settings)

  slices.forEach((slice, pageIndex) => {
    if (pageIndex > 0) document.addPage('a4', 'landscape')
    const availableWidth = pageWidth - margin * 2 - labelSpace * 2
    const availableHeight = pageHeight - margin * 2 - labelSpace * 2 - 10
    const cellSize = Math.min(availableWidth / slice.width, availableHeight / slice.height)
    const originX = (pageWidth - slice.width * cellSize) / 2
    const originY = (pageHeight - slice.height * cellSize) / 2

    document.setFont('helvetica', 'normal')
    document.setTextColor(35, 39, 42)
    document.setFontSize(8)
    document.text(
      `${slice.x + 1}-${slice.x + slice.width} / ${slice.y + 1}-${slice.y + slice.height}`,
      margin,
      margin,
    )
    document.text(`Page ${pageIndex + 1} / ${slices.length}`, pageWidth - margin, margin, { align: 'right' })

    for (let y = 0; y < slice.height; y += 1) {
      for (let x = 0; x < slice.width; x += 1) {
        const sourceX = slice.x + x
        const sourceY = slice.y + y
        const offset = (sourceY * result.width + sourceX) * 4
        const r = result.data[offset]
        const g = result.data[offset + 1]
        const b = result.data[offset + 2]
        const a = result.data[offset + 3]
        const px = originX + x * cellSize
        const py = originY + y * cellSize
        const hex = rgbaToHex(r, g, b, a)
        const code = a === 0 ? '' : codeByHex.get(hex) ?? ''

        document.setFillColor(a === 0 ? 255 : r, a === 0 ? 255 : g, a === 0 ? 255 : b)
        document.setDrawColor(170, 175, 180)
        document.rect(px, py, cellSize, cellSize, 'FD')
        if (code && cellSize >= 4.2) {
          const textColor = readableTextColor(r, g, b)
          document.setTextColor(textColor === '#FFFFFF' ? 255 : 20)
          document.setFontSize(Math.max(4, Math.min(7, cellSize * 0.9)))
          document.text(code, px + cellSize / 2, py + cellSize * 0.66, { align: 'center' })
        }
      }
    }

    const indexOffset = settings.indexFromOne ? 1 : 0
    document.setTextColor(40, 44, 48)
    document.setFontSize(5.5)
    for (let x = 0; x < slice.width; x += 1) {
      const value = slice.x + x + indexOffset
      const center = originX + x * cellSize + cellSize / 2
      document.text(String(value), center, originY - 2, { align: 'center' })
      document.text(String(value), center, originY + slice.height * cellSize + 4, { align: 'center' })
    }
    for (let y = 0; y < slice.height; y += 1) {
      const value = slice.y + y + indexOffset
      const center = originY + y * cellSize + cellSize * 0.62
      document.text(String(value), originX - 2, center, { align: 'right' })
      document.text(String(value), originX + slice.width * cellSize + 2, center, { align: 'left' })
    }
  })

  const legendEntries = palette.slice(0, 64)
  if (legendEntries.length > 0) {
    document.addPage('a4', 'landscape')
    document.setTextColor(30, 34, 38)
    document.setFontSize(14)
    document.text('Color legend', 14, 16)
    legendEntries.forEach((entry, index) => {
      const column = Math.floor(index / 16)
      const row = index % 16
      const x = 14 + column * 68
      const y = 26 + row * 10
      document.setFillColor(entry.rgba[0], entry.rgba[1], entry.rgba[2])
      document.setDrawColor(150, 155, 160)
      document.rect(x, y - 5, 7, 7, 'FD')
      document.setTextColor(30, 34, 38)
      document.setFontSize(9)
      document.text(`${entry.code}  ${entry.hex}  x${entry.count}`, x + 11, y)
    })
  }

  const blob = document.output('blob')
  downloadBlob(blob, filename)
}
