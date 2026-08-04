import { readableTextColor, rgbaToHex } from '@/core/color'
import { downloadBlob } from '@/core/export/download'
import type { PaletteEntry, PixelResult } from '@/types/project'

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)
}

export function exportBeadSvg(
  result: PixelResult,
  palette: PaletteEntry[],
  filename: string,
  cellSize: number,
  indexFromOne: boolean,
): void {
  const cells = Math.max(12, cellSize)
  const margin = Math.max(36, cells * 1.8)
  const legendRowHeight = 28
  const legendColumns = Math.max(1, Math.floor((result.width * cells) / 260))
  const legendRows = Math.ceil(palette.length / legendColumns)
  const gridWidth = result.width * cells
  const gridHeight = result.height * cells
  const width = gridWidth + margin * 2
  const height = gridHeight + margin * 2 + legendRows * legendRowHeight + 36
  const codeByHex = new Map(palette.map((entry) => [entry.hex, entry.code]))
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#FFFFFF"/>',
    '<g font-family="Arial, Helvetica, sans-serif">',
  ]

  for (let y = 0; y < result.height; y += 1) {
    for (let x = 0; x < result.width; x += 1) {
      const offset = (y * result.width + x) * 4
      const r = result.data[offset]
      const g = result.data[offset + 1]
      const b = result.data[offset + 2]
      const a = result.data[offset + 3]
      const hex = rgbaToHex(r, g, b, a)
      const code = a === 0 ? '' : codeByHex.get(hex) ?? ''
      const px = margin + x * cells
      const py = margin + y * cells
      const fill = a === 0 ? '#FFFFFF' : hex
      parts.push(`<rect x="${px}" y="${py}" width="${cells}" height="${cells}" fill="${fill}" stroke="#B8BDC5" stroke-width="0.6"/>`)
      if (code && cells >= 18) {
        parts.push(`<text x="${px + cells / 2}" y="${py + cells / 2 + 3.5}" font-size="${Math.max(7, cells * 0.34)}" text-anchor="middle" fill="${readableTextColor(r, g, b)}">${escapeXml(code)}</text>`)
      }
    }
  }

  const indexOffset = indexFromOne ? 1 : 0
  for (let x = 0; x < result.width; x += 1) {
    const value = x + indexOffset
    const center = margin + x * cells + cells / 2
    parts.push(`<text x="${center}" y="${margin - 10}" font-size="10" text-anchor="middle" fill="#343A40">${value}</text>`)
    parts.push(`<text x="${center}" y="${margin + gridHeight + 18}" font-size="10" text-anchor="middle" fill="#343A40">${value}</text>`)
  }
  for (let y = 0; y < result.height; y += 1) {
    const value = y + indexOffset
    const center = margin + y * cells + cells / 2 + 3
    parts.push(`<text x="${margin - 10}" y="${center}" font-size="10" text-anchor="end" fill="#343A40">${value}</text>`)
    parts.push(`<text x="${margin + gridWidth + 10}" y="${center}" font-size="10" text-anchor="start" fill="#343A40">${value}</text>`)
  }

  const legendTop = margin + gridHeight + 42
  const columnWidth = gridWidth / legendColumns
  palette.forEach((entry, index) => {
    const column = index % legendColumns
    const row = Math.floor(index / legendColumns)
    const x = margin + column * columnWidth
    const y = legendTop + row * legendRowHeight
    parts.push(`<rect x="${x}" y="${y}" width="18" height="18" rx="2" fill="${entry.rgba[3] === 0 ? '#FFFFFF' : entry.hex}" stroke="#9AA0A6"/>`)
    parts.push(`<text x="${x + 26}" y="${y + 13}" font-size="11" fill="#202124">${escapeXml(entry.code)}  ${escapeXml(entry.hex)}  ×${entry.count}</text>`)
  })

  parts.push('</g></svg>')
  downloadBlob(new Blob([parts.join('')], { type: 'image/svg+xml;charset=utf-8' }), filename)
}
