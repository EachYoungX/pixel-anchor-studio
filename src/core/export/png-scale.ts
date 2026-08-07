export const MAX_PNG_SCALE = 32
export const MAX_PNG_EDGE = 2048

export function normalizePngScale(value: unknown): number {
  return Math.max(1, Math.min(MAX_PNG_SCALE, Math.round(Number(value) || 1)))
}

export function pngExportDimensions(width: number, height: number, scale: number): { width: number; height: number } {
  const normalizedScale = normalizePngScale(scale)
  return { width: width * normalizedScale, height: height * normalizedScale }
}

export function isPngExportSizeAllowed(width: number, height: number, scale: number): boolean {
  const dimensions = pngExportDimensions(width, height, scale)
  return Math.max(dimensions.width, dimensions.height) <= MAX_PNG_EDGE
}
