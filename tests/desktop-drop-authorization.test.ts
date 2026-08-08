import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesktopDropAuthorization } from '@/domain/file-input/desktop-drop-authorization'

function readWorkspaceFile(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

describe('desktop drop authorization ordering', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('never starts file handling from the official native Drop event', () => {
    vi.useFakeTimers()
    const handleAuthorized = vi.fn()
    const setOverlay = vi.fn()
    const gate = createDesktopDropAuthorization<string>({ setOverlay, handleAuthorized, handleTimeout: vi.fn() })

    gate.handleNativeDrag('enter')
    gate.handleNativeDrag('drop')

    expect(handleAuthorized).not.toHaveBeenCalled()
    expect(setOverlay).toHaveBeenLastCalledWith(true, true)

    gate.handleAuthorized(['C:\\image.png'])
    expect(handleAuthorized).toHaveBeenCalledOnce()
    expect(handleAuthorized).toHaveBeenCalledWith(['C:\\image.png'])
  })

  it('closes the overlay and reports a missing Rust authorization event once', () => {
    vi.useFakeTimers()
    const handleTimeout = vi.fn()
    const setOverlay = vi.fn()
    const gate = createDesktopDropAuthorization<string>({ timeoutMs: 1000, setOverlay, handleAuthorized: vi.fn(), handleTimeout })

    gate.handleNativeDrag('drop')
    vi.advanceTimersByTime(1000)

    expect(setOverlay).toHaveBeenLastCalledWith(false, false)
    expect(handleTimeout).toHaveBeenCalledOnce()
  })

  it('does not start a false timeout when Rust authorization arrives before the native Drop callback', () => {
    vi.useFakeTimers()
    const handleAuthorized = vi.fn()
    const handleTimeout = vi.fn()
    const setOverlay = vi.fn()
    const gate = createDesktopDropAuthorization<string>({ setOverlay, handleAuthorized, handleTimeout })

    gate.handleNativeDrag('enter')
    gate.handleAuthorized(['C:\\image.png'])
    gate.handleNativeDrag('drop')
    vi.advanceTimersByTime(2500)

    expect(handleAuthorized).toHaveBeenCalledOnce()
    expect(handleTimeout).not.toHaveBeenCalled()
    expect(setOverlay).toHaveBeenLastCalledWith(false, false)
  })

  it('switches the desktop runtime to the shared HTML5 drop entry without deleting the dormant Rust fallback', () => {
    const composable = readWorkspaceFile('src/composables/useFileDropImport.ts')
    const config = readWorkspaceFile('src-tauri/tauri.conf.json')
    const rust = readWorkspaceFile('src-tauri/src/lib.rs')

    expect(config).toContain('"dragDropEnabled": false')
    expect(composable).toContain("window.addEventListener('drop', handleDrop)")
    expect(composable).toContain('Array.from(transfer.files)')
    expect(composable).toContain("router.handleIncomingFiles([...files, ...directories], 'web-drop')")
    expect(composable).not.toContain('isDesktopPlatform')
    expect(composable).not.toContain('onDragDropEvent')
    expect(composable).not.toContain('claimAuthorizedDrop')
    expect(composable).not.toContain('pas://files-dropped')
    expect(rust).toContain('pending_authorized_drop: Mutex<Option<Vec<DroppedPathPayload>>>')
    expect(rust).toContain('fn claim_authorized_drop(')
  })
})
