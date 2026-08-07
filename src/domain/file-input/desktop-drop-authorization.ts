export type DesktopNativeDragType = 'enter' | 'over' | 'drop' | 'leave'

interface DesktopDropAuthorizationOptions<T> {
  timeoutMs?: number
  setOverlay: (active: boolean, waiting: boolean) => void
  handleAuthorized: (files: T[]) => void
  handleTimeout: () => void
}

export function createDesktopDropAuthorization<T>(options: DesktopDropAuthorizationOptions<T>) {
  let authorizationTimer: ReturnType<typeof setTimeout> | undefined
  let waitingForAuthorization = false
  let suppressNativeDropUntil = 0

  function clearAuthorizationTimer(): void {
    if (authorizationTimer) clearTimeout(authorizationTimer)
    authorizationTimer = undefined
  }

  function reset(): void {
    clearAuthorizationTimer()
    waitingForAuthorization = false
    suppressNativeDropUntil = 0
    options.setOverlay(false, false)
  }

  function handleNativeDrag(type: DesktopNativeDragType): void {
    if (type === 'enter' || type === 'over') {
      clearAuthorizationTimer()
      waitingForAuthorization = false
      options.setOverlay(true, false)
      return
    }
    if (type === 'leave') {
      reset()
      return
    }

    if (Date.now() <= suppressNativeDropUntil) {
      reset()
      return
    }

    clearAuthorizationTimer()
    waitingForAuthorization = true
    suppressNativeDropUntil = 0
    options.setOverlay(true, true)
    authorizationTimer = setTimeout(() => {
      authorizationTimer = undefined
      waitingForAuthorization = false
      options.setOverlay(false, false)
      options.handleTimeout()
    }, options.timeoutMs ?? 2500)
  }

  function handleAuthorized(files: T[]): void {
    const nativeDropSeen = waitingForAuthorization
    clearAuthorizationTimer()
    waitingForAuthorization = false
    options.setOverlay(false, false)
    if (!nativeDropSeen) suppressNativeDropUntil = Date.now() + 1000
    options.handleAuthorized(files)
  }

  return { handleNativeDrag, handleAuthorized, reset }
}
