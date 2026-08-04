import type { WorkerSourceBackend, WorkerSourceInput } from '@/workers/source-backends/source-backend'

export class RgbaSourceBackend implements WorkerSourceBackend {
  private readonly sources = new Map<string, { width: number; height: number; data: Uint8ClampedArray }>()

  async load(sourceId: string, input: WorkerSourceInput): Promise<void> {
    if (!input.data) throw new Error('Worker缺少RGBA回退数据')
    this.sources.set(sourceId, { width: input.width, height: input.height, data: input.data })
  }

  readSource(sourceId: string): { width: number; height: number; data: Uint8ClampedArray } {
    const source = this.sources.get(sourceId)
    if (!source) throw new Error('源图缓存不存在，请重新导入图片')
    return source
  }

  release(sourceId: string): void { this.sources.delete(sourceId) }
  clear(): void { this.sources.clear() }
}
