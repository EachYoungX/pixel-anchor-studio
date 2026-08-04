import { ptToMm } from '@/core/bead/document-style'
import type { DocumentCommand } from '@/core/bead/document-commands'

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)
}

export function renderDocumentSvg(commands: DocumentCommand[], width: number, height: number): string {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><g font-family="Arial, Helvetica, sans-serif">`]
  for (const command of commands) {
    if (command.type === 'rect') parts.push(`<rect x="${command.x}" y="${command.y}" width="${command.width}" height="${command.height}" fill="${command.fill}" stroke="${command.stroke}" stroke-width="${command.strokeWidthMm}"/>`)
    else parts.push(`<text x="${command.x}" y="${command.y}" font-size="${ptToMm(command.fontSizePt)}" text-anchor="${command.align === 'center' ? 'middle' : command.align === 'right' ? 'end' : 'start'}" fill="${command.color}">${escapeXml(command.text)}</text>`)
  }
  parts.push('</g></svg>')
  return parts.join('')
}
