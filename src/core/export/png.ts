import { downloadBlob } from '@/core/export/download'
import type { PixelResult } from '@/types/project'

function resultToCanvas(result: PixelResult, scale: number): HTMLCanvasElement {
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = result.width
  sourceCanvas.height = result.height
  const sourceContext = sourceCanvas.getContext('2d')
  if (!sourceContext) throw new Error('无法创建PNG画布')
  sourceContext.putImageData(new ImageData(new Uint8ClampedArray(result.data), result.width, result.height), 0, 0)

  if (scale === 1) return sourceCanvas
  const canvas = document.createElement('canvas')
  canvas.width = result.width * scale
  canvas.height = result.height * scale
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建PNG画布')
  context.imageSmoothingEnabled = false
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function exportPng(result: PixelResult, filename: string, scale: number): Promise<void> {
  const canvas = resultToCanvas(result, Math.max(1, Math.floor(scale)))
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('PNG生成失败'))), 'image/png')
  })
  downloadBlob(blob, filename)
}
