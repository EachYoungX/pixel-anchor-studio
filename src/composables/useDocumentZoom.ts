import { nextTick, ref, type Ref } from 'vue'

export const documentZoomLevels = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5]
export const MIN_DOCUMENT_ZOOM = documentZoomLevels[0]
export const MAX_DOCUMENT_ZOOM = documentZoomLevels[documentZoomLevels.length - 1]

export interface DocumentViewportElement {
  clientWidth: number
  clientHeight: number
  scrollLeft: number
  scrollTop: number
}

export function clampDocumentZoom(value: number): number {
  return Math.max(MIN_DOCUMENT_ZOOM, Math.min(MAX_DOCUMENT_ZOOM, value))
}

export function calculatePdfFitZoom(viewportWidth: number, viewportHeight: number, pageWidth: number, pageHeight: number, padding = 24): number {
  return clampDocumentZoom(Math.min((viewportWidth - padding * 2) / pageWidth, (viewportHeight - padding * 2) / pageHeight))
}

export function calculateWidthFitZoom(viewportWidth: number, contentWidth: number, padding = 24): number {
  return clampDocumentZoom((viewportWidth - padding * 2) / contentWidth)
}

export function nextDocumentZoom(current: number, direction: -1 | 1): number {
  if (direction > 0) return documentZoomLevels.find((level) => level > current + 0.001) ?? MAX_DOCUMENT_ZOOM
  return [...documentZoomLevels].reverse().find((level) => level < current - 0.001) ?? MIN_DOCUMENT_ZOOM
}

export function useDocumentZoom(): {
  zoom: Ref<number>
  fitting: Ref<'page' | 'width' | 'manual'>
  changeZoom: (next: number, viewport: DocumentViewportElement) => void
  changeByStep: (direction: -1 | 1, viewport: DocumentViewportElement) => void
  fitPage: (viewport: DocumentViewportElement, pageWidth: number, pageHeight: number) => void
  fitWidth: (viewport: DocumentViewportElement, contentWidth: number) => void
} {
  const zoom = ref(1)
  const fitting = ref<'page' | 'width' | 'manual'>('page')

  function changeZoom(next: number, viewport: DocumentViewportElement): void {
    const oldZoom = zoom.value
    const nextZoom = clampDocumentZoom(next)
    if (nextZoom === oldZoom) return
    const anchorX = (viewport.scrollLeft + viewport.clientWidth / 2) / oldZoom
    const anchorY = (viewport.scrollTop + viewport.clientHeight / 2) / oldZoom
    zoom.value = nextZoom
    fitting.value = 'manual'
    nextTick(() => {
      viewport.scrollLeft = Math.max(0, anchorX * nextZoom - viewport.clientWidth / 2)
      viewport.scrollTop = Math.max(0, anchorY * nextZoom - viewport.clientHeight / 2)
    })
  }

  function changeByStep(direction: -1 | 1, viewport: DocumentViewportElement): void {
    changeZoom(nextDocumentZoom(zoom.value, direction), viewport)
  }

  function fitPage(viewport: DocumentViewportElement, pageWidth: number, pageHeight: number): void {
    zoom.value = calculatePdfFitZoom(viewport.clientWidth, viewport.clientHeight, pageWidth, pageHeight)
    fitting.value = 'page'
    nextTick(() => {
      viewport.scrollLeft = 0
      viewport.scrollTop = 0
    })
  }

  function fitWidth(viewport: DocumentViewportElement, contentWidth: number): void {
    zoom.value = calculateWidthFitZoom(viewport.clientWidth, contentWidth)
    fitting.value = 'width'
    nextTick(() => {
      viewport.scrollLeft = 0
      viewport.scrollTop = 0
    })
  }

  return { zoom, fitting, changeZoom, changeByStep, fitPage, fitWidth }
}
