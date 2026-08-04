import type { WorkerSourceBackend, WorkerSourceInput } from '@/workers/source-backends/source-backend'

export class BitmapSourceBackend implements WorkerSourceBackend {
  private readonly sources = new Map<string, ImageBitmap>()

  get supported(): boolean {
    return typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined'
  }

  async load(sourceId: string, input: WorkerSourceInput): Promise<void> {
    if (!this.supported || !input.blob) throw new Error('ImageBitmap后端不可用')
    const bitmap = await createImageBitmap(input.blob)
    this.sources.get(sourceId)?.close()
    this.sources.set(sourceId, bitmap)
  }

  readSource(sourceId: string): { width: number; height: number; data: Uint8ClampedArray } {
    const bitmap = this.sources.get(sourceId)
    if (!bitmap) throw new Error('源图缓存不存在，请重新导入图片')
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Worker无法创建图像画布')
    context.drawImage(bitmap, 0, 0)
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height)
    return { width: bitmap.width, height: bitmap.height, data: imageData.data }
  }

  release(sourceId: string): void {
    this.sources.get(sourceId)?.close()
    this.sources.delete(sourceId)
  }

  clear(): void {
    for (const bitmap of this.sources.values()) bitmap.close()
    this.sources.clear()
  }
}
