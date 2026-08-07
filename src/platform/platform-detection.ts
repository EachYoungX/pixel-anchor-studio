export function isDesktopPlatform(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
