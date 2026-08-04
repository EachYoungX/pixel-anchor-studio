import type { ProcessRequest } from '@/types/project'

export interface ProcessFingerprintInput {
  sourceRevision: string
  crop: { x: number; y: number; width: number; height: number }
  grid: { width: number; height: number; cellSize: number; originX: number; originY: number }
  sampling: ProcessRequest['processing']['sampling']
  color: { enabled: boolean; maxColors: number }
  cleanup: { mode: ProcessRequest['processing']['cleanup']; preserveTransparent: boolean }
}

export function normalizeFloat(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function createProcessFingerprint(input: ProcessFingerprintInput): string {
  const normalized = {
    sourceRevision: input.sourceRevision,
    crop: {
      x: normalizeFloat(input.crop.x),
      y: normalizeFloat(input.crop.y),
      width: normalizeFloat(input.crop.width),
      height: normalizeFloat(input.crop.height),
    },
    grid: {
      width: input.grid.width,
      height: input.grid.height,
      cellSize: normalizeFloat(input.grid.cellSize),
      originX: normalizeFloat(input.grid.originX),
      originY: normalizeFloat(input.grid.originY),
    },
    sampling: input.sampling,
    color: input.color,
    cleanup: input.cleanup,
  }
  return JSON.stringify(normalized)
}

export function createSamplingFingerprint(input: Omit<ProcessFingerprintInput, 'color' | 'cleanup'>): string {
  return createProcessFingerprint({
    ...input,
    color: { enabled: false, maxColors: 0 },
    cleanup: { mode: 'off', preserveTransparent: false },
  })
}

export function createQuantizedFingerprint(samplingKey: string, maxColors: number): string {
  return JSON.stringify({ samplingKey, quantizer: 'median-cut', maxColors })
}

export function createFinalFingerprint(quantizedKey: string, cleanup: ProcessFingerprintInput['cleanup']): string {
  return JSON.stringify({ quantizedKey, cleanup })
}
