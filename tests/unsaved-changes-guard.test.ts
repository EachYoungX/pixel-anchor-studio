import { describe, expect, it, vi } from 'vitest'
import { createUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'

describe('unsaved changes guard', () => {
  it('keeps the original dirty state when a discarded replacement fails', async () => {
    const store = { dirty: true }
    const action = vi.fn(async () => false)
    const guard = createUnsavedChangesGuard(store)

    const pending = guard.request('import-image', action)
    expect(guard.open.value).toBe(true)
    await guard.discardAndContinue()

    expect(await pending).toBe(false)
    expect(action).toHaveBeenCalledOnce()
    expect(store.dirty).toBe(true)
  })

  it('saves before executing the pending action', async () => {
    const store = { dirty: true }
    const order: string[] = []
    const guard = createUnsavedChangesGuard(store, async () => {
      order.push('save')
      store.dirty = false
      return true
    })
    const pending = guard.request('open-project', async () => {
      order.push('replace')
      return true
    })

    await guard.saveAndContinue()

    expect(await pending).toBe(true)
    expect(order).toEqual(['save', 'replace'])
    expect(guard.open.value).toBe(false)
  })

  it('cancels without executing the pending action', async () => {
    const action = vi.fn(async () => true)
    const guard = createUnsavedChangesGuard({ dirty: true })
    const pending = guard.request('clear', action)

    guard.cancel()

    expect(await pending).toBe(false)
    expect(action).not.toHaveBeenCalled()
  })
})
