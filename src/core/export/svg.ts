import { buildSvgOverviewCommands } from '@/core/bead/document-commands'
import { createBeadDocumentLayout } from '@/core/bead/document-layout'
import { renderDocumentSvg } from '@/core/bead/render-document-svg'
import { saveBlob } from '@/core/export/download'
import type { BeadSettings, PaletteEntry, PixelResult } from '@/types/project'

export function renderBeadSvgMarkup(layout: ReturnType<typeof createBeadDocumentLayout>['svgOverview'], palette: PaletteEntry[]): string {
  return renderDocumentSvg(buildSvgOverviewCommands(layout, palette), layout.width, layout.height)
}

export async function exportBeadSvg(result: PixelResult, palette: PaletteEntry[], filename: string, cellSize: number, indexFromOne: boolean): Promise<boolean> {
  const settings: BeadSettings = { maxColors: palette.length, cellSize, pageColumns: result.width, pageRows: result.height, indexFromOne }
  const layout = createBeadDocumentLayout(result, palette, settings)
  return saveBlob(new Blob([renderBeadSvgMarkup(layout.svgOverview, palette)], { type: 'image/svg+xml;charset=utf-8' }), filename, ['svg'], 'SVG 图片')
}
