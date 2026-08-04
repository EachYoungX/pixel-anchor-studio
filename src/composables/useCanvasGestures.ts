import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { Point } from '@/core/viewport/viewport-math'
import type { ViewportController } from '@/composables/useViewportController'

export interface CanvasGestureOptions {
  element: Ref<HTMLElement | null>
  viewport: ViewportController
  getLocalPoint: (event: PointerEvent | WheelEvent) => Point
  canStartPan?: (event: PointerEvent) => boolean
  onPrimaryPointerDown?: (event: PointerEvent, point: Point) => void
  onPrimaryPointerMove?: (event: PointerEvent, point: Point) => void
  onPrimaryPointerUp?: (event: PointerEvent, point: Point) => void
}

export function useCanvasGestures(options: CanvasGestureOptions) {
  const spacePressed = ref(false)
  const panning = ref(false)
  const pointerInside = ref(false)
  const panStart = ref({ x: 0, y: 0 })
  const panOrigin = ref({ x: 0, y: 0 })

  function isEditableTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null
    return Boolean(element && (element.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(element.tagName)))
  }

  function canPan(event: PointerEvent): boolean {
    return (spacePressed.value || event.button === 1) && !isEditableTarget(event.target) && (options.canStartPan?.(event) ?? true)
  }

  function onPointerEnter(): void {
    pointerInside.value = true
  }

  function onPointerLeave(): void {
    pointerInside.value = false
    if (panning.value) finishPan()
  }

  function onPointerDown(event: PointerEvent): void {
    const point = options.getLocalPoint(event)
    if (canPan(event)) {
      panning.value = true
      panStart.value = { x: event.clientX, y: event.clientY }
      panOrigin.value = { x: options.viewport.panX.value, y: options.viewport.panY.value }
      options.element.value?.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }
    options.onPrimaryPointerDown?.(event, point)
  }

  function onPointerMove(event: PointerEvent): void {
    if (panning.value) {
      options.viewport.panX.value = panOrigin.value.x + event.clientX - panStart.value.x
      options.viewport.panY.value = panOrigin.value.y + event.clientY - panStart.value.y
      options.viewport.setManual()
      return
    }
    options.onPrimaryPointerMove?.(event, options.getLocalPoint(event))
  }

  function finishPan(event?: PointerEvent): void {
    if (event && options.element.value?.hasPointerCapture(event.pointerId)) options.element.value.releasePointerCapture(event.pointerId)
    panning.value = false
  }

  function onPointerUp(event: PointerEvent): void {
    if (panning.value) finishPan(event)
    options.onPrimaryPointerUp?.(event, options.getLocalPoint(event))
  }

  function onPointerCancel(event: PointerEvent): void {
    onPointerUp(event)
  }

  function onWheel(event: WheelEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    const point = options.getLocalPoint(event)
    options.viewport.zoomByStep(point.x, point.y, event.deltaY < 0 ? 1 : -1)
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (isEditableTarget(event.target)) return
    const element = options.element.value
    if (event.code === 'Space' && (pointerInside.value || element === document.activeElement || element?.contains(document.activeElement))) {
      spacePressed.value = true
      event.preventDefault()
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') spacePressed.value = false
  }

  function onWindowBlur(): void {
    spacePressed.value = false
    panning.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onWindowBlur)
  })

  return {
    spacePressed: computed(() => spacePressed.value),
    panning: computed(() => panning.value),
    onPointerEnter,
    onPointerLeave,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
    finishPan,
  }
}
