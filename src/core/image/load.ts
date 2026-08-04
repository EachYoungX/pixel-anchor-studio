import type { SourceState } from '@/types/project'

const MAX_SOURCE_PIXELS = 40_000_000

export function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法解码图片'))
    image.src = dataUrl
  })
}

export async function loadSourceFile(file: File): Promise<{ source: SourceState; image: HTMLImageElement }> {
  if (!file.type.startsWith('image/')) throw new Error('请选择PNG、JPEG、WebP或其他浏览器支持的图片')
  const previewUrl = URL.createObjectURL(file)
  let image: HTMLImageElement
  try {
    image = await loadHtmlImage(previewUrl)
  } catch (error) {
    URL.revokeObjectURL(previewUrl)
    throw error
  }
  const pixels = image.naturalWidth * image.naturalHeight
  if (pixels > MAX_SOURCE_PIXELS) {
    URL.revokeObjectURL(previewUrl)
    throw new Error('原图超过4000万像素，请先适当缩小后再导入')
  }
  return {
    source: {
      name: file.name,
      dataUrl: '',
      previewUrl,
      width: image.naturalWidth,
      height: image.naturalHeight,
    },
    image,
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
