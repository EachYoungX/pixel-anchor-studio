import { describe, expect, it, vi } from 'vitest'
import { markQuickStartSeen, QUICK_START_SEEN_KEY, shouldShowQuickStart } from '@/core/onboarding'

describe('quick start onboarding', () => {
  it('shows once and records dismissal', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(shouldShowQuickStart(storage)).toBe(true)
    markQuickStartSeen(storage)
    expect(values.get(QUICK_START_SEEN_KEY)).toBe('1')
    expect(shouldShowQuickStart(storage)).toBe(false)
  })

  it('remains usable when browser storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('blocked') }),
      setItem: vi.fn(() => { throw new Error('blocked') }),
    }

    expect(shouldShowQuickStart(storage)).toBe(true)
    expect(() => markQuickStartSeen(storage)).not.toThrow()
  })
})
