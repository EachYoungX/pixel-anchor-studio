import { markRaw } from 'vue'
import { loadHtmlImage, loadSourceFile } from '@/core/image/load'
import type { SourceRuntime } from '@/domain/source/source-types'

export interface SourceSessionValue {
  source: SourceRuntime
  image: HTMLImageElement
  estimatedRgbaBytes: number
}

export class SourceSession {
  private current: SourceSessionValue | null = null

  async openFile(file: File): Promise<SourceSessionValue> {
    this.release()
    this.current = await loadSourceFile(file)
    return this.current
  }

  async openBlob(input: { name: string; mime: string; width: number; height: number; blob: Blob }): Promise<SourceSessionValue> {
    this.release()
    const previewUrl = URL.createObjectURL(input.blob)
    try {
      const image = await loadHtmlImage(previewUrl)
      this.current = {
        source: { name: input.name, mime: input.mime, previewUrl, file: markRaw(input.blob), width: input.width, height: input.height },
        image,
        estimatedRgbaBytes: input.width * input.height * 4,
      }
      return this.current
    } catch (error) {
      URL.revokeObjectURL(previewUrl)
      throw error
    }
  }

  release(): void {
    const previewUrl = this.current?.source.previewUrl
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    this.current = null
  }
}
