import { markRaw } from 'vue'
import { loadHtmlImage, loadSourceFile, validateSourceDimensions } from '@/core/image/load'
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

  private releaseValue(value: SourceSessionValue): void {
    value.preview.release()
    const previewUrl = value.source.previewUrl
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
  }

  async prepareFile(file: File): Promise<SourceSessionValue> {
    const loaded = await loadSourceFile(file)
    try {
      const preview = await createSourcePreview(file, loaded.image)
      return { ...loaded, preview }
    } catch (error) {
      URL.revokeObjectURL(loaded.source.previewUrl)
      throw error
    }
  }

  async prepareBlob(input: { name: string; mime: string; width: number; height: number; blob: Blob }): Promise<SourceSessionValue> {
    const previewUrl = URL.createObjectURL(input.blob)
    try {
      const image = await loadHtmlImage(previewUrl)
      const width = image.naturalWidth
      const height = image.naturalHeight
      const pixels = validateSourceDimensions(width, height)
      const preview = await createSourcePreview(input.blob, image)
      return {
        source: { name: input.name, mime: input.mime, previewUrl, file: markRaw(input.blob), width, height },
        image,
        preview,
        estimatedRgbaBytes: pixels * 4,
      }
    } catch (error) {
      URL.revokeObjectURL(previewUrl)
      throw error
    }
  }

  adopt(prepared: SourceSessionValue): SourceSessionValue {
    if (prepared === this.current) return prepared
    this.release()
    this.current = prepared
    return prepared
  }

  discard(prepared: SourceSessionValue): void {
    if (prepared === this.current) return
    this.releaseValue(prepared)
  }

  async openFile(file: File): Promise<SourceSessionValue> {
    return this.adopt(await this.prepareFile(file))
  }

  async openBlob(input: { name: string; mime: string; width: number; height: number; blob: Blob }): Promise<SourceSessionValue> {
    return this.adopt(await this.prepareBlob(input))
  }

  release(): void {
    if (this.current) this.releaseValue(this.current)
    this.current = null
  }
}
