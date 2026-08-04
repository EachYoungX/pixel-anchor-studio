import { jsPDF } from 'jspdf'
import type { DocumentCommand } from '@/core/bead/document-commands'

function rgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)]
}

export function renderDocumentPdf(document: jsPDF, commands: DocumentCommand[]): void {
  for (const command of commands) {
    if (command.type === 'rect') {
      document.setFillColor(...rgb(command.fill))
      document.setDrawColor(...rgb(command.stroke))
      document.setLineWidth(command.strokeWidthMm)
      document.rect(command.x, command.y, command.width, command.height, 'FD')
    } else {
      document.setTextColor(...rgb(command.color))
      document.setFontSize(command.fontSizePt)
      document.text(command.text, command.x, command.y, { align: command.align })
    }
  }
}
