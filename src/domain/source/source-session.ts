import { markRaw } from 'vue'
import { loadHtmlImage, loadSourceFile } from '@/core/image/load'
import type { SourceRuntime } from '@/domain/source/source-types'
import { createSourcePreview, type SourcePreview } from '@/runtime/source-preview'

export interface SourceSessionValue {
  source: SourceRuntime
  image: HTMLImageElement
  preview: SourcePreview
  estimatedRgbaBytes: number
}

export class SourceSession {
  private current: SourceSessionValue | null = null

  async openFile(file: File): Promise<SourceSessionValue> {
    this.release()
    const loaded = await loadSourceFile(file)
    try {
      const preview = await createSourcePreview(file, loaded.image)
      this.current = { ...loaded, preview }
      return this.current
    } catch (error) {
      URL.revokeObjectURL(loaded.source.previewUrl)
      throw error
    }
  }

  async openBlob(input: { name: string; mime: string; width: number; height: number; blob: Blob }): Promise<SourceSessionValue> {
    this.release()
    const previewUrl = URL.createObjectURL(input.blob)
    try {
      const image = await loadHtmlImage(previewUrl)
      const preview = await createSourcePreview(input.blob, image)
      this.current = {
        source: { name: input.name, mime: input.mime, previewUrl, file: markRaw(input.blob), width: input.width, height: input.height },
        image,
        preview,
        estimatedRgbaBytes: input.width * input.height * 4,
      }
      return this.current
    } catch (error) {
      URL.revokeObjectURL(previewUrl)
      throw error
    }
  }

  release(): void {
    this.current?.preview.release()
    const previewUrl = this.current?.source.previewUrl
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    this.current = null
  }
}
