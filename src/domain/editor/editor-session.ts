import { clonePixelResult } from '@/domain/editor/history'
import type { DirtyBounds } from '@/domain/editor/pixel-operations'
import type { PixelResult } from '@/types/project'

export class EditorSession {
  private label = ''
  private before: PixelResult | null = null
  private dirty: DirtyBounds | null = null

  get active(): boolean { return this.before !== null }
  get hasChanges(): boolean { return this.dirty !== null }
  get dirtyBounds(): DirtyBounds | null { return this.dirty ? { ...this.dirty } : null }

  begin(result: PixelResult, label: string): void {
    if (this.active) return
    this.label = label
    this.before = clonePixelResult(result)
    this.dirty = null
  }

  recordChange(x: number, y: number): DirtyBounds {
    if (!this.active) throw new Error('编辑事务尚未开始')
    this.dirty ??= { minX: x, minY: y, maxX: x, maxY: y }
    this.dirty.minX = Math.min(this.dirty.minX, x)
    this.dirty.minY = Math.min(this.dirty.minY, y)
    this.dirty.maxX = Math.max(this.dirty.maxX, x)
    this.dirty.maxY = Math.max(this.dirty.maxY, y)
    return { ...this.dirty }
  }

  historyEntry(): { label: string; result: PixelResult } | null {
    if (!this.before) return null
    return { label: this.label, result: clonePixelResult(this.before) }
  }

  end(): DirtyBounds | null {
    const dirty = this.dirtyBounds
    this.reset()
    return dirty
  }

  cancel(): PixelResult | null {
    const before = this.before ? clonePixelResult(this.before) : null
    this.reset()
    return before
  }

  private reset(): void {
    this.label = ''
    this.before = null
    this.dirty = null
  }
}
