import { describe, expect, it } from 'vitest'
import { createProcessFingerprint } from '@/domain/processing/process-fingerprint'

describe('process fingerprint', () => {
  it('normalizes insignificant floating point noise', () => {
    const base = {
      sourceRevision: 'source-1',
      crop: { x: 0, y: 0, width: 10, height: 10 },
      grid: { width: 2, height: 2, cellSize: 5, originX: 0, originY: 0 },
      sampling: 'median' as const,
      color: { enabled: true, maxColors: 64 },
      cleanup: { mode: 'off' as const, preserveTransparent: true },
    }
    expect(createProcessFingerprint(base)).toBe(createProcessFingerprint({ ...base, grid: { ...base.grid, originX: 0.0000000001 } }))
  })
})
