import { beadDocumentStyle, ptToMm } from '@/core/bead/document-style'
import type { BeadLegendPageLayout, BeadPdfPageLayout, BeadSvgLayout } from '@/core/bead/document-layout'
import { zhCNBeadDocumentText, type BeadDocumentText } from '@/content/bead-document-text'

export type DocumentCommand =
  | { type: 'rect'; x: number; y: number; width: number; height: number; fill: string; stroke: string; strokeWidthMm: number }
  | { type: 'text'; x: number; y: number; text: string; fontSizePt: number; color: string; align: 'left' | 'center' | 'right' }

export function buildPatternPageCommands(page: BeadPdfPageLayout, text: BeadDocumentText = zhCNBeadDocumentText): DocumentCommand[] {
  const commands: DocumentCommand[] = [
    { type: 'text', x: 12, y: 12, text: `${text.pattern} ${page.pageNumber} / ${page.totalPages} · ${text.columns} ${page.sliceX + 1}–${page.sliceX + page.sliceWidth} · ${text.rows} ${page.sliceY + 1}–${page.sliceY + page.sliceHeight}`, fontSizePt: beadDocumentStyle.pageHeaderPt, color: '#23272a', align: 'left' },
  ]
  for (const cell of page.cells) {
    commands.push({ type: 'rect', x: cell.x, y: cell.y, width: cell.width, height: cell.height, fill: cell.fill, stroke: '#aab0b6', strokeWidthMm: beadDocumentStyle.gridStrokeWidthMm })
    if (cell.text && cell.width >= 4.2) commands.push({ type: 'text', x: cell.x + cell.width / 2, y: cell.y + cell.height * 0.66, text: cell.text, fontSizePt: Math.max(beadDocumentStyle.cellCodeMinPt, Math.min(beadDocumentStyle.cellCodeMaxPt, cell.width / ptToMm(1) * 0.9)), color: cell.textColor, align: 'center' })
  }
  for (const label of page.columnLabels) {
    commands.push({ type: 'text', x: label.x, y: label.y, text: String(label.value), fontSizePt: beadDocumentStyle.axisLabelPt, color: '#282c30', align: 'center' })
    commands.push({ type: 'text', x: label.x, y: page.gridY + page.gridHeight + 4, text: String(label.value), fontSizePt: beadDocumentStyle.axisLabelPt, color: '#282c30', align: 'center' })
  }
  for (const label of page.rowLabels) {
    commands.push({ type: 'text', x: label.x, y: label.y, text: String(label.value), fontSizePt: beadDocumentStyle.axisLabelPt, color: '#282c30', align: 'right' })
    commands.push({ type: 'text', x: page.gridX + page.gridWidth + 2, y: label.y, text: String(label.value), fontSizePt: beadDocumentStyle.axisLabelPt, color: '#282c30', align: 'left' })
  }
  return commands
}

export function buildLegendPageCommands(page: BeadLegendPageLayout, text: BeadDocumentText = zhCNBeadDocumentText): DocumentCommand[] {
  const commands: DocumentCommand[] = [{ type: 'text', x: 14, y: 16, text: `${text.colorsAndUsage} ${page.pageNumber} / ${page.totalPages}`, fontSizePt: beadDocumentStyle.legendTitlePt, color: '#1e2226', align: 'left' }]
  page.entries.forEach((entry, index) => {
    const x = 14 + Math.floor(index / 16) * beadDocumentStyle.legendColumnWidthMm
    const y = 26 + (index % 16) * 10
    commands.push({ type: 'rect', x, y: y - 5, width: 5.5, height: 5.5, fill: entry.hex, stroke: '#969ba0', strokeWidthMm: 0.25 })
    commands.push({ type: 'text', x: x + 8, y, text: entry.code, fontSizePt: beadDocumentStyle.legendTextPt, color: '#1e2226', align: 'left' })
    commands.push({ type: 'text', x: x + 18, y, text: entry.hex, fontSizePt: beadDocumentStyle.legendTextPt, color: '#1e2226', align: 'left' })
    commands.push({ type: 'text', x: x + 58, y, text: `×${entry.count}`, fontSizePt: beadDocumentStyle.legendTextPt, color: '#1e2226', align: 'right' })
  })
  return commands
}

export function buildSvgOverviewCommands(layout: BeadSvgLayout, palette: Array<{ code: string; hex: string; rgba: [number, number, number, number]; count: number }>): DocumentCommand[] {
  const commands: DocumentCommand[] = []
  for (const cell of layout.cells) {
    commands.push({ type: 'rect', x: cell.x, y: cell.y, width: cell.width, height: cell.height, fill: cell.fill, stroke: '#B8BDC5', strokeWidthMm: 0.6 })
    if (cell.text && cell.width >= 18) commands.push({ type: 'text', x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 + 3.5, text: cell.text, fontSizePt: Math.max(7, cell.width / ptToMm(1) * 0.34), color: cell.textColor, align: 'center' })
  }
  for (const label of layout.columnLabels) {
    commands.push({ type: 'text', x: label.x, y: label.y, text: String(label.value), fontSizePt: 10, color: '#343A40', align: 'center' })
    commands.push({ type: 'text', x: label.x, y: layout.gridY + layout.gridHeight + 18, text: String(label.value), fontSizePt: 10, color: '#343A40', align: 'center' })
  }
  for (const label of layout.rowLabels) {
    commands.push({ type: 'text', x: label.x, y: label.y, text: String(label.value), fontSizePt: 10, color: '#343A40', align: 'right' })
    commands.push({ type: 'text', x: layout.gridX + layout.gridWidth + 10, y: label.y, text: String(label.value), fontSizePt: 10, color: '#343A40', align: 'left' })
  }
  palette.forEach((entry, index) => {
    const column = index % layout.legendColumns
    const row = Math.floor(index / layout.legendColumns)
    const x = layout.gridX + column * (layout.gridWidth / layout.legendColumns)
    const y = layout.legendTop + row * 28
    commands.push({ type: 'rect', x, y, width: 18, height: 18, fill: entry.rgba[3] === 0 ? '#FFFFFF' : entry.hex, stroke: '#9AA0A6', strokeWidthMm: 0.4 })
    commands.push({ type: 'text', x: x + 26, y: y + 13, text: entry.code, fontSizePt: 11, color: '#202124', align: 'left' })
    commands.push({ type: 'text', x: x + 68, y: y + 13, text: entry.hex, fontSizePt: 11, color: '#202124', align: 'left' })
    commands.push({ type: 'text', x: x + 118, y: y + 13, text: `×${entry.count}`, fontSizePt: 11, color: '#202124', align: 'right' })
  })
  return commands
}
