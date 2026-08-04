import { cropEnvelope, type CropRect, type SourceCrop, type SourceDimensions, type WorkerSourceBackend, type WorkerSourceInput } from '@/workers/source-backends/source-backend'

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

  getDimensions(sourceId: string): SourceDimensions {
    const bitmap = this.sources.get(sourceId)
    if (!bitmap) throw new Error('源图缓存不存在，请重新导入图片')
    return { width: bitmap.width, height: bitmap.height }
  }

  readCrop(sourceId: string, crop: CropRect): SourceCrop {
    const bitmap = this.sources.get(sourceId)
    if (!bitmap) throw new Error('源图缓存不存在，请重新导入图片')
    const envelope = cropEnvelope(crop, bitmap)
    const canvas = new OffscreenCanvas(envelope.width, envelope.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Worker无法创建图像画布')
    context.drawImage(bitmap, envelope.originX, envelope.originY, envelope.width, envelope.height, 0, 0, envelope.width, envelope.height)
    const imageData = context.getImageData(0, 0, envelope.width, envelope.height)
    return { ...envelope, data: imageData.data }
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
