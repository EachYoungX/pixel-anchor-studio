import { jsPDF } from 'jspdf'
import { downloadBlob } from '@/core/export/download'
import { createBeadDocumentLayout, type BeadPdfPageLayout } from '@/core/bead/document-layout'
import type { BeadSettings, PaletteEntry, PixelResult } from '@/types/project'

function drawPdfPage(document: jsPDF, page: BeadPdfPageLayout): void {
  const align = (value: 'start' | 'middle' | 'end'): 'left' | 'center' | 'right' => value === 'middle' ? 'center' : value === 'end' ? 'right' : 'left'
  document.setFont('helvetica', 'normal')
  document.setTextColor(35, 39, 42)
  document.setFontSize(8)
  document.text(`${page.sliceX + 1}-${page.sliceX + page.sliceWidth} / ${page.sliceY + 1}-${page.sliceY + page.sliceHeight}`, 12, 12)
  document.text(`Page ${page.pageNumber} / ${page.totalPages}`, page.pageWidth - 12, 12, { align: 'right' })

  for (const cell of page.cells) {
    document.setFillColor(cell.fill)
    document.setDrawColor(170, 175, 180)
    document.rect(cell.x, cell.y, cell.width, cell.height, 'FD')
    if (cell.text && cell.width >= 4.2) {
      document.setTextColor(cell.textColor === '#FFFFFF' ? 255 : 20)
      document.setFontSize(Math.max(4, Math.min(7, cell.width * 0.9)))
      document.text(cell.text, cell.x + cell.width / 2, cell.y + cell.height * 0.66, { align: 'center' })
    }
  }

  document.setTextColor(40, 44, 48)
  document.setFontSize(5.5)
  for (const label of page.columnLabels) {
    document.text(String(label.value), label.x, label.y, { align: align(label.anchor) })
    document.text(String(label.value), label.x, page.gridY + page.gridHeight + 4, { align: align(label.anchor) })
  }
  for (const label of page.rowLabels) {
    document.text(String(label.value), label.x, label.y, { align: align(label.anchor) })
    document.text(String(label.value), page.gridX + page.gridWidth + 2, label.y, { align: 'left' })
  }
}

export function exportBeadPdf(result: PixelResult, palette: PaletteEntry[], settings: BeadSettings, filename: string): void {
  const layout = createBeadDocumentLayout(result, palette, settings)
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  layout.pdfPages.forEach((page, index) => {
    if (index > 0) document.addPage('a4', 'landscape')
    drawPdfPage(document, page)
  })
  layout.pdfLegendPages.forEach((legend) => {
    document.addPage('a4', 'landscape')
    document.setTextColor(30, 34, 38)
    document.setFontSize(14)
    document.text('颜色与用量', 14, 16)
    legend.entries.forEach((entry, index) => {
      const column = Math.floor(index / 16)
      const row = index % 16
      const x = 14 + column * 68
      const y = 26 + row * 10
      document.setFillColor(entry.rgba[0], entry.rgba[1], entry.rgba[2])
      document.setDrawColor(150, 155, 160)
      document.rect(x, y - 5, 7, 7, 'FD')
      document.setTextColor(30, 34, 38)
      document.setFontSize(9)
      document.text(`${entry.code}  ${entry.hex}  ×${entry.count}`, x + 11, y)
    })
  })
  downloadBlob(document.output('blob'), filename)
}
