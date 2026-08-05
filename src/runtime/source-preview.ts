export const DEFAULT_PREVIEW_MAX_EDGE = 2048

export interface SourcePreview {
  image: CanvasImageSource
  width: number
  height: number
  release(): void
}

export function calculatePreviewSize(width: number, height: number, maxEdge = DEFAULT_PREVIEW_MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export async function createSourcePreview(blob: Blob, image: HTMLImageElement, maxEdge = DEFAULT_PREVIEW_MAX_EDGE): Promise<SourcePreview> {
  const size = calculatePreviewSize(image.naturalWidth, image.naturalHeight, maxEdge)
  if (size.width === image.naturalWidth && size.height === image.naturalHeight) {
    return { image, ...size, release() {} }
  }

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: size.width,
        resizeHeight: size.height,
        resizeQuality: 'high',
      })
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // Canvas fallback keeps preview creation available on partial implementations.
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return { image, width: image.naturalWidth, height: image.naturalHeight, release() {} }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, size.width, size.height)
  return { image: canvas, ...size, release() {} }
}
