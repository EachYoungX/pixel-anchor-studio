import { cropEnvelope, type CropRect, type SourceCrop, type SourceDimensions, type WorkerSourceBackend, type WorkerSourceInput } from '@/workers/source-backends/source-backend'

export class RgbaSourceBackend implements WorkerSourceBackend {
  private readonly sources = new Map<string, { width: number; height: number; data: Uint8ClampedArray }>()

  async load(sourceId: string, input: WorkerSourceInput): Promise<void> {
    if (!input.data) throw new Error('Worker缺少RGBA回退数据')
    this.sources.set(sourceId, { width: input.width, height: input.height, data: input.data })
  }

  getDimensions(sourceId: string): SourceDimensions {
    const source = this.sources.get(sourceId)
    if (!source) throw new Error('源图缓存不存在，请重新导入图片')
    return { width: source.width, height: source.height }
  }

  readCrop(sourceId: string, crop: CropRect): SourceCrop {
    const source = this.sources.get(sourceId)
    if (!source) throw new Error('源图缓存不存在，请重新导入图片')
    const envelope = cropEnvelope(crop, source)
    const data = new Uint8ClampedArray(envelope.width * envelope.height * 4)
    for (let row = 0; row < envelope.height; row += 1) {
      const sourceOffset = ((envelope.originY + row) * source.width + envelope.originX) * 4
      const targetOffset = row * envelope.width * 4
      data.set(source.data.subarray(sourceOffset, sourceOffset + envelope.width * 4), targetOffset)
    }
    return { ...envelope, data }
  }

  release(sourceId: string): void { this.sources.delete(sourceId) }
  clear(): void { this.sources.clear() }
}
