export interface Point {
  x: number
  y: number
}

export interface ViewTransform {
  zoom: number
  panX: number
  panY: number
}

export function screenToContent(screen: Point, transform: ViewTransform): Point {
  return {
    x: (screen.x - transform.panX) / transform.zoom,
    y: (screen.y - transform.panY) / transform.zoom,
  }
}

export function contentToScreen(content: Point, transform: ViewTransform): Point {
  return {
    x: content.x * transform.zoom + transform.panX,
    y: content.y * transform.zoom + transform.panY,
  }
}

export function zoomAroundPoint(
  transform: ViewTransform,
  screenPoint: Point,
  nextZoom: number,
): ViewTransform {
  const contentPoint = screenToContent(screenPoint, transform)
  return {
    zoom: nextZoom,
    panX: screenPoint.x - contentPoint.x * nextZoom,
    panY: screenPoint.y - contentPoint.y * nextZoom,
  }
}

export function clampZoom(value: number, minZoom: number, maxZoom: number): number {
  return Math.max(minZoom, Math.min(maxZoom, value))
}

export function calculateFitZoom(input: {
  viewportWidth: number
  viewportHeight: number
  contentWidth: number
  contentHeight: number
  padding: number
}): number {
  if (input.contentWidth <= 0 || input.contentHeight <= 0) return 1
  return Math.min(
    Math.max(0, input.viewportWidth - input.padding * 2) / input.contentWidth,
    Math.max(0, input.viewportHeight - input.padding * 2) / input.contentHeight,
  )
}
