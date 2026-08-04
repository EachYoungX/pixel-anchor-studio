import { onBeforeUnmount } from 'vue'

export function useRafDraw(draw: () => void): {
  scheduleDraw: () => void
  cancelDraw: () => void
} {
  let frame = 0

  function scheduleDraw(): void {
    if (frame) return
    if (typeof requestAnimationFrame === 'undefined') {
      draw()
      return
    }
    frame = requestAnimationFrame(() => {
      frame = 0
      draw()
    })
  }

  function cancelDraw(): void {
    if (!frame) return
    cancelAnimationFrame(frame)
    frame = 0
  }

  onBeforeUnmount(cancelDraw)
  return { scheduleDraw, cancelDraw }
}
