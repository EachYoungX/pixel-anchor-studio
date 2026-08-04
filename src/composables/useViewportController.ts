import { ref, type Ref } from 'vue'
import { calculateFitZoom, clampZoom, zoomAroundPoint } from '@/core/viewport/viewport-math'

export { calculateFitZoom } from '@/core/viewport/viewport-math'

export interface ViewportController {
  zoom: Ref<number>
  panX: Ref<number>
  panY: Ref<number>
  mode: Ref<'fit' | 'manual'>
  zoomAtPoint(x: number, y: number, factor: number): void
  zoomByStep(x: number, y: number, direction: 1 | -1): void
  panBy(dx: number, dy: number): void
  fitView(): void
  resetView(): void
  setManual(): void
  fitContent(request: FitRequest): number
}

export interface FitRequest {
  viewportWidth: number
  viewportHeight: number
  contentWidth: number
  contentHeight: number
  padding: number
}

export interface ViewportControllerOptions {
  initialZoom?: number
  minZoom?: number
  maxZoom?: number
  normalizeZoom?: (requestedZoom: number, direction: 1 | -1) => number
}

export function useViewportController(options: ViewportControllerOptions = {}): ViewportController {
  const initialZoom = options.initialZoom ?? 1
  const minZoom = options.minZoom ?? 0.25
  const maxZoom = options.maxZoom ?? 16
  const zoom = ref(initialZoom)
  const panX = ref(0)
  const panY = ref(0)
  const mode = ref<'fit' | 'manual'>('fit')

  function normalizedZoom(requested: number, direction: 1 | -1): number {
    const normalized = options.normalizeZoom?.(requested, direction) ?? requested
    return clampZoom(normalized, minZoom, maxZoom)
  }

  function zoomAtPoint(x: number, y: number, factor: number): void {
    const oldZoom = zoom.value
    const direction: 1 | -1 = factor >= 1 ? 1 : -1
    const nextZoom = normalizedZoom(oldZoom * factor, direction)
    const next = zoomAroundPoint({ zoom: oldZoom, panX: panX.value, panY: panY.value }, { x, y }, nextZoom)
    panX.value = next.panX
    panY.value = next.panY
    zoom.value = nextZoom
    mode.value = 'manual'
  }

  function zoomByStep(x: number, y: number, direction: 1 | -1): void {
    zoomAtPoint(x, y, direction > 0 ? 1.25 : 0.8)
  }

  function panBy(dx: number, dy: number): void {
    panX.value += dx
    panY.value += dy
    mode.value = 'manual'
  }

  function setManual(): void { mode.value = 'manual' }

  function fitContent(request: FitRequest): number {
    const nextZoom = clampZoom(calculateFitZoom(request), minZoom, maxZoom)
    zoom.value = nextZoom
    panX.value = 0
    panY.value = 0
    mode.value = 'fit'
    return nextZoom
  }

  function fitView(): void {
    zoom.value = initialZoom
    panX.value = 0
    panY.value = 0
    mode.value = 'fit'
  }

  return { zoom, panX, panY, mode, zoomAtPoint, zoomByStep, panBy, fitView, resetView: fitView, setManual, fitContent }
}
