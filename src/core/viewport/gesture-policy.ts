export interface WheelGestureInput {
  ctrlKey: boolean
  metaKey: boolean
  deltaY: number
}

export function shouldCaptureZoomWheel(event: Pick<WheelGestureInput, 'ctrlKey' | 'metaKey'>): boolean {
  return event.ctrlKey || event.metaKey
}

export function wheelDirection(deltaY: number): 1 | -1 {
  return deltaY < 0 ? 1 : -1
}
