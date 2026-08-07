import { isTauri } from '@tauri-apps/api/core'

export function isDesktopPlatform(): boolean {
  return isTauri()
}
