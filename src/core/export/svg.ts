import { downloadBlob } from '@/core/export/download'
import { createBeadDocumentLayout, type BeadSvgLayout } from '@/core/bead/document-layout'
import type { BeadSettings, PaletteEntry, PixelResult } from '@/types/project'

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)
}

export function renderBeadSvgMarkup(layout: BeadSvgLayout, palette: PaletteEntry[]): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
    '<rect width="100%" height="100%" fill="#FFFFFF"/>',
    '<g font-family="Arial, Helvetica, sans-serif">',
  ]
  for (const cell of layout.cells) {
    parts.push(`<rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}" fill="${cell.fill}" stroke="#B8BDC5" stroke-width="0.6"/>`)
    if (cell.text && cell.width >= 18) parts.push(`<text x="${cell.x + cell.width / 2}" y="${cell.y + cell.height / 2 + 3.5}" font-size="${Math.max(7, cell.width * 0.34)}" text-anchor="middle" fill="${cell.textColor}">${escapeXml(cell.text)}</text>`)
  }
  for (const label of layout.columnLabels) {
    parts.push(`<text x="${label.x}" y="${label.y}" font-size="10" text-anchor="${label.anchor}" fill="#343A40">${label.value}</text>`)
    parts.push(`<text x="${label.x}" y="${layout.gridY + layout.gridHeight + 18}" font-size="10" text-anchor="${label.anchor}" fill="#343A40">${label.value}</text>`)
  }
  for (const label of layout.rowLabels) {
    parts.push(`<text x="${label.x}" y="${label.y}" font-size="10" text-anchor="${label.anchor}" fill="#343A40">${label.value}</text>`)
    parts.push(`<text x="${layout.gridX + layout.gridWidth + 10}" y="${label.y}" font-size="10" text-anchor="start" fill="#343A40">${label.value}</text>`)
  }
  palette.forEach((entry, index) => {
    const column = index % layout.legendColumns
    const row = Math.floor(index / layout.legendColumns)
    const x = layout.gridX + column * (layout.gridWidth / layout.legendColumns)
    const y = layout.legendTop + row * 28
    parts.push(`<rect x="${x}" y="${y}" width="18" height="18" rx="2" fill="${entry.rgba[3] === 0 ? '#FFFFFF' : entry.hex}" stroke="#9AA0A6"/>`)
    parts.push(`<text x="${x + 26}" y="${y + 13}" font-size="11" fill="#202124">${escapeXml(entry.code)}  ${escapeXml(entry.hex)}  ×${entry.count}</text>`)
  })
  parts.push('</g></svg>')
  return parts.join('')
}

export function exportBeadSvg(result: PixelResult, palette: PaletteEntry[], filename: string, cellSize: number, indexFromOne: boolean): void {
  const settings: BeadSettings = { maxColors: palette.length, cellSize, pageColumns: result.width, pageRows: result.height, indexFromOne }
  const layout = createBeadDocumentLayout(result, palette, settings)
  downloadBlob(new Blob([renderBeadSvgMarkup(layout.svgOverview, palette)], { type: 'image/svg+xml;charset=utf-8' }), filename)
}
