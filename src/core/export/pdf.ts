import { jsPDF } from 'jspdf'
import { createBeadDocumentLayout } from '@/core/bead/document-layout'
import { buildLegendPageCommands, buildPatternPageCommands } from '@/core/bead/document-commands'
import { renderDocumentPdf } from '@/core/bead/render-document-pdf'
import { saveBlob } from '@/core/export/download'
import type { BeadSettings, PaletteEntry, PixelResult } from '@/types/project'

export async function exportBeadPdf(result: PixelResult, palette: PaletteEntry[], settings: BeadSettings, filename: string): Promise<boolean> {
  const layout = createBeadDocumentLayout(result, palette, settings)
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  layout.pdfPages.forEach((page, index) => {
    if (index > 0) document.addPage('a4', 'landscape')
    renderDocumentPdf(document, buildPatternPageCommands(page))
  })
  layout.pdfLegendPages.forEach((page) => {
    document.addPage('a4', 'landscape')
    renderDocumentPdf(document, buildLegendPageCommands(page))
  })
  return saveBlob(document.output('blob'), filename, ['pdf'], 'PDF 文档')
}
