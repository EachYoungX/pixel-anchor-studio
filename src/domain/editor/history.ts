import type { PixelResult } from '@/types/project'

export function clonePixelResult(result: PixelResult): PixelResult {
  return { width: result.width, height: result.height, data: new Uint8ClampedArray(result.data) }
}
