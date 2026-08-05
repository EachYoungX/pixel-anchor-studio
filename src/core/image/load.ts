import { markRaw } from 'vue'
import type { SourceRuntime } from '@/domain/source/source-types'

const MAX_SOURCE_PIXELS = 40_000_000

export function validateSourceDimensions(width: number, height: number): number {
  const pixels = width * height
  if (width < 1 || height < 1 || !Number.isFinite(pixels)) throw new Error('原图尺寸无效，请重新选择图片')
  if (pixels > MAX_SOURCE_PIXELS) throw new Error('原图超过4000万像素，请先适当缩小后再导入')
  return pixels
}

export function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法解码图片'))
    image.src = dataUrl
  })
}

export async function loadSourceFile(file: File): Promise<{ source: SourceRuntime; image: HTMLImageElement; estimatedRgbaBytes: number }> {
  if (!file.type.startsWith('image/')) throw new Error('请选择PNG、JPEG、WebP或其他浏览器支持的图片')
  const previewUrl = URL.createObjectURL(file)
  let image: HTMLImageElement
  try {
    image = await loadHtmlImage(previewUrl)
  } catch (error) {
    URL.revokeObjectURL(previewUrl)
    throw error
  }
  let pixels: number
  try {
    pixels = validateSourceDimensions(image.naturalWidth, image.naturalHeight)
  } catch (error) {
    URL.revokeObjectURL(previewUrl)
    throw error
  }
  return {
    source: {
      name: file.name,
      mime: file.type,
      previewUrl,
      file: markRaw(file),
      width: image.naturalWidth,
      height: image.naturalHeight,
    },
    image,
    estimatedRgbaBytes: pixels * 4,
  }
}

export function imageToImageData(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('浏览器无法创建图像画布')
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

export function imageToDataUrl(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法创建图像画布')
  context.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}
