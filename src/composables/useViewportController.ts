import { ref, type Ref } from 'vue'

export interface ViewportController {
  zoom: Ref<number>
  panX: Ref<number>
  panY: Ref<number>
  mode: Ref<'fit' | 'manual'>
  zoomAtPoint(x: number, y: number, factor: number): void
  panBy(dx: number, dy: number): void
  fitView(): void
  resetView(): void
}

export function useViewportController(options: { initialZoom?: number; minZoom?: number; maxZoom?: number } = {}): ViewportController {
  const initialZoom = options.initialZoom ?? 1
  const minZoom = options.minZoom ?? 0.25
  const maxZoom = options.maxZoom ?? 16
  const zoom = ref(initialZoom)
  const panX = ref(0)
  const panY = ref(0)
  const mode = ref<'fit' | 'manual'>('fit')

  function zoomAtPoint(x: number, y: number, factor: number): void {
    const oldZoom = zoom.value
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, oldZoom * factor))
    panX.value = x - (x - panX.value) * (nextZoom / oldZoom)
    panY.value = y - (y - panY.value) * (nextZoom / oldZoom)
    zoom.value = nextZoom
    mode.value = 'manual'
  }

  function panBy(dx: number, dy: number): void {
    panX.value += dx
    panY.value += dy
    mode.value = 'manual'
  }

  function fitView(): void {
    zoom.value = initialZoom
    panX.value = 0
    panY.value = 0
    mode.value = 'fit'
  }

  return { zoom, panX, panY, mode, zoomAtPoint, panBy, fitView, resetView: fitView }
}
