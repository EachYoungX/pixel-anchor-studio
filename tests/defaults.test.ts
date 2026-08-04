import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from '@/stores/project'

describe('project defaults', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts new projects with a 32-pixel long side', () => {
    expect(useProjectStore().scale.directLongSide).toBe(32)
  })
})
