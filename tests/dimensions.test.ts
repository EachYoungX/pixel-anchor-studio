import { describe, expect, it } from 'vitest'
import { calculateOutputDimensions } from '@/core/dimensions'
import type { Rect, ScaleSettings } from '@/types/project'

const crop: Rect = { x: 0, y: 0, width: 1080, height: 1920 }
const anchor: Rect = { x: 100, y: 100, width: 90, height: 90 }

function settings(overrides: Partial<ScaleSettings>): ScaleSettings {
  return {
    mode: 'direct',
    directAxis: 'longSide',
    directValue: 256,
    anchorCells: 3,
    pseudoCellSize: 8,
    offsetX: 0,
    offsetY: 0,
    ...overrides,
  }
}

describe('calculateOutputDimensions', () => {
  it('keeps portrait aspect ratio for a 256 long side', () => {
    const output = calculateOutputDimensions(crop, anchor, settings({}))
    expect(output.width).toBe(144)
    expect(output.height).toBe(256)
  })

  it('uses the anchor as a source cell scale', () => {
    const output = calculateOutputDimensions(crop, anchor, settings({ mode: 'anchor', anchorCells: 3 }))
    expect(output.width).toBe(36)
    expect(output.height).toBe(64)
  })

  it('never exceeds 256', () => {
    const output = calculateOutputDimensions(crop, anchor, settings({ mode: 'pseudo', pseudoCellSize: 1 }))
    expect(Math.max(output.width, output.height)).toBeLessThanOrEqual(256)
  })
})
