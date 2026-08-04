import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { calculatePdfFitZoom, calculateWidthFitZoom, nextDocumentZoom, useDocumentZoom } from '@/composables/useDocumentZoom'

describe('useDocumentZoom', () => {
  it('fits PDF to one page and SVG to available width', () => {
    expect(calculatePdfFitZoom(900, 700, 900, 636.36)).toBeCloseTo(0.947, 2)
    expect(calculateWidthFitZoom(900, 1200)).toBeCloseTo(0.71, 2)
  })

  it('moves through the reading zoom levels', () => {
    expect(nextDocumentZoom(0.8, 1)).toBe(1)
    expect(nextDocumentZoom(1.25, -1)).toBe(1)
  })

  it('keeps the viewport center anchored while zooming', async () => {
    const viewport = { clientWidth: 600, clientHeight: 400, scrollLeft: 120, scrollTop: 80 }
    const controller = useDocumentZoom()
    controller.zoom.value = 1
    controller.changeZoom(2, viewport)
    await nextTick()

    expect(viewport.scrollLeft).toBe(540)
    expect(viewport.scrollTop).toBe(360)
    expect((viewport.scrollLeft + viewport.clientWidth / 2) / controller.zoom.value).toBe(420)
    expect((viewport.scrollTop + viewport.clientHeight / 2) / controller.zoom.value).toBe(280)
  })
})
