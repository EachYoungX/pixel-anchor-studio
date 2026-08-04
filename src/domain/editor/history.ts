import type { HistoryEntry, PixelResult } from '@/types/project'

export function clonePixelResult(result: PixelResult): PixelResult {
  return { width: result.width, height: result.height, data: new Uint8ClampedArray(result.data) }
}

export class PixelHistory {
  readonly entries: HistoryEntry[] = []
  readonly future: HistoryEntry[] = []

  push(label: string, result: PixelResult): void {
    this.entries.push({ label, result: clonePixelResult(result) })
    if (this.entries.length > 20) this.entries.shift()
    this.future.length = 0
  }

  clear(): void {
    this.entries.length = 0
    this.future.length = 0
  }
}
