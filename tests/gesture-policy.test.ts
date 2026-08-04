import { describe, expect, it } from 'vitest'
import { shouldCaptureZoomWheel, wheelDirection } from '@/core/viewport/gesture-policy'

describe('gesture policy', () => {
  it('only captures modifier-wheel events for canvas zoom', () => {
    expect(shouldCaptureZoomWheel({ ctrlKey: false, metaKey: false })).toBe(false)
    expect(shouldCaptureZoomWheel({ ctrlKey: true, metaKey: false })).toBe(true)
    expect(shouldCaptureZoomWheel({ ctrlKey: false, metaKey: true })).toBe(true)
  })

  it('maps wheel direction to zoom direction', () => {
    expect(wheelDirection(-1)).toBe(1)
    expect(wheelDirection(1)).toBe(-1)
  })
})
