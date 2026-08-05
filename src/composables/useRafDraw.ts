import { onBeforeUnmount } from 'vue'

export interface RafDrawScheduler {
  scheduleDraw(): void
  cancelDraw(): void
}

export function createRafDrawScheduler(
  draw: () => void,
  requestFrame: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancelFrame: (handle: number) => void = cancelAnimationFrame,
): RafDrawScheduler {
  let frame = 0

  function scheduleDraw(): void {
    if (frame) return
    frame = requestFrame(() => {
      frame = 0
      draw()
    })
  }

  function cancelDraw(): void {
    if (!frame) return
    cancelFrame(frame)
    frame = 0
  }

  return { scheduleDraw, cancelDraw }
}

export function useRafDraw(draw: () => void): {
  scheduleDraw: () => void
  cancelDraw: () => void
} {
  if (typeof requestAnimationFrame === 'undefined') return { scheduleDraw: draw, cancelDraw() {} }
  const scheduler = createRafDrawScheduler(draw)

  onBeforeUnmount(scheduler.cancelDraw)
  return scheduler
}
