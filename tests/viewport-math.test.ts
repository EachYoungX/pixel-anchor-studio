import { describe, expect, it } from 'vitest'
import { contentToScreen, screenToContent, zoomAroundPoint } from '@/core/viewport/viewport-math'

describe('viewport math', () => {
  it('round-trips screen and content coordinates', () => {
    const transform = { zoom: 4, panX: 18, panY: -7 }
    const content = { x: 12.5, y: 9 }
    expect(screenToContent(contentToScreen(content, transform), transform)).toEqual(content)
  })

  it('keeps the anchored content point fixed while zooming', () => {
    const next = zoomAroundPoint({ zoom: 2, panX: 10, panY: 20 }, { x: 80, y: 60 }, 4)
    expect(contentToScreen(screenToContent({ x: 80, y: 60 }, { zoom: 2, panX: 10, panY: 20 }), next)).toEqual({ x: 80, y: 60 })
  })
})
