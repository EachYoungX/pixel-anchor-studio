import { describe, expect, it, vi } from 'vitest'
import { createRafDrawScheduler } from '@/composables/useRafDraw'

describe('rAF draw scheduler', () => {
  it('coalesces any number of requests into one draw per frame', () => {
    const callbacks: FrameRequestCallback[] = []
    const draw = vi.fn()
    const scheduler = createRafDrawScheduler(draw, (callback) => {
      callbacks.push(callback)
      return callbacks.length
    }, vi.fn())

    for (let index = 0; index < 100; index += 1) scheduler.scheduleDraw()
    expect(callbacks).toHaveLength(1)
    expect(draw).not.toHaveBeenCalled()

    callbacks.shift()?.(16)
    expect(draw).toHaveBeenCalledTimes(1)

    for (let frame = 0; frame < 10; frame += 1) {
      scheduler.scheduleDraw()
      callbacks.shift()?.(32 + frame * 16)
    }
    expect(draw).toHaveBeenCalledTimes(11)
  })

  it('cancels a pending frame', () => {
    const cancel = vi.fn()
    const scheduler = createRafDrawScheduler(vi.fn(), () => 42, cancel)
    scheduler.scheduleDraw()
    scheduler.cancelDraw()
    expect(cancel).toHaveBeenCalledWith(42)
  })
})
