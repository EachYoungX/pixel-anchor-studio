import { describe, expect, it } from 'vitest'
import { useViewportController } from '@/composables/useViewportController'

describe('useViewportController', () => {
  it('keeps the zoom anchor fixed and enters manual mode', () => {
    const viewport = useViewportController()
    viewport.zoomAtPoint(100, 80, 2)

    expect(viewport.zoom.value).toBe(2)
    expect(viewport.panX.value).toBe(-100)
    expect(viewport.panY.value).toBe(-80)
    expect(viewport.mode.value).toBe('manual')
  })

  it('restores fit mode and zero pan', () => {
    const viewport = useViewportController()
    viewport.panBy(24, -12)
    viewport.resetView()

    expect(viewport.zoom.value).toBe(1)
    expect(viewport.panX.value).toBe(0)
    expect(viewport.panY.value).toBe(0)
    expect(viewport.mode.value).toBe('fit')
  })
})
