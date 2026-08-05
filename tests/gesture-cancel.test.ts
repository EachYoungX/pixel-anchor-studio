import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useCanvasGestures } from '@/composables/useCanvasGestures'
import type { ViewportController } from '@/composables/useViewportController'

function viewportStub(): ViewportController {
  return {
    zoom: ref(1),
    panX: ref(0),
    panY: ref(0),
    mode: ref('fit'),
    resetView: vi.fn(),
    fitView: vi.fn(),
    setManual: vi.fn(),
    zoomAtPoint: vi.fn(),
    zoomByStep: vi.fn(),
  } as unknown as ViewportController
}

describe('canvas gesture cancellation', () => {
  it('keeps pointer cancellation separate from normal pointer completion', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const onUp = vi.fn()
    const onCancel = vi.fn()
    const gestures = useCanvasGestures({
      element: ref(null),
      viewport: viewportStub(),
      getLocalPoint: () => ({ x: 3, y: 4 }),
      onZoomWheel: vi.fn(),
      onPrimaryPointerUp: onUp,
      onPrimaryPointerCancel: onCancel,
    })

    gestures.onPointerCancel({} as PointerEvent)

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledWith(expect.anything(), { x: 3, y: 4 })
    expect(onUp).not.toHaveBeenCalled()
    warning.mockRestore()
  })

  it('aborts the domain interaction when pointer capture is lost', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const onAbort = vi.fn()
    const gestures = useCanvasGestures({
      element: ref(null),
      viewport: viewportStub(),
      getLocalPoint: () => ({ x: 0, y: 0 }),
      onZoomWheel: vi.fn(),
      onInteractionAbort: onAbort,
    })

    gestures.onLostPointerCapture()

    expect(onAbort).toHaveBeenCalledOnce()
    warning.mockRestore()
  })
})
