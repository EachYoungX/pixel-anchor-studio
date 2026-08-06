export const QUICK_START_SEEN_KEY = 'pixel-anchor-studio:quick-start-seen:v1'

export interface OnboardingStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function shouldShowQuickStart(storage: OnboardingStorage): boolean {
  try {
    return storage.getItem(QUICK_START_SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

export function markQuickStartSeen(storage: OnboardingStorage): void {
  try {
    storage.setItem(QUICK_START_SEEN_KEY, '1')
  } catch {
    // Storage may be unavailable in strict privacy modes; closing still works.
  }
}
