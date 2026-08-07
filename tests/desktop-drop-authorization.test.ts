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

  it('keeps native drag feedback separate from Rust-authorized file reading', () => {
    const composable = readWorkspaceFile('src/composables/useFileDropImport.ts')
    const rust = readWorkspaceFile('src-tauri/src/lib.rs')
    const nativeCallbackStart = composable.indexOf('getCurrentWebview().onDragDropEvent')
    const nativeCallbackEnd = composable.indexOf('if (disposed)', nativeCallbackStart)
    const nativeCallback = composable.slice(nativeCallbackStart, nativeCallbackEnd)
    const approveIndex = rust.indexOf('approve_drop_paths(paths)')
    const emitIndex = rust.indexOf('webview.emit("pas://files-dropped"')

    expect(nativeCallbackStart).toBeGreaterThan(-1)
    expect(nativeCallback).toContain('desktopDrop.handleNativeDrag(event.payload.type)')
    expect(nativeCallback).not.toContain('handleIncomingFiles')
    expect(nativeCallback).not.toContain('read_dropped_file')
    expect(composable).not.toContain('pas://drag-state')
    expect(rust).not.toContain('pas://drag-state')
    expect(approveIndex).toBeGreaterThan(-1)
    expect(emitIndex).toBeGreaterThan(approveIndex)
  })
})
